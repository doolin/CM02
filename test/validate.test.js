const { validate } = require("../lib/validate");

const validInput = {
  systemName: "Test System",
  implementationStatus: "Implemented",
  frequency: "annually",
  circumstances: "security incidents",
  implementationNarrative: "We maintain baselines.",
  responsibleRole: "ISSO",
};

describe("validate", () => {
  test("returns no errors for valid input", () => {
    expect(validate(validInput)).toEqual([]);
  });

  test("returns error for missing systemName", () => {
    const errors = validate({ ...validInput, systemName: "" });
    expect(errors).toContain("systemName is required");
  });

  test("returns error for invalid implementationStatus", () => {
    const errors = validate({ ...validInput, implementationStatus: "Invalid" });
    expect(errors[0]).toContain("implementationStatus must be one of");
  });

  test("returns error for missing frequency", () => {
    const errors = validate({ ...validInput, frequency: "" });
    expect(errors).toContain("frequency is required");
  });

  test("returns error for missing circumstances", () => {
    const errors = validate({ ...validInput, circumstances: undefined });
    expect(errors).toContain("circumstances is required");
  });

  test("returns error for missing implementationNarrative", () => {
    const errors = validate({ ...validInput, implementationNarrative: "  " });
    expect(errors).toContain("implementationNarrative is required");
  });

  test("returns error for missing responsibleRole", () => {
    const errors = validate({ ...validInput, responsibleRole: null });
    expect(errors).toContain("responsibleRole is required");
  });

  test("returns error for narrative exceeding max length", () => {
    const errors = validate({
      ...validInput,
      implementationNarrative: "x".repeat(5001),
    });
    expect(errors[0]).toContain("5000 characters");
  });

  test("returns multiple errors for multiple missing fields", () => {
    const errors = validate({});
    expect(errors.length).toBeGreaterThanOrEqual(6);
  });
});
