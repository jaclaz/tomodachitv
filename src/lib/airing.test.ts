import { describe, it, expect } from "vitest";
import { showProgressState } from "./airing";
const now = new Date("2026-11-18T12:00:00Z");
describe("showProgressState", () => {
  it("airing show, caught up, stays watching (caught_up)", () => {
    expect(showProgressState(22, 22, "2026-11-25", now)).toBe("caught_up");
  });
  it("new episodes out means watching", () => {
    expect(showProgressState(20, 22, "2026-11-25", now)).toBe("watching");
  });
  it("finished show with no upcoming episode is completed", () => {
    expect(showProgressState(8, 8, null, now)).toBe("completed");
  });
  it("next season far away counts as completed", () => {
    expect(showProgressState(24, 24, "2027-09-01", now)).toBe("completed");
  });
});
