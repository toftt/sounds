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
  private static readonly SEGMENT_STROKE_WIDTH: number = 3;
  private static readonly DEFAULT_OPTIONS = {
    a: 1,
    b: Math.PI / 1.5,
    thetaStart: Math.PI * 16,
    rotations: 28,
  };

  private readonly analysis: AudioAnalysis;
  private readonly a: number;
  private readonly b: number;
  private readonly thetaStart: number;

  private readonly name: string;
  private readonly artist: string;

  private readonly thetaEnd: number;
  private readonly arcLengthStart: number;
  private readonly arcLengthEnd: number;
  private readonly totalArcLength: number;

  private scale: number = 1;

  /** pre-buffered graphics */
  // @ts-ignore
  background: Graphics;
  // @ts-ignore
  fixedBuffer: Graphics;
  // @ts-ignore
  sectionBuffers: Graphics[];

  constructor(
    p: p5,
    info: { name: string; artist: string },
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

    this.name = info.name;
    this.artist = info.artist;

    this.prerender(p);

    console.log(this);
  }

  /**
   * TODO:
   *
   * Name of song in middle?
   * Refetch the play state every few seconds
   * Figure out some colors for the lines?
   * (performance) Use binary search for the pulse function
   * Add background?
   * Dynamic canvas size
   *
   */
  public drawPct(p: p5, pct: number) {
    p.background("white");
    p.image(this.background, 0, 0);

    p.translate(p.width / 2, p.height / 2);
    const currentPart = Math.floor(pct * Record.BUFFER_SECTIONS);
    this.pulse(p, pct);

    p.rotate(pct * Math.PI * 4);

    // draw spiral background
    p.image(this.fixedBuffer, -p.width / 2, -p.height / 2);

    for (let i = 0; i < currentPart; i++) {
      p.image(this.sectionBuffers[i], -p.width / 2, -p.height / 2);
    }

    // divide song in 10 parts (0-9)
    const part = Math.floor(pct * Record.BUFFER_SECTIONS);
    const partArcLength = this.totalArcLength / Record.BUFFER_SECTIONS;
    const partArcStart = this.arcLengthStart + partArcLength * part;
    const partArcEnd = partArcStart + partArcLength;

    const partThetaStart = this.findTheta(partArcStart);
    const partThetaEnd = this.findTheta(partArcEnd);

    p.strokeWeight(1);
    let theta = partThetaStart;
    while (theta < partThetaEnd) {
      const start = this.getPointVector(theta);
      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = this.getPointVector(theta);

      // const sectionColor = this.getCurrentSectionColor(theta);
      // p.stroke(sectionColor, 150, 150);
      p.stroke(150, 150, 150);

      if (this.getProgressPct(theta) < pct) {
        p.line(start.x, start.y, end.x, end.y);
      }
    }

    p.strokeWeight(Record.SEGMENT_STROKE_WIDTH + 1);

    const [curSeg, nextSeg, t] = this.findBounds(pct);

    const t1 = this.findThetaPct(curSeg.progressPct);
    const t2 = this.findThetaPct(nextSeg.progressPct);

    const v1 = this.getPointVector(t1, curSeg.avgPitch);
    const v2 = this.getPointVector(t2, nextSeg.avgPitch);

    const c1 = p.color(curSeg.color.rgb().array());
    const c2 = p.color(nextSeg.color.rgb().array());

    const dotColor = p.lerpColor(c1, c2, t);
    p.stroke(dotColor);

    const lerped = Vector.lerp(v1, v2, t);

    const lerpedT = p.lerp(t1, t2, t);
    if (lerped.mag() > this.getDistance(lerpedT)) {
      p.point(lerped.x, lerped.y);
    } else {
      const vv = this.getPointVector(lerpedT);
      p.point(vv.x, vv.y);
    }

    // draw segments
    const partPctLength = 1 / Record.BUFFER_SECTIONS;
    const pctStart = part * partPctLength;

    for (const segment of this.analysis.segments) {
      if (segment.progressPct < pctStart) continue;
      if (segment.progressPct > pct) break;

      const t = this.findThetaPct(segment.progressPct);
      const v = this.getPointVector(t, segment.avgPitch);

      p.stroke(
        segment.color.red(),
        segment.color.green(),
        segment.color.blue()
      );
      p.strokeWeight(Record.SEGMENT_STROKE_WIDTH * segment.relativeLoudness);
      p.point(v.x, v.y);
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
  }

  public prerender(p: p5) {
    this.background = p.createGraphics(p.width, p.height);
    this.gradient(this.background);

    this.fixedBuffer = p.createGraphics(p.width, p.height);
    this.fixedBuffer.translate(p.width / 2, p.height / 2);

    this.prerenderSpiral(this.fixedBuffer);
    this.prerenderFixedSegments(this.fixedBuffer);

    this.sectionBuffers = [];
    for (let part = 0; part < Record.BUFFER_SECTIONS; part++) {
      const g = p.createGraphics(p.width, p.height);
      g.translate(p.width / 2, p.height / 2);

      this.prerenderSpiralSection(g, part);
      this.prerenderSegmentsForPart(g, part);

      this.sectionBuffers.push(g);
    }
  }

  private gradient(g: Graphics) {
    for (let i = 0; i < g.width; i += 30) {
      for (let j = 0; j < g.height; j += 30) {
        const c1 = g.color(
          this.analysis.colorPalette.keyColors[0].rgb().array()
        );
        const c2 = g.color(
          this.analysis.colorPalette.keyColors[1].rgb().array()
        );
        const c3 = g.color(
          this.analysis.colorPalette.keyColors[2].rgb().array()
        );

        const tw = i / g.width;
        const th = j / g.height;

        const colorTmp = g.lerpColor(c1, c2, tw);
        const color = g.lerpColor(colorTmp, c3, th);
        g.stroke(color);
        g.fill(color);
        g.square(i, j, 30);
      }
    }
  }

  private prerenderSegmentsForPart(g: Graphics, part: number) {
    const partPctLength = 1 / Record.BUFFER_SECTIONS;
    const pctStop = part * partPctLength + partPctLength;

    for (const segment of this.analysis.segments) {
      if (segment.progressPct > pctStop) break;

      const t = this.findThetaPct(segment.progressPct);
      const v = this.getPointVector(t, segment.avgPitch);

      g.stroke(
        segment.color.red(),
        segment.color.green(),
        segment.color.blue()
      );
      g.strokeWeight(Record.SEGMENT_STROKE_WIDTH * segment.relativeLoudness);
      g.point(v.x, v.y);
    }
  }

  private prerenderFixedSegments(g: Graphics) {
    for (const segment of this.analysis.segments) {
      // if (segment.confidence < 0.2) continue;

      const t = this.findThetaPct(segment.progressPct);
      const v = this.getPointVector(t, segment.avgPitch);

      g.stroke(
        segment.color.red(),
        segment.color.green(),
        segment.color.blue()
      );
      g.strokeWeight(2);

      g.point(v.x, v.y);
    }
  }

  private prerenderSpiralSection(g: Graphics, part: number) {
    const partArcLength = this.totalArcLength / Record.BUFFER_SECTIONS;
    const partArcStart = this.arcLengthStart + partArcLength * part;
    const partArcEnd = partArcStart + partArcLength;

    const partThetaEnd = this.findTheta(partArcEnd);

    g.strokeWeight(1);
    let theta = this.thetaStart;
    while (theta < partThetaEnd) {
      const start = this.getPointVector(theta);
      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = this.getPointVector(theta);

      g.stroke(150, 150, 150);

      g.line(start.x, start.y, end.x, end.y);
    }
  }

  private prerenderSpiral(g: Graphics) {
    // g.strokeWeight(2);
    // g.stroke(200, 200, 200);

    // outer circle
    g.fill(30, 30, 30);
    g.circle(0, 0, this.getDistance(this.thetaEnd) * 2);

    // inner circle
    g.stroke(200, 200, 200);
    g.strokeWeight(1);
    g.noFill();
    g.circle(0, 0, this.getDistance(this.thetaStart) * 2);

    // text
    g.rectMode(g.CENTER);
    g.textAlign(g.CENTER);
    g.textSize(24);
    g.text(this.name, 0, 0, 150, 150);
    g.textSize(16);
    g.text(this.artist, 0, 100, 100, 100);
    g.rectMode(g.CORNER);

    g.strokeWeight(1);
    let theta = this.thetaStart;
    while (theta < this.thetaEnd) {
      const start = this.getPointVector(theta);
      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = this.getPointVector(theta);
      g.stroke(150, 150, 150);
      g.line(start.x, start.y, end.x, end.y);
    }
  }

  private getThetaForPart(part: number) {
    const partArcLength = this.totalArcLength / Record.BUFFER_SECTIONS;
    const partArcStart = this.arcLengthStart + partArcLength * part;
    const partArcEnd = partArcStart + partArcLength;

    const thetaStart = this.findTheta(partArcStart);
    const thetaEnd = this.findTheta(partArcEnd);

    return { thetaStart, thetaEnd };
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
