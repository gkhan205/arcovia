import { describe, expect, it } from "vitest";

import { Logger } from "../src/shared/index.js";

describe("Logger", () => {
  it("writes messages at or above the configured level", () => {
    const messages: string[] = [];
    const logger = new Logger({
      level: "WARN",
      writer: { write: (message) => messages.push(message) },
    });

    logger.info("not emitted");
    logger.warn("emitted");

    expect(messages).toEqual(["[WARN] emitted\n"]);
  });
});
