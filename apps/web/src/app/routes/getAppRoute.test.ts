import { describe, expect, it } from "vitest";

import { getAppRoute } from "./getAppRoute";

describe("getAppRoute", () => {
  it("uses the existing MVP workbench by default", () => {
    expect(getAppRoute("")).toBe("workbench");
    expect(getAppRoute("?project=demo")).toBe("workbench");
  });

  it("opens the desktop UI prototype through an explicit query parameter", () => {
    expect(getAppRoute("?prototype=desktop-ui")).toBe("desktop-ui-prototype");
  });
});
