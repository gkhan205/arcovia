import { rm } from "node:fs/promises";

await rm(new URL("../dist", import.meta.url), { force: true, recursive: true });
await rm(new URL("../coverage", import.meta.url), { force: true, recursive: true });
