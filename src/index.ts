import p5 from "p5";
import axios from "axios";
import { getWebApiToken } from "./auth";
import { Record } from "./Record";
import ado from "./songs/ado.json";
import industry from "./songs/industry.json";
import { RawAudioAnalysis } from "./AudioAnalysis";

const containerElement = document.getElementById("p5-container") ?? undefined;

const C_WIDTH = 800;
const C_HEIGHT = 800;

const ELLIOT = "spotify:track:0Ziohm1Ku8E2yUDYoclfhO";
const ADO = "spotify:track:7z6qHGEKxRtwtYym2epV7l";

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

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
const getProgress = async (token: string) => {
  const { data } = await axios.get<{
    progress_ms: number;
    item: { duration_ms: number; uri: string };
  }>("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log(data);
  return {
    progressMs: data.progress_ms,
    durationMs: data.item.duration_ms,
    uri: data.item.uri,
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
  await wait(200);

  const { progressMs, durationMs, uri } = await getProgress(token);

  const startTimestamp = new Date().getTime();

  let progressPct = (progressMs + 20) / durationMs;

  const analysis = await getAnalysis(token, uri);
  const sketch = (p: p5) => {
    const rec = new Record(analysis);

    p.setup = () => {
      p.createCanvas(C_WIDTH, C_HEIGHT);
      p.colorMode(p.HSB);
    };

    p.draw = () => {
      const now = new Date().getTime();
      const diff = now - startTimestamp;

      progressPct = (progressMs + diff) / durationMs;

      p.translate(C_WIDTH / 2, C_HEIGHT / 2);
      rec.drawPct(p, progressPct);
    };
  };

  new p5(sketch, containerElement);
};

main();
