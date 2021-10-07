const CLIENT_ID = "d4b56594a01d4c659e54db25b91ec0c1";
const AUTH_URL = "https://accounts.spotify.com/authorize";

export const getWebApiToken = async (): Promise<string> => {
  const token = localStorage.getItem("token");
  const expires = localStorage.getItem("expires");
  if (token && expires && new Date().getTime() < Number(expires)) {
    return token;
  }

  const wasRedirected = window.location.hash !== "";

  if (wasRedirected) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("access_token");
    const expires =
      new Date().getTime() + Number(params.get("expires_in")) * 1000 - 10_000;

    if (!token) throw new Error("something went wrong");

    window.localStorage.setItem("token", token);
    window.localStorage.setItem("expires", expires.toString());
    window.history.replaceState("", document.title, window.location.pathname);

    return token;
  }

  const params = new URLSearchParams();

  const { protocol, host, pathname } = window.location;

  params.set("client_id", CLIENT_ID);
  params.set("response_type", "token");
  params.set("redirect_uri", `${protocol}//${host}${pathname}`);
  params.set("scope", "user-modify-playback-state user-read-currently-playing");

  window.location.replace(`${AUTH_URL}?${params.toString()}`);

  // shut up typescript
  return "";
};
