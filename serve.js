#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");
const { generatePdf } = require("./lib/cm02Pdf");
const { validate } = require("./lib/validate");
const { checkRateLimit } = require("./lib/rateLimit");

const PORT = process.env.PORT || 3002;
const OUTPUT_DIR = path.join(__dirname, "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const htmlPath = path.join(__dirname, "public", "index.html");

const server = http.createServer(async (req, res) => {
  // Serve generated PDFs from /output/
  if (req.method === "GET" && req.url.startsWith("/output/")) {
    const filePath = path.join(__dirname, req.url);
    if (!filePath.startsWith(OUTPUT_DIR)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      const pdf = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": "application/pdf" });
      return res.end(pdf);
    } catch {
      res.writeHead(404);
      return res.end("Not found");
    }
  }

  // Build a Lambda-style event from the HTTP request
  const event = {
    requestContext: {
      http: { method: req.method, sourceIp: req.socket.remoteAddress },
    },
  };

  if (req.method === "GET") {
    const html = fs.readFileSync(htmlPath, "utf8");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();

    let input;
    try {
      input = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid JSON" }));
    }

    const errors = validate(input);
    if (errors.length > 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ errors }));
    }

    if (!checkRateLimit(req.socket.remoteAddress)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ error: "Too many requests. Try again in a minute." }),
      );
    }

    try {
      const pdfBuffer = await generatePdf({
        systemName: input.systemName.trim(),
        implementationStatus: input.implementationStatus,
        implementationNarrative: input.implementationNarrative.trim(),
        responsibleRole: input.responsibleRole.trim(),
        frequency: input.frequency.trim(),
        circumstances: input.circumstances.trim(),
      });

      const filename = `cm02-${Date.now()}.pdf`;
      const filePath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filePath, pdfBuffer);

      const url = `http://localhost:${PORT}/output/${filename}`;
      console.log(`PDF generated: ${filePath} (${pdfBuffer.length} bytes)`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ pdf_url: url }));
    } catch (err) {
      console.error("PDF generation error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: `Method ${req.method} not allowed` }));
});

server.listen(PORT, () => {
  console.log(`CM-02 local server: http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is in use. Try: PORT=<number> npm start`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
