const fs = require("fs");
const path = require("path");
const { generatePdf } = require("./lib/cm02Pdf");
const { uploadAndPresign } = require("./lib/s3Upload");

const htmlPath = path.join(__dirname, "public", "index.html");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
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

  // Generate PDF on POST
  const input = typeof event.body === "string" ? JSON.parse(event.body) : event;

  const pdfBuffer = await generatePdf({
    systemName: input.systemName,
    implementationStatus: input.implementationStatus,
    implementationNarrative: input.implementationNarrative,
    responsibleRole: input.responsibleRole,
    frequency: input.frequency,
    circumstances: input.circumstances,
  });

  const { url } = await uploadAndPresign(pdfBuffer);

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ pdf_url: url }),
  };
};
