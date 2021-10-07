import p5, { Vector, Graphics } from "p5";
import {
  AudioAnalysis,
  AudioFeatures,
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
  private static readonly PRECISION: number = 80;
  private static readonly BUFFER_SECTIONS: number = 10;
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

  private scale: number = 1;

  /** pre-buffered graphics */
  private readonly spiralBuffer: Graphics;
  private readonly spiralBufferSecions: Graphics[];

  constructor(
    p: p5,
    analysis: RawAudioAnalysis,
    features: AudioFeatures,
    options: RecordOptions = {}
  ) {
    const { a, b, thetaStart, rotations } = {
      ...Record.DEFAULT_OPTIONS,
      ...options,
    };

    this.a = a;
    this.b = b;
    this.thetaStart = thetaStart;
    this.analysis = processRawAnalysis(analysis, features);

    this.thetaEnd = rotations * 2 * Math.PI;
    this.arcLengthStart = this.arcLength(this.thetaStart);
    this.arcLengthEnd = this.arcLength(this.thetaEnd);
    this.totalArcLength = this.arcLengthEnd - this.arcLengthStart;

    this.spiralBuffer = this.createSpiralBuffer(p);
    this.spiralBufferSecions = this.createSpiralSecions(p);

    console.log(this);
  }

  /**
   * TOMORROW:
   *
   * Name of song in middle?
   * Automatic reauth if request fails, or token expired
   * Display "Play something on Spotify..." if nothing is playing
   * Refetch the play state every few seconds
   * Figure out some colors for the lines?
   * (performance) Use binary search for the pulse function
   * Add background?
   * Ask #wasp to remove dev mode on the app.
   * Deploy to Github pages
   *
   */
  public drawPct(p: p5, pct: number) {
    const currentPart = Math.floor(pct * Record.BUFFER_SECTIONS);
    this.pulse(p, pct);

    p.rotate(pct * Math.PI * 4);
    p.background("white");

    // draw spiral background
    p.image(this.spiralBuffer, -600, -600);

    for (let i = 0; i < currentPart; i++) {
      p.image(this.spiralBufferSecions[i], -600, -600);
    }

    // p.strokeWeight(2);
    // let theta = this.thetaStart;
    // while (theta < this.thetaEnd) {
    //   const start = this.getPointVector(theta);
    //   theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

    //   const end = this.getPointVector(theta);

    //   // const sectionColor = this.getCurrentSectionColor(theta);
    //   // p.stroke(sectionColor, 150, 150);
    //   p.stroke(200, 200, 200);

    //   if (this.getProgressPct(theta) < pct) {
    //     p.line(start.x, start.y, end.x, end.y);
    //   }
    // }

    // divide song in 10 parts (0-9)
    const part = Math.floor(pct * 10);
    const partArcLength = this.totalArcLength / 10;
    const partArcStart = this.arcLengthStart + partArcLength * part;
    const partArcEnd = partArcStart + partArcLength;

    const partThetaStart = this.findTheta(partArcStart);
    const partThetaEnd = this.findTheta(partArcEnd);

    p.strokeWeight(2);
    let theta = partThetaStart;
    while (theta < partThetaEnd) {
      const start = this.getPointVector(theta);
      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = this.getPointVector(theta);

      // const sectionColor = this.getCurrentSectionColor(theta);
      // p.stroke(sectionColor, 150, 150);
      p.stroke(200, 200, 200);

      if (this.getProgressPct(theta) < pct) {
        p.line(start.x, start.y, end.x, end.y);
      }
    }

    p.strokeWeight(5);
    p.stroke("gray");

    const [curSeg, nextSeg, t] = this.findBounds(pct);

    const t1 = this.findThetaPct(curSeg.progressPct);
    const t2 = this.findThetaPct(nextSeg.progressPct);

    const v1 = this.getPointVector(t1, curSeg.avgPitch);
    const v2 = this.getPointVector(t2, nextSeg.avgPitch);

    const lerped = Vector.lerp(v1, v2, t);

    const lerpedT = p.lerp(t1, t2, t);
    if (lerped.mag() > this.getDistance(lerpedT)) {
      p.point(lerped.x, lerped.y);
    } else {
      const vv = this.getPointVector(lerpedT);
      p.point(vv.x, vv.y);
    }

    // p.stroke("black");
    // p.strokeWeight(4);

    // for (const beat of this.analysis.beats) {
    //   const t = this.findThetaPct(beat.progressPct);
    //   const v = this.getPointVector(t);

    //   if (beat.progressPct > pct) {
    //     p.strokeWeight(4);
    //   } else {
    //     p.strokeWeight(8);
    //   }

    //   p.point(v.x, v.y);
    // }

    // p.stroke("white");
    // for (const bar of this.analysis.bars) {
    //   const t = this.findThetaPct(bar.progressPct);
    //   const v = this.getPointVector(t);

    //   if (bar.progressPct > pct) {
    //     p.strokeWeight(2);
    //   } else {
    //     p.strokeWeight(5);
    //   }

    //   p.point(v.x, v.y);
    // }

    // p.stroke("gray");

    for (const segment of this.analysis.segments) {
      // if (segment.confidence < 0.2) continue;

      const t = this.findThetaPct(segment.progressPct);
      const v = this.getPointVector(t, segment.avgPitch);

      p.stroke(
        segment.color.red(),
        segment.color.green(),
        segment.color.blue()
      );
      if (segment.progressPct > pct) {
        p.strokeWeight(2);
      } else {
        p.strokeWeight(4 * segment.relativeLoudness);
      }

      p.point(v.x, v.y);
    }
  }

  private createSpiralSecions(p: p5) {
    const spiralSecions: Graphics[] = [];

    for (let part = 0; part < Record.BUFFER_SECTIONS; part++) {
      const partArcLength = this.totalArcLength / Record.BUFFER_SECTIONS;
      const partArcStart = this.arcLengthStart + partArcLength * part;
      const partArcEnd = partArcStart + partArcLength;

      const partThetaEnd = this.findTheta(partArcEnd);

      const g = p.createGraphics(1200, 1200);
      g.translate(600, 600);

      g.strokeWeight(2);
      let theta = this.thetaStart;
      while (theta < partThetaEnd) {
        const start = this.getPointVector(theta);
        theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

        const end = this.getPointVector(theta);

        g.stroke(200, 200, 200);

        g.line(start.x, start.y, end.x, end.y);
      }
      spiralSecions.push(g);
    }

    return spiralSecions;
  }

  private createSpiralBuffer(p: p5) {
    const g = p.createGraphics(1200, 1200);
    // TODO: remove hard coded width/height
    g.translate(600, 600);

    g.strokeWeight(2);
    g.stroke(200, 200, 200);
    g.circle(0, 0, this.getDistance(this.thetaEnd) * 2);
    g.circle(0, 0, this.getDistance(this.thetaStart) * 2);

    g.strokeWeight(1);
    let theta = this.thetaStart;
    while (theta < this.thetaEnd) {
      const start = this.getPointVector(theta);
      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = this.getPointVector(theta);
      g.stroke(200, 200, 200);
      g.line(start.x, start.y, end.x, end.y);
    }
    return g;
  }

  private pulse(p: p5, pct: number) {
    const progressMs = pct * this.analysis.track.duration * 1000;

    const distances = this.analysis.beats.map(({ startMs, confidence }) => {
      const dist = startMs - progressMs;
      const absDist = Math.abs(dist);

      return { dist, absDist, confidence };
    });

    distances.sort((a, b) => a.absDist - b.absDist);

    const closest = distances[0];

    p.scale(this.bump(closest.dist, closest.confidence) + 0.2);
  }

  private bump(x: number, confidence: number) {
    const f = (t: number) => (t <= 0 ? 0 : Math.pow(Math.E, -1 / t));
    const g = (t: number) => f(t) / (f(t) + f(1 - t));
    const h = (t: number) => g(t + 0.1);
    const k = (t: number) => h(Math.pow(t, 2));
    const p = (t: number) => 0.01 * (1 - k(t));
    const o = (t: number) => p(t / 150) + 1;

    const scaleUp = (o(x) - 1) * confidence;

    return 1 + scaleUp;
  }

  private getCurrentSectionColor(theta: number) {
    const progressPct = this.getProgressPct(theta);

    const step = 255 / this.analysis.sections.length;

    for (let i = 0; i < this.analysis.sections.length; i++) {
      const section = this.analysis.sections[i];

      if (
        progressPct > section.startProgressPct &&
        progressPct < section.endProgressPct
      ) {
        return (i + 1) * step;
      }
    }
    return 0;
  }

  private getProgressPct(theta: number) {
    return (this.arcLength(theta) - this.arcLengthStart) / this.totalArcLength;
  }

  private getPointVector(theta: number, offset: number = 0): Vector {
    const v = new Vector();
    v.set(Math.cos(theta), Math.sin(theta));
    v.mult(this.getDistance(theta) + offset);

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

  findBounds(progressPct: number) {
    const { segments } = this.analysis;
    const lastSegment = segments[segments.length - 1];

    if (lastSegment.progressPct < progressPct) {
      return <const>[lastSegment, lastSegment, 0.5];
    }

    let lo = 0;
    let hi = segments.length;

    let mid = Math.floor(hi / 2);

    for (let i = 0; i < 10_000; i++) {
      const cur = segments[mid];
      const next = segments[mid + 1];

      if (progressPct >= cur.progressPct && progressPct < next.progressPct) {
        const interval = next.startMs - cur.startMs;
        const pro =
          this.analysis.track.duration * 1000 * progressPct - cur.startMs;
        const t = pro / interval;

        return <const>[cur, next, t];
      }

      if (progressPct < cur.progressPct) {
        hi = mid;

        const interval = hi - lo;
        mid = lo + Math.floor(interval / 2);
      } else {
        lo = mid;

        const interval = hi - lo;
        mid = lo + Math.floor(interval / 2);
      }
    }

    console.log(progressPct);
    throw new Error("couldnt find thing");
  }
}
