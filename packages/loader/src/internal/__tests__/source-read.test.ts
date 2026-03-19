import {describe, expect, it} from "vitest";

import {readTypedGtfsSourceRows} from "../source-read.js";

describe("readTypedGtfsSourceRows", () => {
  it("coerces numeric GTFS source columns", async () => {
    const session = {
      execRows: async () => [
        {
          service_id: "WK",
          monday: "1",
          tuesday: "0",
          start_date: "20250401",
          end_date: "20250430",
        },
      ],
    };

    const rows = await readTypedGtfsSourceRows(
      session as never,
      "calendar",
      {
        columns: ["service_id", "monday", "tuesday", "start_date", "end_date"],
      },
    );

    expect(rows).toEqual([
      {
        service_id: "WK",
        monday: 1,
        tuesday: 0,
        start_date: "20250401",
        end_date: "20250430",
      },
    ]);
  });

  it("keeps string GTFS source columns as strings", async () => {
    const session = {
      execRows: async () => [
        {
          feed_start_date: "20250401",
          feed_end_date: "20250430",
        },
      ],
    };

    const rows = await readTypedGtfsSourceRows(
      session as never,
      "feed_info",
      {
        columns: ["feed_start_date", "feed_end_date"],
      },
    );

    expect(rows).toEqual([
      {
        feed_start_date: "20250401",
        feed_end_date: "20250430",
      },
    ]);
  });
});
