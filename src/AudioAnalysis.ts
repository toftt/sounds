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
  beats: Array<RawAudioAnalysis["beats"][0] & { progressPct: number }>;
}

const processBeats = (analysis: RawAudioAnalysis): AudioAnalysis["beats"] => {
  return analysis.beats.map((beat) => ({
    ...beat,
    progressPct: beat.start / analysis.track.duration,
  }));
};

export const processRawAnalysis = (
  analysis: RawAudioAnalysis
): AudioAnalysis => {
  return {
    ...analysis,
    beats: processBeats(analysis),
  };
};
