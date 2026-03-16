const { generateBatchPdf } = require("../lib/batchPdf");

describe("generateBatchPdf", () => {
  test("generates PDFs for multiple controls", async () => {
    const { results, errors } = await generateBatchPdf([
      {
        controlId: "cm-02",
        systemName: "Test",
        implementationStatus: "Implemented",
        frequency: "annually",
        circumstances: "incidents",
      },
      {
        controlId: "ac-02",
        systemName: "Test",
        implementationStatus: "Planned",
      },
    ]);

    expect(results).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(results[0].controlId).toBe("cm-02");
    expect(results[1].controlId).toBe("ac-02");
    expect(results[0].buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("collects errors for invalid controls", async () => {
    const { results, errors } = await generateBatchPdf([
      { controlId: "cm-02", systemName: "Test" },
      { controlId: "zz-99", systemName: "Test" },
    ]);

    expect(results).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].controlId).toBe("zz-99");
  });

  test("handles missing controlId", async () => {
    const { results, errors } = await generateBatchPdf([
      { systemName: "No ID" },
    ]);

    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe("controlId is required");
  });

  test("throws for empty array", async () => {
    await expect(generateBatchPdf([])).rejects.toThrow("non-empty array");
  });
});
