import p5 from "p5";
import { getWebApiToken } from "./auth";
import { Record } from "./Record";
import { AudioFeatures } from "./AudioAnalysis";
import { ColorPalette } from "./ColorPalette";
import { getAnalysis, getFeatures, getProgress, PlaybackState } from "./api";
import { Scene } from "./Scene";

const containerElement = document.getElementById("p5-container") ?? undefined;

const C_WIDTH = 1200;
const C_HEIGHT = 1200;

const main = async () => {
  const token = await getWebApiToken();

  let progress = await getProgress(token);
  console.log({ progress });

  if (progress) {
    startScene(progress, token);
  } else {
    waitingToPlay();
    const intervalId = setInterval(async () => {
      progress = await getProgress(token);
      if (progress) {
        const waitTextEl = document.getElementById("wait-text");
        waitTextEl?.remove();
        startScene(progress, token);
        clearInterval(intervalId);
      }
    }, 5_000);
  }
};

const startScene = async (progress: PlaybackState, token: string) => {
  const startTimestamp = new Date().getTime();

  let progressPct = (progress.progressMs + 20) / progress.durationMs;

  const frameRateContainer = document.getElementById("frame-rate");
  let frameRate = "0";

  setInterval(() => {
    if (frameRateContainer) {
      frameRateContainer.textContent = `${frameRate}`;
    }
  }, 1000);

  const analysis = await getAnalysis(token, progress.uri);
  const features = await getFeatures(token, progress.uri);
  const sketch = (p: p5) => {
    const rec = new Record(p, analysis, features);

    p.setup = () => {
      p.createCanvas(C_WIDTH, C_HEIGHT);
      p.colorMode(p.RGB);
    };

    p.draw = () => {
      frameRate = p.frameRate().toFixed(1);

      const now = new Date().getTime();
      const diff = now - startTimestamp;

      progressPct = (progress.progressMs + diff) / progress.durationMs;

      p.translate(C_WIDTH / 2, C_HEIGHT / 2);
      rec.drawPct(p, progressPct);
    };
  };

  const p5Instance = new p5(sketch, containerElement);
  drawColorPalette(features);
};

// main();

function drawColorPalette(features: AudioFeatures) {
  const colPal = new ColorPalette(features);
  const colorSamplesContainer = document.getElementById("color-samples");
  const mainColorContainer = document.getElementById("key-colors");

  for (const color of colPal.keyColors) {
    const div = document.createElement("div");
    div.classList.add("color-sample");

    div.style.backgroundColor = `rgb(${color.red()}, ${color.green()}, ${color.blue()})`;
    console.log(color);

    mainColorContainer?.appendChild(div);
  }

  for (let i = 0; i < 16; i++) {
    const div = document.createElement("div");
    div.classList.add("color-sample");

    const color = colPal.sampleColor();

    div.style.backgroundColor = `rgb(${color.red()}, ${color.green()}, ${color.blue()})`;

    colorSamplesContainer?.appendChild(div);
  }
}

function waitingToPlay() {
  const div = document.createElement("div");
  div.textContent = "Start playing a track in Spotify to get started...";
  div.id = "wait-text";
  containerElement?.appendChild(div);
}

async function main2() {
  const token = await getWebApiToken();
  new Scene(token);
}

main2();
