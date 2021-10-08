import axios from "axios";
import { AudioFeatures, RawAudioAnalysis } from "./AudioAnalysis";

export interface PlaybackState {
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  uri: string;
  timestamp: number;
}

export const getProgress = async (
  token: string
): Promise<PlaybackState | null> => {
  const response = await axios.get<{
    progress_ms: number;
    item: { duration_ms: number; uri: string };
    timestamp: number;
    is_playing: boolean;
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
    isPlaying: data.is_playing,
  };
};

export const getFeatures = async (token: string, uri: string) => {
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

export const getAnalysis = async (token: string, uri: string) => {
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
