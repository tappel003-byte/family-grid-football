import { describe, expect, test } from "bun:test";
import { availabilityFromKickoffs } from "./player-availability";
import { lastWaiverRun, nextWaiverRun } from "./waiver-cycle";

describe("player waiver availability", () => {
  test("Tuesday keeps a Sunday player on waivers after the league week advances", () => {
    expect(
      availabilityFromKickoffs(
        ["2026-09-27T17:00:00Z", "2026-10-01T00:15:00Z"],
        Date.parse("2026-09-29T12:02:00Z"),
      ),
    ).toBe("waiver");
  });

  test("Wednesday's run releases an unclaimed player until his next kickoff", () => {
    expect(
      availabilityFromKickoffs(
        ["2026-09-27T17:00:00Z", "2026-10-01T00:15:00Z"],
        Date.parse("2026-09-30T04:01:01Z"),
      ),
    ).toBe("free-agent");
  });

  test("a Thursday player locks exactly at his own kickoff", () => {
    const kickoff = "2026-10-02T00:15:00Z";
    expect(availabilityFromKickoffs([kickoff], Date.parse("2026-10-02T00:14:59Z"))).toBe(
      "free-agent",
    );
    expect(availabilityFromKickoffs([kickoff], Date.parse(kickoff))).toBe("waiver");
  });

  test("a Sunday late player stays free after an early game begins", () => {
    expect(
      availabilityFromKickoffs(
        ["2026-10-04T20:05:00Z"],
        Date.parse("2026-10-04T17:05:00Z"),
      ),
    ).toBe("free-agent");
  });

  test("a Monday night player remains on waivers through Tuesday", () => {
    expect(
      availabilityFromKickoffs(
        ["2026-10-06T00:15:00Z"],
        Date.parse("2026-10-06T18:00:00Z"),
      ),
    ).toBe("waiver");
  });

  test("a bye player follows his prior game through Wednesday, then becomes free", () => {
    const priorKickoff = "2026-10-11T17:00:00Z";
    expect(
      availabilityFromKickoffs([priorKickoff], Date.parse("2026-10-13T18:00:00Z")),
    ).toBe("waiver");
    expect(
      availabilityFromKickoffs([priorKickoff], Date.parse("2026-10-14T04:01:01Z")),
    ).toBe("free-agent");
  });

  test("Wednesday boundaries remain 12:01am Eastern across daylight saving", () => {
    expect(lastWaiverRun(Date.parse("2026-09-30T04:01:00Z"))).toBe(
      Date.parse("2026-09-30T04:01:00Z"),
    );
    expect(nextWaiverRun(Date.parse("2026-10-28T04:02:00Z"))).toBe(
      Date.parse("2026-11-04T05:01:00Z"),
    );
  });
});