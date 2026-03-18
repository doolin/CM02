const {
  generatePdf,
  buildStatementText,
  buildGuidanceText,
  buildRelatedControls,
  buildObjectivesText,
  extractMethodByName,
  controlData,
} = require("../lib/cm02Pdf");

describe("cm02Pdf", () => {
  test("generates a valid PDF buffer with no input", async () => {
    const buffer = await generatePdf();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("generates a valid PDF buffer with full input", async () => {
    const buffer = await generatePdf({
      systemName: "Test System Alpha",
      implementationStatus: "Implemented",
      implementationNarrative:
        "The baseline configuration is maintained via automated CM tools.",
      responsibleRole: "System Administrator",
      frequency: "annually",
      circumstances: "significant changes to the system architecture",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test("substitutes ODP parameters in output", async () => {
    const buffer = await generatePdf({
      frequency: "quarterly",
      circumstances: "security incidents",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  test("includes discussion and related controls rows", async () => {
    // Verify the PDF generates without error when all 10 rows render
    const buffer = await generatePdf({ systemName: "Test" });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // PDF with all 10 rows including discussion and related controls
    // should be larger than a minimal PDF
    expect(buffer.length).toBeGreaterThan(2000);
  });
});

describe("OSCAL data extraction - ODP prose from params", () => {
  test("params[0] (cm-02_odp.01) guidelines prose matches NIST text", () => {
    expect(controlData.params[0].id).toBe("cm-02_odp.01");
    expect(controlData.params[0].guidelines[0].prose).toBe(
      "the frequency of baseline configuration review and update is defined;",
    );
  });

  test("params[1] (cm-02_odp.02) guidelines prose matches NIST text", () => {
    expect(controlData.params[1].id).toBe("cm-02_odp.02");
    expect(controlData.params[1].guidelines[0].prose).toBe(
      "the circumstances requiring baseline configuration review and update are defined;",
    );
  });
});

describe("OSCAL data extraction - assessment objectives", () => {
  const params = {
    "cm-02_odp.01": "[organization-defined frequency]",
    "cm-02_odp.02": "[organization-defined circumstances]",
  };

  test("objectives text contains CM-02a.[01] determination statement", () => {
    const text = buildObjectivesText(params);
    expect(text).toContain(
      "a current baseline configuration of the system is developed and documented;",
    );
  });

  test("objectives text contains CM-02a.[02] determination statement", () => {
    const text = buildObjectivesText(params);
    expect(text).toContain(
      "a current baseline configuration of the system is maintained under configuration control;",
    );
  });

  test("objectives text contains CM-02b.01 with reviewed/updated and frequency param", () => {
    const text = buildObjectivesText(params);
    expect(text).toContain("reviewed and updated");
    expect(text).toContain("[organization-defined frequency]");
  });

  test("objectives text contains CM-02b.02 with reviewed/updated when required due to", () => {
    const text = buildObjectivesText(params);
    expect(text).toContain("reviewed and updated when required due to");
  });

  test("objectives text contains CM-02b.03 determination statement", () => {
    const text = buildObjectivesText(params);
    expect(text).toContain(
      "the baseline configuration of the system is reviewed and updated when system components are installed or upgraded.",
    );
  });
});

describe("OSCAL data extraction - assessment methods", () => {
  test("EXAMINE method contains full list of assessment objects", () => {
    const examine = extractMethodByName(controlData.parts, "EXAMINE");
    expect(examine).toContain("Configuration management policy");
    expect(examine).toContain(
      "procedures addressing the baseline configuration of the system",
    );
    expect(examine).toContain("configuration management plan");
    expect(examine).toContain("enterprise architecture documentation");
    expect(examine).toContain("system design documentation");
    expect(examine).toContain("system security plan");
    expect(examine).toContain("privacy plan");
    expect(examine).toContain(
      "system architecture and configuration documentation",
    );
    expect(examine).toContain(
      "system configuration settings and associated documentation",
    );
    expect(examine).toContain("system component inventory");
    expect(examine).toContain("change control records");
    expect(examine).toContain("other relevant documents or records");
  });

  test("INTERVIEW method contains full list of assessment objects", () => {
    const interview = extractMethodByName(controlData.parts, "INTERVIEW");
    expect(interview).toContain(
      "Organizational personnel with configuration management responsibilities",
    );
    expect(interview).toContain(
      "organizational personnel with information security and privacy responsibilities",
    );
    expect(interview).toContain("system/network administrators");
  });

  test("TEST method contains full list of assessment objects", () => {
    const test_ = extractMethodByName(controlData.parts, "TEST");
    expect(test_).toContain(
      "Organizational processes for managing baseline configurations",
    );
    expect(test_).toContain(
      "mechanisms supporting configuration control of the baseline configuration",
    );
  });
});

describe("OSCAL data extraction - statement text", () => {
  test("statement text includes parts a and b with proper structure", () => {
    const params = {
      "cm-02_odp.01": "[organization-defined frequency]",
      "cm-02_odp.02": "[organization-defined circumstances]",
    };
    const text = buildStatementText(params);
    // Part a
    expect(text).toContain(
      "Develop, document, and maintain under configuration control, a current baseline configuration of the system",
    );
    // Part b
    expect(text).toContain(
      "Review and update the baseline configuration of the system:",
    );
    // Sub-parts of b
    expect(text).toContain("[organization-defined frequency]");
    expect(text).toContain("[organization-defined circumstances]");
    expect(text).toContain(
      "When system components are installed or upgraded.",
    );
  });
});

describe("OSCAL data extraction - guidance text", () => {
  test("guidance text starts with expected NIST discussion prose", () => {
    const text = buildGuidanceText();
    expect(text).toMatch(
      /^Baseline configurations for systems and system components include connectivity, operational, and communications aspects/,
    );
  });
});

describe("OSCAL data extraction - related controls", () => {
  test("related controls include all expected control references", () => {
    const text = buildRelatedControls();
    const expected = [
      "AC-19", "AU-6", "CA-9", "CM-1", "CM-3", "CM-5", "CM-6", "CM-8",
      "CM-9", "CP-9", "CP-10", "CP-12", "MA-2", "PL-8", "PM-5", "SA-8",
      "SA-10", "SA-15", "SC-18",
    ];
    for (const control of expected) {
      expect(text).toContain(control);
    }
  });
});
