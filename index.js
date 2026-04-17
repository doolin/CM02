const fs = require("fs");
const path = require("path");
const { generatePdf } = require("./lib/cm02Pdf");
const { uploadAndPresign } = require("./lib/s3Upload");
const { validate } = require("./lib/validate");
const { checkRateLimit } = require("./lib/rateLimit");
const { auditLog } = require("./lib/auditLog");

const htmlPath = path.join(__dirname, "public", "index.html");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ error: message }),
  };
}

exports.handler = async (event) => {
  const sourceIp =
    event.requestContext?.http?.sourceIp ||
    event.requestContext?.identity?.sourceIp ||
    "unknown";
  const requestId =
    event.requestContext?.requestId ||
    event.requestContext?.http?.requestId ||
    undefined;

  try {
    const method = event.requestContext?.http?.method || event.httpMethod;

    if (method === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }

    if (method === "GET") {
      const html = fs.readFileSync(htmlPath, "utf8");
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "text/html" },
        body: html,
      };
    }

    if (method && method !== "POST") {
      auditLog.methodNotAllowed({ method, sourceIp, requestId });
      return errorResponse(405, `Method ${method} not allowed`);
    }

    if (!checkRateLimit(sourceIp)) {
      auditLog.rateLimitExceeded({ sourceIp, requestId });
      return errorResponse(429, "Too many requests. Try again in a minute.");
    }

    let input;
    try {
      input = typeof event.body === "string" ? JSON.parse(event.body) : event;
    } catch {
      auditLog.invalidJson({ sourceIp, requestId });
      return errorResponse(400, "Invalid JSON in request body");
    }

    const errors = validate(input);
    if (errors.length > 0) {
      auditLog.validationFailed({ errors, sourceIp, requestId });
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ errors }),
      };
    }

    const pdfBuffer = await generatePdf({
      frequency: input.frequency.trim(),
      circumstances: input.circumstances.trim(),
      objA01: (input.objA01 || "").trim(),
      objA02: (input.objA02 || "").trim(),
      objB01: (input.objB01 || "").trim(),
      objB02: (input.objB02 || "").trim(),
      objB03: (input.objB03 || "").trim(),
      examineResponse: (input.examineResponse || "").trim(),
      interviewResponse: (input.interviewResponse || "").trim(),
      testResponse: (input.testResponse || "").trim(),
    });

    const { url } = await uploadAndPresign(pdfBuffer);

    auditLog.pdfGenerated({
      control: "CM-02",
      sourceIp,
      requestId,
      pdfSizeBytes: pdfBuffer.length,
    });

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ pdf_url: url }),
    };
  } catch (err) {
    auditLog.lambdaError({
      error: err.message,
      stack: err.stack,
      sourceIp,
      requestId,
    });
    return errorResponse(500, "Internal server error");
  }
};
