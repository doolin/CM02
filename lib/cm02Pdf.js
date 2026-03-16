const PDFDocument = require("pdfkit");
const path = require("path");

const controlData = require(
  path.join(__dirname, "..", "data", "cm02-control.json"),
);

// Layout constants
const PAGE_MARGIN = 40;
const COL_SECTION_W = 140;
const COL_NIST_W = 230;
const COL_RESPONSE_W = 160;
const TABLE_W = COL_SECTION_W + COL_NIST_W + COL_RESPONSE_W;
const ROW_PAD = 6;
const FONT_SIZE = 9;
const HEADER_FONT_SIZE = 12;

// Colors
const HEADER_BG = "#1a3a5c";
const HEADER_FG = "#ffffff";
const ALT_BG = "#fafafa";
const BORDER_COLOR = "#333333";

function substituteParams(prose, params) {
  return prose.replace(
    /\{\{\s*insert:\s*param,\s*([\w.-]+)\s*\}\}/g,
    (_, paramId) => {
      return params[paramId] || `[${paramId}]`;
    },
  );
}

function extractParts(parts, name) {
  const section = parts.find((p) => p.name === name);
  if (!section) return [];
  const results = [];
  function walk(part, depth) {
    if (part.prose)
      results.push({ id: part.id || "", prose: part.prose, depth });
    if (part.parts) part.parts.forEach((p) => walk(p, depth + 1));
  }
  walk(section, 0);
  return results;
}

function extractMethodByName(parts, methodName) {
  const methods = parts.filter((p) => p.name === "assessment-method");
  const method = methods.find((m) =>
    (m.props || []).some((p) => p.name === "method" && p.value === methodName),
  );
  if (!method) return "";
  const objects = [];
  function walk(part) {
    if (part.prose) objects.push(part.prose);
    if (part.parts) part.parts.forEach(walk);
  }
  if (method.parts) method.parts.forEach(walk);
  return objects.join("; ");
}

function buildStatementText(params) {
  const statements = extractParts(controlData.parts, "statement");
  return statements
    .map((s) => {
      const indent = s.depth > 1 ? "    " : "";
      const label = s.id.replace("cm-2_smt.", "").toUpperCase();
      const prose = substituteParams(s.prose, params);
      return `${indent}(${label}) ${prose}`;
    })
    .join("\n");
}

function buildGuidanceText() {
  const guidance = controlData.parts.find((p) => p.name === "guidance");
  return guidance ? guidance.prose : "";
}

function buildRelatedControls() {
  return (controlData.links || [])
    .filter((l) => l.rel === "related")
    .map((l) => l.href.replace("#", "").toUpperCase())
    .join(", ");
}

function buildObjectivesText(params) {
  const objectives = extractParts(controlData.parts, "assessment-objective");
  return (
    "Determine if:\n" +
    objectives
      .map((o) => {
        const label = o.id.replace("cm-2_obj.", "");
        const prose = substituteParams(o.prose, params);
        return `  ${label}: ${prose}`;
      })
      .join("\n")
  );
}

function drawHeader(doc, y) {
  doc.save();
  doc.rect(PAGE_MARGIN, y, TABLE_W, 30).fill(HEADER_BG);
  doc.font("Times-Bold").fontSize(HEADER_FONT_SIZE).fillColor(HEADER_FG);
  doc.text("CM-02  BASELINE CONFIGURATION", PAGE_MARGIN + 8, y + 8, {
    width: TABLE_W - 16,
  });
  doc.restore();
  return y + 30;
}

function drawColumnHeaders(doc, y) {
  const h = 20;
  doc.save();
  doc.rect(PAGE_MARGIN, y, TABLE_W, h).fill("#d0d0d0");
  doc.rect(PAGE_MARGIN, y, TABLE_W, h).stroke(BORDER_COLOR);

  doc.font("Times-Bold").fontSize(FONT_SIZE).fillColor("#000000");
  const cols = [
    { label: "SECTION", x: PAGE_MARGIN, w: COL_SECTION_W },
    { label: "NIST TEXT", x: PAGE_MARGIN + COL_SECTION_W, w: COL_NIST_W },
    {
      label: "RESPONSE",
      x: PAGE_MARGIN + COL_SECTION_W + COL_NIST_W,
      w: COL_RESPONSE_W,
    },
  ];
  for (const col of cols) {
    doc.text(col.label, col.x + 4, y + 5, { width: col.w - 8 });
    if (col !== cols[0]) {
      doc
        .moveTo(col.x, y)
        .lineTo(col.x, y + h)
        .stroke(BORDER_COLOR);
    }
  }
  doc.restore();
  return y + h;
}

function measureText(doc, text, width, font, size) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text, { width: width - 8 });
}

function drawRow(doc, y, section, nistText, response, rowIndex) {
  doc.save();
  const sectionH = measureText(
    doc,
    section,
    COL_SECTION_W,
    "Times-Bold",
    FONT_SIZE,
  );
  const nistH = measureText(
    doc,
    nistText || "",
    COL_NIST_W,
    "Times-Roman",
    FONT_SIZE,
  );
  const responseH = measureText(
    doc,
    response || "",
    COL_RESPONSE_W,
    "Times-Roman",
    FONT_SIZE,
  );
  const contentH = Math.max(sectionH, nistH, responseH);
  const rowH = contentH + ROW_PAD * 2;

  // Check if we need a new page
  if (y + rowH > doc.page.height - PAGE_MARGIN) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  // Background
  const bg = rowIndex % 2 === 0 ? "#ffffff" : ALT_BG;
  doc.rect(PAGE_MARGIN, y, TABLE_W, rowH).fill(bg);
  doc.rect(PAGE_MARGIN, y, TABLE_W, rowH).stroke(BORDER_COLOR);

  // Vertical dividers
  const x1 = PAGE_MARGIN + COL_SECTION_W;
  const x2 = x1 + COL_NIST_W;
  doc
    .moveTo(x1, y)
    .lineTo(x1, y + rowH)
    .stroke(BORDER_COLOR);
  doc
    .moveTo(x2, y)
    .lineTo(x2, y + rowH)
    .stroke(BORDER_COLOR);

  // Section label (bold)
  doc.font("Times-Bold").fontSize(FONT_SIZE).fillColor("#000000");
  doc.text(section, PAGE_MARGIN + 4, y + ROW_PAD, { width: COL_SECTION_W - 8 });

  // NIST text
  if (nistText) {
    doc.font("Times-Roman").fontSize(FONT_SIZE).fillColor("#000000");
    doc.text(nistText, x1 + 4, y + ROW_PAD, { width: COL_NIST_W - 8 });
  }

  // Response
  if (response) {
    doc.font("Times-Roman").fontSize(FONT_SIZE).fillColor("#1a3a5c");
    doc.text(response, x2 + 4, y + ROW_PAD, { width: COL_RESPONSE_W - 8 });
  }

  doc.restore();
  return y + rowH;
}

function generatePdf(input = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: PAGE_MARGIN,
      bufferPages: true,
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const params = {
      "cm-02_odp.01": input.frequency || "[organization-defined frequency]",
      "cm-02_odp.02":
        input.circumstances || "[organization-defined circumstances]",
    };

    // Title
    let y = PAGE_MARGIN;
    doc.font("Times-Bold").fontSize(10).fillColor("#666666");
    doc.text("NIST SP 800-53 Rev 5 / 800-53A Rev 5", PAGE_MARGIN, y, {
      width: TABLE_W,
      align: "center",
    });
    y += 18;
    doc.text("Configuration Management Family", PAGE_MARGIN, y, {
      width: TABLE_W,
      align: "center",
    });
    y += 24;

    // Header bar
    y = drawHeader(doc, y);

    // Column headers
    y = drawColumnHeaders(doc, y);

    // Row data — matches 800-53A structure
    const rows = [
      {
        section: "1. Control\n   Number/Title",
        nist: "CM-02\nBaseline Configuration",
        response: input.systemName || "",
      },
      {
        section: "2. Control Text",
        nist: buildStatementText(params),
        response: "",
      },
      {
        section: "3. Discussion",
        nist: buildGuidanceText(),
        response: "",
      },
      {
        section: "4. Related\n   Controls",
        nist: buildRelatedControls(),
        response: "",
      },
      {
        section: "5. Implementation\n   Status",
        nist: "Implemented | Partially Implemented | Planned | Alternative | Not Applicable",
        response: input.implementationStatus || "",
      },
      {
        section: "6. Organization-\n   Defined\n   Parameters",
        nist: "CM-02_ODP[01]: frequency\nCM-02_ODP[02]: circumstances",
        response: `Frequency: ${params["cm-02_odp.01"]}\nCircumstances: ${params["cm-02_odp.02"]}`,
      },
      {
        section: "7. Implementation\n   Narrative",
        nist: "",
        response: input.implementationNarrative || "",
      },
      {
        section: "8. Assessment\n   Objective",
        nist: buildObjectivesText(params),
        response: input.responsibleRole
          ? `Responsible Role:\n${input.responsibleRole}`
          : "",
      },
      {
        section: "9. Examine",
        nist: `EXAMINE: [SELECT FROM: ${extractMethodByName(controlData.parts, "EXAMINE")}]`,
        response: "",
      },
      {
        section: "10. Interview\n    & Test",
        nist: `INTERVIEW: [SELECT FROM: ${extractMethodByName(controlData.parts, "INTERVIEW")}]\n\nTEST: [SELECT FROM: ${extractMethodByName(controlData.parts, "TEST")}]`,
        response: "",
      },
    ];

    for (let i = 0; i < rows.length; i++) {
      y = drawRow(doc, y, rows[i].section, rows[i].nist, rows[i].response, i);
    }

    doc.end();
  });
}

module.exports = { generatePdf };
