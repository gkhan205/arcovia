import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
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
