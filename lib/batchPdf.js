const { generateControlPdf } = require("./controlPdf");

async function generateBatchPdf(controls) {
  if (!Array.isArray(controls) || controls.length === 0) {
    throw new Error("controls must be a non-empty array");
  }

  const results = [];
  const errors = [];

  for (const entry of controls) {
    const controlId = entry.controlId;
    if (!controlId) {
      errors.push({ controlId: null, error: "controlId is required" });
      continue;
    }

    try {
      const buffer = await generateControlPdf(controlId, entry);
      results.push({ controlId, buffer });
    } catch (err) {
      errors.push({ controlId, error: err.message });
    }
  }

  return { results, errors };
}

module.exports = { generateBatchPdf };
