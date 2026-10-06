The legacy Create React App dependency tree was replaced with Vite and Vitest to remove vulnerable webpack, SVGO, PostCSS 7, Jest, node-forge and related transitive packages.

Use Node.js 22.22.2+, 24.15+ or 26+. Run `npm ci`, `npm start`, `npm run build` and `npm test`. Builds retain the `build/` output directory and the existing GitHub Pages base path. The development server binds to localhost.
