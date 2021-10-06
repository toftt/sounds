import Color from "color";
import { alea } from "seedrandom";
import { AudioAnalysis, AudioFeatures } from "./AudioAnalysis";
import { remap } from "./utils";

const add = (c1: Color, c2: Color) => {
  const a1 = c1.rgb().array();
  const a2 = c2.rgb().array();

  return Color.rgb(...a1.map((v, idx) => v + a2[idx]));
};

const mult = (c1: Color, t: number) => {
  const a1 = c1.rgb().array();

  return Color.rgb(...a1.map((v) => v * t));
};

export class ColorPalette {
  private readonly random: ReturnType<typeof alea>;
  public readonly keyColors: [Color, Color, Color];

  constructor(features: AudioFeatures) {
    this.random = alea(features.uri);

    const hue1 = features.danceability * 360;
    const hue2 = features.energy * 360;
    const hue3 = remap(features.key, 0, 11, 0, 360);

    const saturation = 25 + features.valence * 75;
    const lightness = 50 + features.acousticness * 25;

    this.keyColors = [
      Color.hsl(hue1, saturation, lightness),
      Color.hsl(hue2, saturation, lightness),
      Color.hsl(hue3, saturation, lightness),
    ];
  }

  public sampleColor(): Color {
    const r1 = this.random();
    const r2 = this.random();

    const f1 = 1 - Math.sqrt(r1);
    const f2 = Math.sqrt(r1) * (1 - r2);
    const f3 = r2 * Math.sqrt(r1);

    const c1 = mult(this.keyColors[0], f1);
    const c2 = mult(this.keyColors[1], f2);
    const c3 = mult(this.keyColors[2], f3);

    return add(add(c1, c2), c3);
  }
}
