const fs = require("fs");
const path = require("path");
const { generatePdf } = require("./lib/cm02Pdf");
const { uploadAndPresign } = require("./lib/s3Upload");
const { validate } = require("./lib/validate");
const { checkRateLimit } = require("./lib/rateLimit");

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
  try {
    const method = event.requestContext?.http?.method || event.httpMethod;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }

    // Serve the web form on GET
    if (method === "GET") {
      const html = fs.readFileSync(htmlPath, "utf8");
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "text/html" },
        body: html,
      };
    }

    // Only POST is allowed for PDF generation
    if (method && method !== "POST") {
      return errorResponse(405, `Method ${method} not allowed`);
    }

    // Rate limit POST requests
    const sourceIp =
      event.requestContext?.http?.sourceIp ||
      event.requestContext?.identity?.sourceIp ||
      "unknown";
    if (!checkRateLimit(sourceIp)) {
      return errorResponse(429, "Too many requests. Try again in a minute.");
    }

    // Parse body
    let input;
    try {
      input = typeof event.body === "string" ? JSON.parse(event.body) : event;
    } catch {
      return errorResponse(400, "Invalid JSON in request body");
    }

    // Validate
    const errors = validate(input);
    if (errors.length > 0) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ errors }),
      };
    }

    // Generate PDF
    const pdfBuffer = await generatePdf({
      systemName: input.systemName,
      implementationStatus: input.implementationStatus,
      implementationNarrative: input.implementationNarrative,
      responsibleRole: input.responsibleRole,
      frequency: input.frequency,
      circumstances: input.circumstances,
    });

    // Upload and return presigned URL
    const { url } = await uploadAndPresign(pdfBuffer);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ pdf_url: url }),
    };
  } catch (err) {
    console.error("Lambda error:", err);
    return errorResponse(500, "Internal server error");
  }
};
