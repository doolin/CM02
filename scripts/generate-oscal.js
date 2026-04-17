#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  generateAssessmentResults,
  generateComponentDefinition,
  generateSSPFragment,
  validateStructure,
} = require("../lib/oscal");

const evidenceDir = process.argv[2] || "evidence";
const commit = process.env.GITHUB_SHA || "local";
const runId = process.env.GITHUB_RUN_ID || "local";
const timestamp = new Date().toISOString();

let npmAudit = null;
let trivyScan = null;

const npmAuditPath = path.join(evidenceDir, "npm-audit-results.json");
if (fs.existsSync(npmAuditPath)) {
  try {
    npmAudit = JSON.parse(fs.readFileSync(npmAuditPath, "utf8"));
  } catch {
    console.warn(`Warning: could not parse ${npmAuditPath}`);
  }
}

const trivyPath = path.join(evidenceDir, "trivy-scan-results.json");
if (fs.existsSync(trivyPath)) {
  try {
    trivyScan = JSON.parse(fs.readFileSync(trivyPath, "utf8"));
  } catch {
    console.warn(`Warning: could not parse ${trivyPath}`);
  }
}

const context = { commit, runId, timestamp };

const assessmentResults = generateAssessmentResults({
  ...context,
  npmAudit,
  trivyScan,
});
const componentDefinition = generateComponentDefinition(context);
const sspFragment = generateSSPFragment(context);

const artifacts = [
  { name: "oscal-assessment-results.json", doc: assessmentResults },
  { name: "oscal-component-definition.json", doc: componentDefinition },
  { name: "oscal-ssp-fragment.json", doc: sspFragment },
];

fs.mkdirSync(evidenceDir, { recursive: true });

let failed = false;
for (const { name, doc } of artifacts) {
  const errors = validateStructure(doc);
  if (errors.length > 0) {
    console.error(`Validation failed for ${name}:`, errors);
    failed = true;
    continue;
  }

  const outPath = path.join(evidenceDir, name);
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
  console.log(`Generated: ${outPath}`);
}

if (failed) {
  process.exit(1);
}

console.log("All OSCAL artifacts generated and validated.");
