jest.mock("../lib/s3Upload", () => ({
  uploadAndPresign: jest.fn().mockResolvedValue({
    key: "cm02/test-uuid.pdf",
    url: "https://inventium-artifacts.s3.us-west-1.amazonaws.com/cm02/test-uuid.pdf?signed",
  }),
}));

const { handler } = require("../index");
const { uploadAndPresign } = require("../lib/s3Upload");

describe("handler", () => {
  beforeEach(() => {
    uploadAndPresign.mockClear();
  });

  test("serves HTML form on GET", async () => {
    const event = {
      requestContext: { http: { method: "GET" } },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("text/html");
    expect(result.body).toContain("cm02-form");
  });

  test("serves HTML form on GET (REST API format)", async () => {
    const event = {
      httpMethod: "GET",
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("text/html");
  });

  test("returns 200 with pdf_url on POST", async () => {
    const event = {
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({
        systemName: "My System",
        implementationStatus: "Implemented",
        implementationNarrative: "We do the thing.",
        responsibleRole: "ISSO",
        frequency: "annually",
        circumstances: "major changes",
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.pdf_url).toContain("inventium-artifacts");
    expect(uploadAndPresign).toHaveBeenCalledTimes(1);
    const pdfArg = uploadAndPresign.mock.calls[0][0];
    expect(Buffer.isBuffer(pdfArg)).toBe(true);
    expect(pdfArg.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("handles CORS preflight OPTIONS", async () => {
    const event = {
      requestContext: { http: { method: "OPTIONS" } },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(204);
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(result.headers["Access-Control-Allow-Methods"]).toContain("POST");
  });

  test("includes CORS headers on POST response", async () => {
    const event = {
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({
        systemName: "CORS Test",
        implementationStatus: "Planned",
        implementationNarrative: "Test.",
        responsibleRole: "Admin",
        frequency: "annually",
        circumstances: "changes",
      }),
    };

    const result = await handler(event);
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  test("returns 405 for unsupported methods", async () => {
    const event = {
      requestContext: { http: { method: "DELETE" } },
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(405);
  });

  test("returns 400 for invalid JSON body", async () => {
    const event = {
      requestContext: { http: { method: "POST" } },
      body: "not json{{{",
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toContain("Invalid JSON");
  });

  test("returns 400 for validation errors", async () => {
    const event = {
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({ systemName: "" }),
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  test("returns 500 on unexpected error", async () => {
    uploadAndPresign.mockRejectedValueOnce(new Error("S3 down"));

    const event = {
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({
        systemName: "Test",
        implementationStatus: "Implemented",
        implementationNarrative: "Test.",
        responsibleRole: "Admin",
        frequency: "annually",
        circumstances: "changes",
      }),
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toBe("Internal server error");
  });

  test("handles direct event payload (no httpMethod)", async () => {
    const event = {
      systemName: "Direct System",
      implementationStatus: "Planned",
      implementationNarrative: "Planning phase.",
      responsibleRole: "Admin",
      frequency: "annually",
      circumstances: "changes",
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(uploadAndPresign).toHaveBeenCalledTimes(1);
  });
});
