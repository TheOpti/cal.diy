import { fileURLToPath } from "node:url";
import config from "./.dependency-cruiser.mjs";

/** @type {import("dependency-cruiser").IConfiguration} */
export default {
  ...config,
  options: {
    ...config.options,
    tsConfig: { fileName: fileURLToPath(new URL("./apps/api/v2/tsconfig.json", import.meta.url)) },
  },
};
