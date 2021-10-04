import p5 from "p5";
import { AudioAnalysis } from "./types";

interface RecordOptions {
  /** Moves the centerpoint  of the spiral outward from the origin */
  a?: number;
  /** Controls the distance between loops */
  b?: number;
  /** Controls where the spiral should start. Every 2*PI is one rotation. */
  thetaStart?: number;
  /** Determines how many full rotations the spiral should do before stopping */
  rotations?: number;
}

export class Record {
  private static readonly THETA_DELTA_MAX: number = (2 * Math.PI) / 180;
  private static readonly PRECISION: number = 20;
  private static readonly DEFAULT_OPTIONS = {
    a: 1,
    b: Math.PI,
    thetaStart: Math.PI * 8,
    rotations: 20,
  };

  private readonly rotations: number;
  private readonly a: number;
  private readonly b: number;
  private readonly thetaStart: number;

  constructor(analysis: AudioAnalysis, options: RecordOptions = {}) {
    const { a, b, thetaStart, rotations } = {
      ...Record.DEFAULT_OPTIONS,
      ...options,
    };

    this.a = a;
    this.b = b;
    this.thetaStart = thetaStart;
    this.rotations = rotations;
  }

  public draw(p: p5) {
    let theta = this.thetaStart;

    p.stroke("black");
    p.strokeWeight(1);

    while (theta < this.rotations * 2 * Math.PI) {
      const start = p.createVector(Math.cos(theta), Math.sin(theta));
      start.mult(this.getDistance(theta));

      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = p.createVector(Math.cos(theta), Math.sin(theta));
      end.mult(this.getDistance(theta));

      p.line(start.x, start.y, end.x, end.y);
    }
  }

  private arcLength(t: number) {
    const sq = Math.sqrt(Math.pow(t, 2) + 1) * t;
    return (1 / 2) * this.a * (sq + Math.asinh(t));
  }

  private thetaDelta(t: number) {
    // TODO: figure out if this should this depend on `this.a`
    return Record.PRECISION / (2 * Math.PI * t);
  }

  /**
   * Get the distance (r).
   */
  private getDistance(t: number) {
    return this.a + this.b * t;
  }

  /**
   * Numerical approximation for the inverse of the `arcLength` function, that is,
   * given an arc length, find the theta value that would produce that value.
   */
  private findTheta(targetArcLength: number, tolerance: number = 0.1) {
    let low = 0;
    // TODO: Replace hardcoded value
    let high = 2 * Math.PI * this.rotations;

    let t = high / 2;

    for (let i = 0; i < 10_000; i++) {
      const currentL = this.arcLength(t);
      if (Math.abs(currentL - targetArcLength) < tolerance) break;

      // current value is bigger than we want to find - narrow search down
      if (currentL > targetArcLength) {
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
  }
}
