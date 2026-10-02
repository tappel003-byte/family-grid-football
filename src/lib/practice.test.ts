import { describe, expect, it } from "vitest";
import { forCurrentWeek, parsePracticeCsv } from "./practice.functions";

const CSV = [
  "season,season_type,week,gsis_id,practice_status",
  "2026,REG,4,00-001,Did Not Participate In Practice",
  "2026,REG,4,00-002,Limited Participation in Practice",
  "2026,REG,4,00-003,Full Participation in Practice",
].join("\n");

describe("practice report week check", () => {
  it("shows tags when file week equals current week", () => {
    const r = forCurrentWeek(parsePracticeCsv(CSV), 4);
    expect(r.byGsis).toEqual({ "00-001": "DNP", "00-002": "Limited" });
  });

  it("hides all tags when file week is older than current week", () => {
    expect(forCurrentWeek(parsePracticeCsv(CSV), 5).byGsis).toEqual({});
  });

  it("shows nothing for a missing or unreadable file", () => {
    expect(() => parsePracticeCsv("")).toThrow();
    expect(() => parsePracticeCsv("<html>not found</html>")).toThrow();
    expect(forCurrentWeek({ week: 0, byGsis: {} }, 4).byGsis).toEqual({});
  });
});
