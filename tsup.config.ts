import { readFileSync } from "node:fs";

import { defineConfig } from "tsup";

const packageVersion = (
  JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    readonly version: string;
  }
).version;

export default defineConfig({
  clean: true,
  define: {
    __ARCOVIA_VERSION__: JSON.stringify(packageVersion),
  },
  dts: true,
  entry: {
    index: "src/index.ts",
    cli: "src/cli/index.ts",
  },
  format: ["esm"],
  platform: "node",
  sourcemap: true,
  target: "node22",
});
