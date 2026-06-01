import { expect, it } from "vitest";

import { saveExport } from "./exports";

it("re-exports saveExport for existing API callers", () => {
  expect(saveExport).toBeInstanceOf(Function);
});
