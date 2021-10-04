import p5 from "p5";
import { Record } from "./Record";
import ado from "./songs/ado.json";

const containerElement = document.getElementById("p5-container") ?? undefined;

const C_WIDTH = 800;
const C_HEIGHT = 800;

const BEATS = 400;

const getDist = (theta: number) => {
  const a = 1;
  const b = Math.PI;

  return a + b * theta;
};

const arcLength = (t: number) => {
  const sq = Math.sqrt(Math.pow(t, 2) + 1) * t;
  return (1 / 2) * 1 * (sq + Math.asinh(t));
};

const rotSpeed = (t: number) => {
  const speed = 20;

  return speed / (2 * Math.PI * t);
};

const findT = (targetL: number, tolerance: number = 0.1) => {
  let low = 0;
  let high = 2 * Math.PI * 20;

  let t = high / 2;

  for (let i = 0; i < 10_000; i++) {
    const currentL = arcLength(t);
    if (Math.abs(currentL - targetL) < tolerance) break;

    // current value is bigger than we want to find - narrow search down
    if (currentL > targetL) {
      high = t;

      const interval = high - low;
      t = low + interval / 2;
    } else {
      // current value is smaller than we want to find - narrow search up
      low = t;
      const interval = high - low;
      t = low + interval / 2;
    }
  }
  return t;
};

// @ts-ignore
window.findT = findT;

const sketch = (p: p5) => {
  const totalArcLength = arcLength(2 * Math.PI * 20);
  const thetaStart = Math.PI * 8;
  const arcLengthStart = arcLength(thetaStart);

  let theta = thetaStart;

  p.setup = () => {
    p.createCanvas(C_WIDTH, C_HEIGHT);
    // @ts-ignore
    window.rotSpeed = rotSpeed;
    // @ts-ignore
    window.arcLength = arcLength;
  };

  p.draw = () => {
    p.stroke("black");
    p.strokeWeight(1);
    p.translate(C_WIDTH / 2, C_HEIGHT / 2);

    const v1 = p.createVector(p.cos(theta), p.sin(theta));
    v1.mult(getDist(theta));

    theta += Math.PI / 30;
    // theta += rotSpeed(theta);

    const v2 = p.createVector(p.cos(theta), p.sin(theta));
    v2.mult(getDist(theta));

    p.line(v1.x, v1.y, v2.x, v2.y);

    p.stroke("purple");
    p.strokeWeight(5);

    // for (
    //   let i = arcLengthStart;
    //   i < totalArcLength;
    //   i += (totalArcLength - arcLengthStart) / ado.beats.length
    // ) {
    //   console.log(i);
    //   const t = findT(i);
    //   const v = p.createVector(p.cos(t), p.sin(t));
    //   v.mult(getDist(t));
    //   p.point(v.x, v.y);
    // }

    if (theta > 2 * Math.PI * 20) p.noLoop();
  };
};

const sketch2 = (p: p5) => {
  const rec = new Record(ado);

  p.setup = () => {
    p.createCanvas(C_WIDTH, C_HEIGHT);
  };

  p.draw = () => {
    p.background("white");
    p.translate(C_WIDTH / 2, C_HEIGHT / 2);
    rec.draw(p);
  };
};

new p5(sketch2, containerElement);
