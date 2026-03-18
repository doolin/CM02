const { validate } = require("../lib/validate");

const validInput = {
  frequency: "annually",
  circumstances: "security incidents",
};

describe("validate", () => {
  test("returns no errors for valid input", () => {
    expect(validate(validInput)).toEqual([]);
  });

  test("returns error for missing frequency", () => {
    const errors = validate({ ...validInput, frequency: "" });
    expect(errors).toContain("frequency is required");
  });

  test("returns error for missing circumstances", () => {
    const errors = validate({ ...validInput, circumstances: undefined });
    expect(errors).toContain("circumstances is required");
  });

  test("returns multiple errors for multiple missing fields", () => {
    const errors = validate({});
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  test("accepts field at exactly MAX_FIELD_LENGTH", () => {
    const errors = validate({
      ...validInput,
      frequency: "x".repeat(2000),
    });
    expect(errors).toEqual([]);
  });

  test("rejects field exceeding MAX_FIELD_LENGTH", () => {
    const errors = validate({
      ...validInput,
      frequency: "x".repeat(2001),
    });
    expect(errors[0]).toContain("2000 characters");
  });

  test("optional fields pass validation when empty", () => {
    const errors = validate(validInput);
    expect(errors).toEqual([]);
  });

  test("optional fields validated for length when present", () => {
    const errors = validate({
      ...validInput,
      objA01: "x".repeat(2001),
    });
    expect(errors[0]).toContain("2000 characters");
  });
});
