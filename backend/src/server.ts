import { createApp } from "./app.js";
import { config } from "./lib/config.js";

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Emaal wallet backend listening on :${config.port} (${config.nodeEnv})`);
});
