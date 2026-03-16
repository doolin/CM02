const { generateControlPdf, findControl } = require("../lib/controlPdf");

describe("findControl", () => {
  test("finds CM-02", () => {
    const result = findControl("cm-02");
    expect(result).not.toBeNull();
    expect(result.control.title).toBe("Baseline Configuration");
  });

  test("finds AC-01", () => {
    const result = findControl("ac-01");
    expect(result).not.toBeNull();
    expect(result.control.title).toBe("Policy and Procedures");
  });

  test("returns null for nonexistent control", () => {
    expect(findControl("zz-99")).toBeNull();
  });
});

describe("generateControlPdf", () => {
  test("generates PDF for CM-02", async () => {
    const buffer = await generateControlPdf("cm-02", {
      systemName: "Test System",
      implementationStatus: "Implemented",
      implementationNarrative: "We do things.",
      responsibleRole: "ISSO",
      frequency: "annually",
      circumstances: "incidents",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("generates PDF for AC-02", async () => {
    const buffer = await generateControlPdf("ac-02", {
      systemName: "Account Mgmt System",
      implementationStatus: "Partially Implemented",
      implementationNarrative: "Account management is handled via AD.",
      responsibleRole: "System Admin",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("generates PDF for SI-02", async () => {
    const buffer = await generateControlPdf("si-02", {
      systemName: "Patch Mgmt System",
      implementationStatus: "Implemented",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  test("throws for nonexistent control", () => {
    expect(() => generateControlPdf("zz-99")).toThrow(
      "Control zz-99 not found in OSCAL catalog",
    );
  });

  test("accepts params map for ODPs", async () => {
    const buffer = await generateControlPdf("cm-02", {
      systemName: "Params Test",
      params: {
        "cm-02_odp.01": "quarterly",
        "cm-02_odp.02": "major upgrades",
      },
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});
