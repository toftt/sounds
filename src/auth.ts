const CLIENT_ID = "d4b56594a01d4c659e54db25b91ec0c1";
const AUTH_URL = "https://accounts.spotify.com/authorize";

export const getWebApiToken = async (): Promise<string> => {
  const maybeToken = localStorage.getItem("token");
  if (maybeToken) {
    return maybeToken;
  }

  const wasRedirected = window.location.hash !== "";

  if (wasRedirected) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("access_token");

    if (!token) throw new Error("something went wrong");

    window.localStorage.setItem("token", token);
    window.location.replace("http://localhost:8080");

    return "";
  }

  const params = new URLSearchParams();

  params.set("client_id", CLIENT_ID);
  params.set("response_type", "token");
  params.set("redirect_uri", "http://localhost:8080");
  params.set("scope", "user-modify-playback-state user-read-currently-playing");

  window.location.replace(`${AUTH_URL}?${params.toString()}`);

  // shut up typescript
  return "";
};
