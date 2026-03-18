/**
 * End-to-end test: invokes the handler with a realistic event,
 * verifies the response shape and PDF validity.
 */

jest.mock("../lib/s3Upload", () => ({
  uploadAndPresign: jest.fn().mockImplementation(async (buffer) => ({
    key: "cm02/e2e-test.pdf",
    url: "https://inventium-artifacts.s3.us-west-1.amazonaws.com/cm02/e2e-test.pdf?signed",
    _buffer: buffer,
  })),
}));

const { handler } = require("../index");
const { uploadAndPresign } = require("../lib/s3Upload");

describe("E2E", () => {
  beforeEach(() => {
    uploadAndPresign.mockClear();
  });

  test("full flow produces valid PDF and presigned URL", async () => {
    const event = {
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({
        frequency: "annually and when directed by the AO",
        circumstances: "security incidents or architecture changes",
        objA01: "Baseline documented in CMP v4.2.",
        objA02: "Maintained in ServiceNow CMDB under change control.",
        objB01: "Annual review completed 2025-09-15.",
        objB02: "Ad-hoc reviews triggered by CISA BODs.",
        objB03: "Component baselines updated at each CCB-approved upgrade.",
        examineResponse: "CMP v4.2; SSP Appendix M",
        interviewResponse: "ISSO (J. Martinez)",
        testResponse: "Execute SCAP benchmark scan",
      }),
    };

    const result = await handler(event);

    // Response shape
    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");

    const body = JSON.parse(result.body);
    expect(body.pdf_url).toContain("inventium-artifacts");
    expect(body.pdf_url).toContain(".pdf");

    // PDF validity
    const pdfBuffer = uploadAndPresign.mock.calls[0][0];
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfBuffer.length).toBeGreaterThan(3000);

    // PDF metadata (uncompressed portion)
    const pdfText = pdfBuffer.toString("latin1");
    expect(pdfText).toContain("CM-02 Baseline Configuration Assessment");
    expect(pdfText).toContain("en-US");
  });

  test("GET returns form HTML with all required fields", async () => {
    const event = {
      requestContext: { http: { method: "GET" } },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("text/html");
    expect(result.body).toContain('id="frequency"');
    expect(result.body).toContain('id="circumstances"');
    expect(result.body).toContain('id="objA01"');
    expect(result.body).toContain('id="examineResponse"');
    expect(result.body).toContain('id="interviewResponse"');
    expect(result.body).toContain('id="testResponse"');
    expect(result.body).toContain('type="submit"');
  });

  test("validation rejects empty submission with 2 errors", async () => {
    const event = {
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({}),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errors).toBeDefined();
    expect(body.errors).toHaveLength(2);
    expect(body.errors).toContain("frequency is required");
    expect(body.errors).toContain("circumstances is required");
    expect(uploadAndPresign).not.toHaveBeenCalled();
  });

  test("OPTIONS returns CORS preflight", async () => {
    const event = {
      requestContext: { http: { method: "OPTIONS" } },
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(204);
    expect(result.headers["Access-Control-Allow-Methods"]).toContain("POST");
  });
});
