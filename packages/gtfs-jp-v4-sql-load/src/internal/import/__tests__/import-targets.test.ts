import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { collectImportTargets } from "../import-targets.js";

describe("collectImportTargets", () => {
  it("collects known GTFS files in strict mode", async () => {
    const zip = new JSZip();
    zip.file("routes.txt", "route_id,agency_id,route_type\nR1,A1,3\n");
    zip.file("agency_jp.txt", "agency_id,agency_official_name\nA1,Agency Corp\n");
    zip.file("custom_table.txt", "id,name\n1,Custom\n");

    const { targets, skippedFiles } = collectImportTargets({
      archive: zip,
      strictGtfsTableName: true,
    });

    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.tableName)).toEqual(["routes", "agency_jp"]);
    expect(skippedFiles).toEqual(["custom_table.txt"]);
  });

  it("falls back to txt stem in non-strict mode", () => {
    const zip = new JSZip();
    zip.file("custom_table.txt", "id,name\n1,Custom\n");

    const { targets, skippedFiles } = collectImportTargets({
      archive: zip,
      strictGtfsTableName: false,
    });

    expect(targets).toHaveLength(1);
    expect(targets[0].tableName).toBe("custom_table");
    expect(skippedFiles).toEqual([]);
  });
});
