import p5 from "p5";
import { getAnalysis, getFeatures, getProgress, PlaybackState } from "./api";
import { Record } from "./Record";

const C_WIDTH = 1200;
const C_HEIGHT = 1200;

export class Scene {
  private static P5_CONTAINER_NAME = "p5-container";

  private p5Instance: p5 | null;
  private playbackState: PlaybackState | null;
  private lastPlaybackUpdate: number = new Date().getTime();
  private p5ContainerEl: HTMLElement;
  private noPlaybackEl: HTMLElement;
  private authToken: string;

  constructor(authToken: string) {
    this.authToken = authToken;
    this.p5ContainerEl = document.getElementById(Scene.P5_CONTAINER_NAME)!;
    this.noPlaybackEl = document.getElementById("no-playback")!;

    this.p5Instance = null;
    this.playbackState = null;

    this.syncPlaybackState().then(() => {
      console.log("he");
      setInterval(() => this.syncPlaybackState(), 5000);
    });
  }

  private async syncPlaybackState() {
    const prevPlaybackState = this.playbackState;

    this.playbackState = await getProgress(this.authToken);
    this.lastPlaybackUpdate = new Date().getTime();

    if (!prevPlaybackState && !this.playbackState) {
      // do nothing
      return;
    }

    // user just started playback
    if (!prevPlaybackState && this.playbackState) {
      this.noPlaybackEl.style.display = "none";
      this.start();
      return;
    }
    // user just stopped playback
    if (prevPlaybackState && !this.playbackState) {
      this.p5Instance?.remove();
      this.noPlaybackEl.style.display = "block";
      return;
    }

    // look for changes in uri and maybe start new sketch
    if (prevPlaybackState?.uri !== this.playbackState?.uri) {
      // start new scene
      this.p5Instance?.remove();
      this.start();
    }
  }

  private async start() {
    if (!this.playbackState) throw new Error("shouldnt happen");

    let progressPct =
      (this.playbackState.progressMs + 20) / this.playbackState.durationMs;

    const analysis = await getAnalysis(this.authToken, this.playbackState.uri);
    const features = await getFeatures(this.authToken, this.playbackState.uri);

    const sketch = (p: p5) => {
      const rec = new Record(p, analysis, features);

      p.setup = () => {
        p.createCanvas(C_WIDTH, C_HEIGHT);
        p.colorMode(p.RGB);
      };

      p.draw = () => {
        const now = new Date().getTime();
        const diff = now - this.lastPlaybackUpdate;

        if (this.playbackState) {
          progressPct =
            (this.playbackState.progressMs + diff) /
            this.playbackState.durationMs;
        }

        p.translate(C_WIDTH / 2, C_HEIGHT / 2);
        rec.drawPct(p, progressPct);
      };
    };

    this.p5Instance = new p5(sketch, this.p5ContainerEl);
  }
}
