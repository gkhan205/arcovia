import { rm } from "node:fs/promises";

import { build } from "vite";

const outputDirectory = new URL("../dist/report/", import.meta.url);

await rm(outputDirectory, { force: true, recursive: true });
await build({
  appType: "custom",
  build: {
    cssCodeSplit: false,
    emptyOutDir: false,
    lib: {
      entry: new URL("../src/reporters/html/app/main.tsx", import.meta.url).pathname,
      fileName: () => "app.js",
      formats: ["iife"],
      name: "ArcoviaHtmlReport",
    },
    outDir: outputDirectory.pathname,
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
