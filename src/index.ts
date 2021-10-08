import { getWebApiToken } from "./auth";
import { Scene } from "./Scene";

async function main() {
  const token = await getWebApiToken();
  new Scene(token);
}

main();
