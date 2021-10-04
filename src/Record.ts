import p5, { Vector } from "p5";
import {
  AudioAnalysis,
  processRawAnalysis,
  RawAudioAnalysis,
} from "./AudioAnalysis";

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

  private readonly analysis: AudioAnalysis;
  private readonly a: number;
  private readonly b: number;
  private readonly thetaStart: number;

  private readonly thetaEnd: number;
  private readonly arcLengthStart: number;
  private readonly arcLengthEnd: number;
  private readonly totalArcLength: number;

  constructor(analysis: RawAudioAnalysis, options: RecordOptions = {}) {
    const { a, b, thetaStart, rotations } = {
      ...Record.DEFAULT_OPTIONS,
      ...options,
    };

    this.a = a;
    this.b = b;
    this.thetaStart = thetaStart;
    this.analysis = processRawAnalysis(analysis);

    this.thetaEnd = rotations * 2 * Math.PI;
    this.arcLengthStart = this.arcLength(this.thetaStart);
    this.arcLengthEnd = this.arcLength(this.thetaEnd);
    this.totalArcLength = this.arcLengthEnd - this.arcLengthStart;

    console.log(this);
  }

  public drawPct(p: p5, pct: number) {
    let theta = this.thetaStart;

    p.background("gray");
    p.stroke("white");
    p.strokeWeight(1);

    while (theta < this.thetaEnd) {
      const start = this.getPointVector(theta);
      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = this.getPointVector(theta);
      p.line(start.x, start.y, end.x, end.y);
    }

    p.stroke("purple");
    p.strokeWeight(4);

    for (const beat of this.analysis.beats) {
      const t = this.findThetaPct(beat.progressPct);
      const v = this.getPointVector(t);

      if (beat.progressPct > pct) {
        p.strokeWeight(4);
      } else {
        p.strokeWeight(8);
      }

      p.point(v.x, v.y);
    }
  }

  public draw(p: p5) {
    let theta = this.thetaStart;

    p.stroke("black");
    p.strokeWeight(1);

    while (theta < this.thetaEnd) {
      const start = this.getPointVector(theta);
      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = this.getPointVector(theta);
      p.line(start.x, start.y, end.x, end.y);
    }

    p.stroke("purple");
    p.strokeWeight(4);

    for (const beat of this.analysis.beats) {
      const t = this.findThetaPct(beat.progressPct);
      const v = this.getPointVector(t);

      p.point(v.x, v.y);
    }
  }

  private getPointVector(theta: number): Vector {
    const v = new Vector();
    v.set(Math.cos(theta), Math.sin(theta));
    v.mult(this.getDistance(theta));

    return v;
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

  private findThetaPct(percentage: number) {
    const pctArcLength = this.totalArcLength * percentage;
    const targetArcLength = this.arcLengthStart + pctArcLength;

    return this.findTheta(targetArcLength);
  }

  /**
   * Numerical approximation for the inverse of the `arcLength` function, that is,
   * given an arc length, find the theta value that would produce that value.
   */
  private findTheta(targetArcLength: number, tolerance: number = 0.1) {
    let low = 0;
    // TODO: Replace hardcoded value
    let high = this.thetaEnd;

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
