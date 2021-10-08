import Color from "color";
import { ColorPalette } from "./ColorPalette";
import { remap } from "./utils";

export interface AudioFeatures {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  type: "audio_features";
  id: string;
  uri: string;
  track_href: string;
  analysis_url: string;
  duration_ms: number;
  time_signature: number;
}

export interface RawAudioAnalysis {
  bars: {
    start: number;
    duration: number;
    confidence: number;
  }[];
  beats: {
    start: number;
    duration: number;
    confidence: number;
  }[];
  meta: {
    analyzer_version: string;
    platform: string;
    detailed_status: string;
    status_code: number;
    timestamp: number;
    analysis_time: number;
    input_process: string;
  };
  sections: {
    start: number;
    duration: number;
    confidence: number;
    loudness: number;
    tempo: number;
    tempo_confidence: number;
    key: number;
    key_confidence: number;
    mode: number;
    mode_confidence: number;
    time_signature: number;
    time_signature_confidence: number;
  }[];
  segments: {
    start: number;
    duration: number;
    confidence: number;
    loudness_start: number;
    loudness_max_time: number;
    loudness_max: number;
    loudness_end: number;
    pitches: number[];
    timbre: number[];
  }[];
  tatums: {
    start: number;
    duration: number;
    confidence: number;
  }[];
  track: {
    num_samples: number;
    duration: number;
    sample_md5: string;
    offset_seconds: number;
    window_seconds: number;
    analysis_sample_rate: number;
    analysis_channels: number;
    end_of_fade_in: number;
    start_of_fade_out: number;
    loudness: number;
    tempo: number;
    tempo_confidence: number;
    time_signature: number;
    time_signature_confidence: number;
    key: number;
    key_confidence: number;
    mode: number;
    mode_confidence: number;
    codestring: string;
    code_version: number;
    echoprintstring: string;
    echoprint_version: number;
    synchstring: string;
    synch_version: number;
    rhythmstring: string;
    rhythm_version: number;
  };
}

export interface AudioAnalysis extends RawAudioAnalysis {
  bars: Array<RawAudioAnalysis["bars"][0] & { progressPct: number }>;
  beats: Array<
    RawAudioAnalysis["beats"][0] & { progressPct: number; startMs: number }
  >;
  sections: Array<
    RawAudioAnalysis["sections"][0] & {
      color: Color;
      startProgressPct: number;
      endProgressPct: number;
    }
  >;
  segments: Array<
    RawAudioAnalysis["segments"][0] & {
      startMs: number;
      progressPct: number;
      avgPitch: number;
      color: Color;
      relativeLoudness: number;
    }
  >;
  track: RawAudioAnalysis["track"] & { beatTimingsMs: number[] };
  colorPalette: ColorPalette;
}

const processBeats = (analysis: RawAudioAnalysis): AudioAnalysis["beats"] => {
  return analysis.beats.map((beat) => ({
    ...beat,
    progressPct: beat.start / analysis.track.duration,
    startMs: beat.start * 1000,
  }));
};

const processBars = (analysis: RawAudioAnalysis): AudioAnalysis["bars"] => {
  return analysis.bars.map((bar) => ({
    ...bar,
    progressPct: bar.start / analysis.track.duration,
  }));
};

const processSegments = (
  analysis: RawAudioAnalysis,
  palette: ColorPalette
): AudioAnalysis["segments"] => {
  const { minLoudness, maxLoudness } = analysis.segments.reduce(
    (acc, segment) => {
      return {
        minLoudness:
          segment.loudness_max < acc.minLoudness
            ? segment.loudness_max
            : acc.minLoudness,
        maxLoudness:
          segment.loudness_max > acc.maxLoudness
            ? segment.loudness_max
            : acc.maxLoudness,
      };
    },
    { minLoudness: Infinity, maxLoudness: -Infinity }
  );

  return analysis.segments.map((segment) => {
    const pitch = segment.pitches.reduce(
      (acc, pitch, idx) => {
        if (pitch > acc.conf) {
          return { conf: pitch, i: idx };
        }
        return acc;
      },
      { conf: 0, i: 0 }
    );

    return {
      ...segment,
      avgPitch: pitch.i,
      progressPct: segment.start / analysis.track.duration,
      startMs: segment.start * 1000,
      color: palette.sampleColor(),
      relativeLoudness: remap(
        segment.loudness_max,
        minLoudness,
        maxLoudness,
        1,
        2
      ),
    };
  });
};

const processSections = (
  analysis: RawAudioAnalysis,
  palette: ColorPalette
): AudioAnalysis["sections"] => {
  return analysis.sections.map((section) => {
    return {
      ...section,
      color: palette.sampleColor(),
      startProgressPct: section.start / analysis.track.duration,
      endProgressPct:
        (section.start + section.duration) / analysis.track.duration,
    };
  });
};

const processTrack = (analysis: RawAudioAnalysis): AudioAnalysis["track"] => {
  return {
    ...analysis.track,
    beatTimingsMs: analysis.beats.map((beat) => beat.start * 1000),
  };
};

export const processRawAnalysis = (
  analysis: RawAudioAnalysis,
  features: AudioFeatures
): AudioAnalysis => {
  const colorPalette = new ColorPalette(features);

  return {
    ...analysis,
    bars: processBars(analysis),
    beats: processBeats(analysis),
    sections: processSections(analysis, colorPalette),
    segments: processSegments(analysis, colorPalette),
    track: processTrack(analysis),
    colorPalette,
  };
};
