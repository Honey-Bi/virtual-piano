// Runs only from the trusted default branch; never executes PR code.
module.exports = async ({ github, context, core }) => {
  const run = context.payload.workflow_run;
  const repo = context.repo;
  const fullName = `${repo.owner}/${repo.repo}`;
  const skip = reason => core.info(`Not merging: ${reason}`);
  if (run.event !== 'pull_request' || run.conclusion !== 'success' ||
      run.head_repository?.full_name !== fullName || run.name !== 'Dependency checks') return skip('untrusted run');
  const workflow = await github.rest.actions.getWorkflowRun({ ...repo, run_id: run.id });
  if (workflow.data.path !== '.github/workflows/dependency-checks.yml' || workflow.data.head_sha !== run.head_sha ||
      workflow.data.conclusion !== 'success') return skip('unexpected workflow');
  const candidates = await github.paginate(github.rest.pulls.list, {
    ...repo, state: 'open', head: `${repo.owner}:${run.head_branch}`, per_page: 100
  });
  const pr = candidates.find(p => p.head.sha === run.head_sha && p.user.login === 'dependabot[bot]' && p.user.id === 49699333);
  if (!pr || pr.draft || pr.head.repo?.full_name !== fullName || pr.base.ref !== context.payload.repository.default_branch ||
      !pr.head.ref.startsWith('dependabot/npm_and_yarn/')) return skip('not an npm Dependabot PR');
  const tested = run.pull_requests?.find(p => p.number === pr.number);
  if (!tested || tested.base.sha !== pr.base.sha) return skip('base branch changed since validation');
  const files = await github.paginate(github.rest.pulls.listFiles, { ...repo, pull_number: pr.number, per_page: 100 });
  if (!files.length || files.some(f => !/(^|\/)package(-lock)?\.json$/.test(f.filename) || f.status !== 'modified') ||
      !files.some(f => f.filename.endsWith('package-lock.json'))) return skip('non-dependency changes');
  const readJson = async (path, ref) => {
    const { data } = await github.rest.repos.getContent({ ...repo, path, ref });
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  };
  const stable = value => JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
  const smallUpgrade = (before, after) => {
    const re = /^(\d+)\.(\d+)\.(\d+)$/;
    if (!re.test(before) || !re.test(after)) return false;
    const a = before.split('.').map(Number), b = after.split('.').map(Number);
    return a[0] === b[0] && (a[0] !== 0 || a[1] === b[1]) &&
      (b[1] > a[1] || (b[1] === a[1] && b[2] >= a[2]));
  };
  let upgrades = 0;
  for (const file of files) {
    const before = await readJson(file.filename, pr.base.sha);
    const after = await readJson(file.filename, pr.head.sha);
    if (file.filename.endsWith('package-lock.json')) {
      if (!before.packages || !after.packages || before.lockfileVersion !== after.lockfileVersion) return skip('lock format change');
      for (const [path, pkg] of Object.entries(after.packages)) {
        const old = before.packages[path];
        if (!path || !old || old.version === pkg.version) continue;
        if (!smallUpgrade(old.version, pkg.version)) return skip('major, prerelease, or downgrade');
        upgrades++;
      }
    } else {
      for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides']) {
        delete before[key]; delete after[key];
      }
      if (stable(before) !== stable(after)) return skip('package scripts or configuration changed');
    }
  }
  if (!upgrades) return skip('no verified version upgrades');
  const checks = await github.paginate(github.rest.checks.listForRef, { ...repo, ref: pr.head.sha, per_page: 100 });
  if (checks.some(c => c.status !== 'completed' || !['success', 'neutral', 'skipped'].includes(c.conclusion))) return skip('checks pending or failed');
  const { data: status } = await github.rest.repos.getCombinedStatusForRef({ ...repo, ref: pr.head.sha });
  if (status.total_count && status.state !== 'success') return skip('commit statuses pending or failed');
  const { data: current } = await github.rest.pulls.get({ ...repo, pull_number: pr.number });
  if (current.head.sha !== run.head_sha || !current.mergeable || current.state !== 'open' ||
      current.base.sha !== pr.base.sha) return skip('PR changed or has conflicts');
  const { data: merged } = await github.rest.pulls.merge({ ...repo, pull_number: pr.number,
    sha: run.head_sha, merge_method: 'squash' });
  if (!merged.merged) throw new Error(merged.message);
  core.info(`Merged verified Dependabot PR #${pr.number}`);
};
