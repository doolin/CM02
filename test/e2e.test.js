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
        systemName: "DOJ Financial Management System",
        implementationStatus: "Implemented",
        frequency: "annually and when directed by the AO",
        circumstances: "security incidents or architecture changes",
        implementationNarrative:
          "Baselines maintained via CMDB with DISA STIGs. Weekly SCAP scans detect drift.",
        responsibleRole: "ISSO",
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
    expect(result.body).toContain('id="systemName"');
    expect(result.body).toContain('id="implementationStatus"');
    expect(result.body).toContain('id="frequency"');
    expect(result.body).toContain('id="circumstances"');
    expect(result.body).toContain('id="implementationNarrative"');
    expect(result.body).toContain('id="responsibleRole"');
    expect(result.body).toContain('type="submit"');
  });

  test("validation rejects empty submission with 6 errors", async () => {
    const event = {
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({}),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errors).toBeDefined();
    expect(body.errors).toHaveLength(6);
    expect(body.errors).toContain("systemName is required");
    expect(body.errors).toContain("implementationStatus is required");
    expect(body.errors).toContain("frequency is required");
    expect(body.errors).toContain("circumstances is required");
    expect(body.errors).toContain("implementationNarrative is required");
    expect(body.errors).toContain("responsibleRole is required");
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
