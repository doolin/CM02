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

  test("returns 200 with pdf_url", async () => {
    const event = {
      systemName: "My System",
      implementationStatus: "Implemented",
      implementationNarrative: "We do the thing.",
      responsibleRole: "ISSO",
      frequency: "annually",
      circumstances: "major changes",
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

  test("handles JSON string body (API Gateway proxy)", async () => {
    const event = {
      body: JSON.stringify({
        systemName: "Proxy System",
        implementationStatus: "Planned",
      }),
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(uploadAndPresign).toHaveBeenCalledTimes(1);
  });
});
