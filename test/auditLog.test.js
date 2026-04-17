const { auditLog, emit, SEVERITY } = require("../lib/auditLog");

describe("auditLog", () => {
  let logSpy, errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation();
    errorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("emit produces structured JSON with required fields", () => {
    const entry = emit("test_event", SEVERITY.INFO, { foo: "bar" });

    expect(entry.event).toBe("test_event");
    expect(entry.severity).toBe("INFO");
    expect(entry.timestamp).toBeDefined();
    expect(entry.foo).toBe("bar");
    expect(logSpy).toHaveBeenCalledTimes(1);

    const logged = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logged.event).toBe("test_event");
  });

  test("ERROR severity uses console.error", () => {
    emit("err_event", SEVERITY.ERROR, { msg: "fail" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("pdfGenerated logs with INFO severity", () => {
    const entry = auditLog.pdfGenerated({
      control: "CM-02",
      sourceIp: "10.0.0.1",
      pdfSizeBytes: 4000,
    });

    expect(entry.event).toBe("pdf_generated");
    expect(entry.severity).toBe("INFO");
    expect(entry.control).toBe("CM-02");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  test("validationFailed logs with WARN severity", () => {
    const entry = auditLog.validationFailed({
      errors: ["frequency is required"],
      sourceIp: "10.0.0.1",
    });

    expect(entry.event).toBe("validation_failed");
    expect(entry.severity).toBe("WARN");
  });

  test("rateLimitExceeded logs with WARN severity", () => {
    const entry = auditLog.rateLimitExceeded({ sourceIp: "10.0.0.1" });
    expect(entry.event).toBe("rate_limit_exceeded");
    expect(entry.severity).toBe("WARN");
  });

  test("lambdaError logs with ERROR severity", () => {
    const entry = auditLog.lambdaError({
      error: "something broke",
      stack: "Error: something broke\n    at ...",
    });

    expect(entry.event).toBe("lambda_error");
    expect(entry.severity).toBe("ERROR");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test("s3EvidenceArchived logs with INFO severity", () => {
    const entry = auditLog.s3EvidenceArchived({
      artifactType: "sbom",
      key: "cm02/evidence/sboms/test.json",
      checksum: "abc123",
    });

    expect(entry.event).toBe("s3_evidence_archived");
    expect(entry.severity).toBe("INFO");
  });

  test("all event methods exist", () => {
    expect(typeof auditLog.pdfGenerated).toBe("function");
    expect(typeof auditLog.validationFailed).toBe("function");
    expect(typeof auditLog.rateLimitExceeded).toBe("function");
    expect(typeof auditLog.methodNotAllowed).toBe("function");
    expect(typeof auditLog.invalidJson).toBe("function");
    expect(typeof auditLog.s3UploadFailed).toBe("function");
    expect(typeof auditLog.s3EvidenceArchived).toBe("function");
    expect(typeof auditLog.lambdaError).toBe("function");
  });
});
