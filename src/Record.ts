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
  }

  /**
   * TODO:
   *
   * (performance) Use binary search for the pulse function
   *
   */
  public drawPct(p: p5, pct: number) {
    /**
     * Draw the prerendered assets out.
     */

    // Draw prerendered gradient background.
    p.image(this.background, 0, 0);

    // Transform coordinate system to be centered in the middle.
    p.translate(p.width / 2, p.height / 2);

    // Scale up sketch based on how close we are to a beat.
    this.pulse(p, pct);

    // Slowly rotate the sketch.
    p.rotate(pct * Math.PI * 4);

    // Draw the things that never change based on where in the song we are. This includes
    // the black background, the initial spiraling and the small segment dots.
    p.image(this.fixedBuffer, -p.width / 2, -p.height / 2);

    // The current part of the song. A number between 0 and `Record.BUFFER_SECTIONS`.
    const currentPart = Math.floor(pct * Record.BUFFER_SECTIONS);

    // Render up until the current part of the prerendered sections.
    for (let i = 0; i < currentPart; i++) {
      p.image(this.sectionBuffers[i], -p.width / 2, -p.height / 2);
    }

    /**
     * Draw the traveling line.
     *
     * The prerendered sections takes care of all the previous parts of the song,
     * but we still need to render the current part in realtime.
     */

    // Get theta values for the current part of the song.
    const { thetaStart, thetaEnd } = this.getThetaForPart(currentPart);

    p.strokeWeight(1);
    let theta = thetaStart;
    while (theta < thetaEnd) {
      const start = this.getPointVector(theta);
      theta += Math.min(Record.THETA_DELTA_MAX, this.thetaDelta(theta));

      const end = this.getPointVector(theta);

      p.stroke(150, 150, 150);

      // If the progress represented by the theta value is larger than the actual progress
      // of the animation, we should stop drawing.
      if (this.getProgressPct(theta) > pct) break;

      p.line(start.x, start.y, end.x, end.y);
    }

    /**
     * Draw the traveling dot.
     */
    p.strokeWeight(Record.SEGMENT_STROKE_WIDTH + 1);

    // The `t` value here is the where the current point lies between the current segment
    // and the next. A value between 0 and 1.
    const [curSeg, nextSeg, t] = this.findBounds(pct);

    // Find the theta value for the currently active segment and the next segment.
    const curTheta = this.findThetaPct(curSeg.progressPct);
    const nextTheta = this.findThetaPct(nextSeg.progressPct);

    // Get the positions of these segment markers in the sketch. Offset
    // by average pitch, so make the segments look something like notes.
    const v1 = this.getPointVector(curTheta, curSeg.avgPitch);
    const v2 = this.getPointVector(nextTheta, nextSeg.avgPitch);

    const c1 = p.color(curSeg.color.rgb().array());
    const c2 = p.color(nextSeg.color.rgb().array());

    // Lerp color based on where we are.
    const dotColor = p.lerpColor(c1, c2, t);
    p.stroke(dotColor);

    const lerped = Vector.lerp(v1, v2, t);

    const lerpedTheta = p.lerp(curTheta, nextTheta, t);

    // Check if the point we're about the render lies outside of the current loop
    // of the spiral. If it does not, fix it at the line instead.
    if (lerped.mag() > this.getDistance(lerpedTheta)) {
      p.point(lerped.x, lerped.y);
    } else {
      const vv = this.getPointVector(lerpedTheta);
      p.point(vv.x, vv.y);
    }

    /**
     * Draw the segments.
     */
    const partPctLength = 1 / Record.BUFFER_SECTIONS;
    const pctStart = currentPart * partPctLength;

    for (const segment of this.analysis.segments) {
      // Skip all segments that lie before the current part.
      if (segment.progressPct < pctStart) continue;
      // Skip all segments that lie after the current part ends.
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
  }

  /**
   * Side-effects galore. Prerenders and populates `this.background`, `this.fixedBuffer` and
   * `this.sectionBuffers` with the graphics needed.
   *
   * @param p The p5 instance of the current sketch.
   */
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

  /**
   * Draws a gradient based on the key colors of the Records color palette.
   *
   * @param g Buffer to draw into.
   */
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

  /**
   * Renders the segments for a part into g.
   *
   * @param g The buffer to draw into.
   * @param part The part to draw.
   */
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

  /**
   * Draws the segments that stay fixed throughout the animation.
   *
   * @param g The buffer to draw into.
   */
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

  /**
   * Draws the spiral for the start up to a specific part.
   *
   * @param g The buffer to draw into.
   * @param part The part to draw.
   */
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

  /**
   * Draws the spiral that stays fixed throughout the animation.
   *
   * @param g The buffer to draw into.
   */
  private prerenderSpiral(g: Graphics) {
    // The outer circle.
    g.fill(30, 30, 30);
    g.circle(0, 0, this.getDistance(this.thetaEnd) * 2);

    // The inner circle.
    g.stroke(200, 200, 200);
    g.strokeWeight(1);
    g.noFill();
    g.circle(0, 0, this.getDistance(this.thetaStart) * 2);

    // Text
    g.rectMode(g.CENTER);
    g.textAlign(g.CENTER);
    g.textSize(24);
    g.text(this.name, 0, 0, 150, 150);
    g.textSize(16);
    g.text(this.artist, 0, 100, 100, 100);
    g.rectMode(g.CORNER);

    // The actual spiral (nice function name).
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

  /**
   * Calculates the start and end theta value for a part of the song.
   *
   * @param part The part of the song.
   * @returns Start and end theta value for the part of the song.
   */
  private getThetaForPart(part: number) {
    const partArcLength = this.totalArcLength / Record.BUFFER_SECTIONS;
    const partArcStart = this.arcLengthStart + partArcLength * part;
    const partArcEnd = partArcStart + partArcLength;

    const thetaStart = this.findTheta(partArcStart);
    const thetaEnd = this.findTheta(partArcEnd);

    return { thetaStart, thetaEnd };
  }

  /**
   * Rescales p based on how close the current point is to a beat.
   *
   * @param p The p5 instance.
   * @param pct The progress percentage of the animation.
   *
   * TODO: use binary search for this function
   */
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

  /**
   * Returns a scale factor based on a distance. Peaks at 0. Increases
   * from -150 to 0, decreases from 0 to 150. Also factors in the confidence
   * of the beat -- generally stronger beats will make the record pulse (or bump)
   * more intensly.
   *
   * @param distToClosestBeat The distance to the closest beat.
   * @param confidence The confidence that that beat is correctly analyzed.
   * @returns A scale factor that gets bigger the closer the distance is.
   */
  private bump(distToClosestBeat: number, confidence: number) {
    const f = (t: number) => (t <= 0 ? 0 : Math.pow(Math.E, -1 / t));
    const g = (t: number) => f(t) / (f(t) + f(1 - t));
    const h = (t: number) => g(t + 0.1);
    const k = (t: number) => h(Math.pow(t, 2));
    const p = (t: number) => 0.01 * (1 - k(t));
    const o = (t: number) => p(t / 150) + 1;

    const scaleUp = (o(distToClosestBeat) - 1) * confidence;

    return 1 + scaleUp;
  }

  /**
   * Converts a theta value to a percentage.
   *
   * @param theta The theta value.
   * @returns A percentage progress value.
   */
  private getProgressPct(theta: number) {
    return (this.arcLength(theta) - this.arcLengthStart) / this.totalArcLength;
  }

  /**
   * Get the position where a line or point should be drawn based on theta and
   * offset.
   *
   * @param theta The theta value.
   * @param offset How far off the normal point the point should be offset
   * @returns A vector representing a 2D position.
   */
  private getPointVector(theta: number, offset: number = 0): Vector {
    const v = new Vector();
    v.set(Math.cos(theta), Math.sin(theta));
    v.mult(this.getDistance(theta) + offset);

    return v;
  }

  /**
   * Get the arc length of the spiral up until theta.
   */
  private arcLength(theta: number) {
    const sq = Math.sqrt(Math.pow(theta, 2) + 1) * theta;
    return (1 / 2) * this.a * (sq + Math.asinh(theta));
  }

  /**
   * The closer to the center we are, the more lines generally needs to
   * be drawn in order to make the spiral smooth. This function takes a
   * theta value and returns the amount that theta should be increased
   * before the next line is drawn.
   *
   * I can't be bothered to remember this right now, but I think the higher
   * `Record.PRECISION` is, the less detailed (less lines drawn) the spiral
   * will be.
   */
  private thetaDelta(theta: number) {
    // TODO: figure out if this should this depend on `this.a`
    return Record.PRECISION / (2 * Math.PI * theta);
  }

  /**
   * Archimedian spiral function.
   * Get the distance (r) for a given theta.
   */
  private getDistance(theta: number) {
    return this.a + this.b * theta;
  }

  /**
   * Get the theta value that represents a given progress percentage
   * of the animation.
   */
  private findThetaPct(percentage: number) {
    const pctArcLength = this.totalArcLength * percentage;
    const targetArcLength = this.arcLengthStart + pctArcLength;

    return this.findTheta(targetArcLength);
  }

  /**
   * Numerical approximation for the inverse of the `arcLength` function, that is,
   * given an arc length, find the theta value that would produce that value.
   *
   */
  private findTheta(targetArcLength: number, tolerance: number = 0.1) {
    let low = 0;
    let high = this.thetaEnd;

    let t = high / 2;

    for (let i = 0; i < 10_000; i++) {
      const currentL = this.arcLength(t);
      if (Math.abs(currentL - targetArcLength) < tolerance) break;

      // Current value is bigger than we want to find - narrow search down.
      if (currentL > targetArcLength) {
        high = t;

        const interval = high - low;
        t = low + interval / 2;
      } else {
        // Current value is smaller than we want to find - narrow search up.
        low = t;
        const interval = high - low;
        t = low + interval / 2;
      }
    }
    return t;
  }

  /**
   * Given a progress percentage, find the two segments which the current
   * percentage lies in between, and where in between it is.
   *
   * @returns [currentSegment, nextSegment, t], where t is a value from 0 to 1
   */
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

    throw new Error("couldnt find thing");
  }
}
