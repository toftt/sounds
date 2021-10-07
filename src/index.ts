import p5 from "p5";
import axios from "axios";
import { getWebApiToken } from "./auth";
import { Record } from "./Record";
import { AudioFeatures, RawAudioAnalysis } from "./AudioAnalysis";
import { ColorPalette } from "./ColorPalette";

const containerElement = document.getElementById("p5-container") ?? undefined;

const C_WIDTH = 1200;
const C_HEIGHT = 1200;

const getAnalysis = async (token: string, uri: string) => {
  const id = uri.split(":")[2];
  const { data } = await axios.get<RawAudioAnalysis>(
    `https://api.spotify.com/v1/audio-analysis/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return data;
};

const getFeatures = async (token: string, uri: string) => {
  const id = uri.split(":")[2];
  const { data } = await axios.get<AudioFeatures>(
    `https://api.spotify.com/v1/audio-features/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return data;
};

interface Progress {
  progressMs: number;
  durationMs: number;
  uri: string;
  timestamp: number;
}

// const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
const getProgress = async (token: string) => {
  const response = await axios.get<{
    progress_ms: number;
    item: { duration_ms: number; uri: string };
    timestamp: number;
  }>("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 204) {
    return null;
  }

  const { data } = response;
  return {
    progressMs: data.progress_ms,
    durationMs: data.item.duration_ms,
    uri: data.item.uri,
    timestamp: data.timestamp,
  };
};

const main = async () => {
  const token = await getWebApiToken();

  // const uri = ELLIOT;
  // const analysis = await getAnalysis(token, uri);

  // await axios.put(
  //   "https://api.spotify.com/v1/me/player/play",
  //   {
  //     uris: [uri],
  //   },
  //   { headers: { Authorization: `Bearer ${token}` } }
  // );
  // await wait(200);

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

const startScene = async (progress: Progress, token: string) => {
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
      p.frameRate(60);
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

  new p5(sketch, containerElement);
  drawColorPalette(features);
};

main();

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
