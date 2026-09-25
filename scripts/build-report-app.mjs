import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "vite";

const outputDirectory = fileURLToPath(new URL("../dist/report/", import.meta.url));
const entryFile = fileURLToPath(new URL("../src/reporters/html/app/main.tsx", import.meta.url));

await rm(outputDirectory, { force: true, recursive: true });
await build({
  appType: "custom",
  build: {
    cssCodeSplit: false,
    emptyOutDir: false,
    lib: {
      entry: entryFile,
      fileName: () => "app.js",
      formats: ["iife"],
      name: "ArcoviaHtmlReport",
    },
    outDir: outputDirectory,
    rollupOptions: {
      output: {
        assetFileNames: "app[extname]",
        inlineDynamicImports: true,
      },
    },
  },
  configFile: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  esbuild: { jsx: "automatic", jsxDev: false },
  logLevel: "silent",
  mode: "production",
});
