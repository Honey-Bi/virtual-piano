import React, { useEffect, useRef, useState } from "react";

type Size = {
  width: number;
  height: number;
};
type Cursor = {
  x: number;
  y: number;
};
const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const colors = ["#000", "#fff"];
class Ball {
  position: { x: number; y: number }; // 위치
  velocity: { x: number; y: number }; // 속력
  e: number; // 감쇄율
  mass: number; // 무게
  radius: number; // 크기
  color: string; // 색상
  area: number; // 영역크기
  char: string; // AtoZ 문자
  angle: number; // 회전양
  rotate: number; //회전속도
  isMouse: boolean; //마우스인지
  constructor(x: number, y: number, radius: number, e: number, mass: number, isMouse: boolean) {
    this.position = { x: x, y: y };
    this.velocity = { x: 0, y: 0 };
    this.e = -e;
    this.mass = mass;
    this.radius = radius;
    this.color = colors[rand(0, 1)];
    this.area = (Math.PI * radius * radius) / 10000;
    this.char = text[rand(0, text.length - 1)];
    this.angle = rand(0, 360);
    this.rotate = rand(-4, 4);
    this.isMouse = isMouse;
  }
}

const balls: Ball[] = [];

// 범위 내에서 난수 생성 함수
function rand(low: number, high: number) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [cursor, setCursor] = useState<Cursor>({ x: 0, y: 0 });
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [divide, setDivede] = useState<boolean>(false);
  const NUM_PARTICLES = 100; // 파티클 개수
  const fps = 1 / 60; //프레임
  const radius = 25;
  // 캔버스 크기 조절 및 초기화
  useEffect(() => {
    //context 처리
    handleResize();
    if (!canvasRef.current) return;
    const canvas: HTMLCanvasElement = canvasRef.current!;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    setCtx(context);
    while (balls.length < NUM_PARTICLES) {
      //  x y 반지름 속도감쇄율 무게 색상

      balls.push(new Ball(-radius - 1, 0, radius, 0.7, 10, false));
    }
  }, [NUM_PARTICLES]);

  // 화면 리사이즈 이벤트 핸들러
  const handleResize = () => {
    setSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };
  useEffect(() => {
    // 화면 resize 처리
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  // 애니메이션 프레임 요청 및 해제
  useEffect(() => {
    let requestId: number;
    const RequestAnimation = (ctx: CanvasRenderingContext2D | null) => () => {
      if (ctx) animate(ctx);

      // 애니메이션 콜백 반복
      requestId = window.requestAnimationFrame(RequestAnimation(ctx));
    };

    // 애니메이션 초기화
    requestId = window.requestAnimationFrame(RequestAnimation(ctx));
    return () => {
      window.cancelAnimationFrame(requestId);
    };
  });

  function animate(ctx: CanvasRenderingContext2D) {
    //애니메이션 함수
    var gravity = 0.2;
    var density = 1.22;
    // var drag = 0.47;

    ctx.clearRect(0, 0, size.width, size.height);

    for (var i = 0; i < balls.length; i++) {
      //공기 역학 계산
      // -0.5 * Cd * A * v^2 * rho
      var fx =
        -0.5 *
        density *
        balls[i].area *
        balls[i].velocity.x *
        balls[i].velocity.x *
        (balls[i].velocity.x / Math.abs(balls[i].velocity.x));
      var fy =
        -0.5 *
        density *
        balls[i].area *
        balls[i].velocity.y *
        balls[i].velocity.y *
        (balls[i].velocity.y / Math.abs(balls[i].velocity.y));

      fx = isNaN(fx) ? 0 : fx;
      fy = isNaN(fy) ? 0 : fy;

      // 공 가속 계산
      //F = ma or a = F/m
      var ax = fx / balls[i].mass;
      var ay = 9.81 * gravity + fy / balls[i].mass;
      // 공 속도 계산
      balls[i].velocity.x += ax * fps;
      balls[i].velocity.y += ay * fps;

      // 공 위치 계산
      balls[i].position.x += balls[i].velocity.x * fps * 100;
      balls[i].position.y += balls[i].velocity.y * fps * 100;

      //공 그리기
      if (!balls[i].isMouse) {
        ctx.save();
        ctx.beginPath();
        ctx.translate(balls[i].position.x, balls[i].position.y);
        ctx.rotate((balls[i].angle * Math.PI) / 180);
        balls[i].angle += balls[i].rotate;
        // 범위 확인용
        // ctx.strokeStyle = balls[i].color;
        // ctx.arc(0, 0, balls[i].radius, 0, 2 * Math.PI, true);
        // ctx.stroke();

        ctx.font = `bold ${balls[i].radius * 2}px Consolas`;
        ctx.fillStyle = balls[i].color;
        ctx.fillText(balls[i].char, 0 - balls[i].radius / 2, 0 + balls[i].radius / 1.5);
        ctx.closePath();
        ctx.restore();
      } else {
        balls[i].position = { x: cursor.x, y: cursor.y };
        balls[i].velocity = { x: 0, y: 0 };
        // 범위 확인용
        ctx.beginPath();
        ctx.strokeStyle = balls[i].color;
        ctx.arc(balls[i].position.x, balls[i].position.y, balls[i].radius, 0, 2 * Math.PI, true);
        ctx.stroke();
        ctx.closePath();
      }

      // 공 부딪힘 계산
      collisionWall(balls[i]);
      collisionBall(balls[i]);
    }
  }

  // 벽넘김 감지
  const DEFAULT_VELOCITY = 2.5;
  function collisionWall(ball: Ball) {
    if (ball.isMouse) return;
    if (
      ball.position.x > size.width + ball.radius * 2 || //right
      ball.position.y > size.height + ball.radius * 2 || // bottom
      ball.position.x < -ball.radius // left
    ) {
      ball.velocity.x = rand(-DEFAULT_VELOCITY, DEFAULT_VELOCITY);
      ball.velocity.y = rand(0, DEFAULT_VELOCITY);
      ball.position.x = rand(0, size.width);
      ball.position.y = -ball.radius;
    }
  }

  // 공끼리 부딪힘 감지
  function collisionBall(b1: Ball) {
    for (var i = 0; i < balls.length; i++) {
      var b2 = balls[i];
      if (b1.position.x !== b2.position.x && b1.position.y !== b2.position.y) {
        // AABB를 통한 잠재적 충돌 확인
        if (
          b1.position.x + b1.radius + b2.radius > b2.position.x &&
          b1.position.x < b2.position.x + b1.radius + b2.radius &&
          b1.position.y + b1.radius + b2.radius > b2.position.y &&
          b1.position.y < b2.position.y + b1.radius + b2.radius
        ) {
          // 피타고라스
          var distX = b1.position.x - b2.position.x;
          var distY = b1.position.y - b2.position.y;
          var d = Math.sqrt(distX * distX + distY * distY);

          // 원 충돌 확인
          if (d < b1.radius + b2.radius) {
            var nx = (b2.position.x - b1.position.x) / d;
            var ny = (b2.position.y - b1.position.y) / d;
            var p =
              (2 * (b1.velocity.x * nx + b1.velocity.y * ny - b2.velocity.x * nx - b2.velocity.y * ny)) /
              (b1.mass + b2.mass);

            // 충돌 지점 계산
            var colPointX = (b1.position.x * b2.radius + b2.position.x * b1.radius) / (b1.radius + b2.radius);
            var colPointY = (b1.position.y * b2.radius + b2.position.y * b1.radius) / (b1.radius + b2.radius);

            // 중복 중지
            b1.position.x = colPointX + (b1.radius * (b1.position.x - b2.position.x)) / d;
            b1.position.y = colPointY + (b1.radius * (b1.position.y - b2.position.y)) / d;
            b2.position.x = colPointX + (b2.radius * (b2.position.x - b1.position.x)) / d;
            b2.position.y = colPointY + (b2.radius * (b2.position.y - b1.position.y)) / d;

            // 속도에 충돌 반영
            b1.velocity.x -= p * b1.mass * nx;
            b1.velocity.y -= p * b1.mass * ny;
            b2.velocity.x += p * b2.mass * nx;
            b2.velocity.y += p * b2.mass * ny;
          }
        }
      }
    }
  }
  useEffect(() => {
    if (divide && balls.length === NUM_PARTICLES) {
      balls.push(new Ball(cursor.x, cursor.y, 30, 0.7, 10, true));
    } else if (!divide && balls.length > NUM_PARTICLES) {
      balls.pop();
    }
  }, [cursor.x, cursor.y, divide]);

  function setPosition(e: React.MouseEvent | React.TouchEvent) {
    if (e.nativeEvent instanceof MouseEvent) {
      setCursor({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    } else if (e.nativeEvent instanceof TouchEvent) {
      setCursor({
        x: e.nativeEvent.changedTouches[0].pageX,
        y: e.nativeEvent.changedTouches[0].pageY,
      });
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={size.width}
      height={size.height}
      onMouseEnter={() => setDivede(true)}
      onMouseMove={setPosition}
      onMouseLeave={() => setDivede(false)}
      onTouchStart={() => setDivede(true)}
      onTouchMove={setPosition}
      onTouchEnd={() => setDivede(false)}
    />
  );
}

export default App;
