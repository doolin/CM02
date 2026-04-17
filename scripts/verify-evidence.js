#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  generateManifest,
  classifyArtifact,
  sha256,
} = require("../lib/evidenceManifest");

const evidenceDir = process.argv[2] || "evidence";
const commit = process.env.GITHUB_SHA || "local";
const runId = process.env.GITHUB_RUN_ID || "local";
const timestamp = new Date().toISOString();

if (!fs.existsSync(evidenceDir)) {
  console.error(`Evidence directory not found: ${evidenceDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(evidenceDir)
  .filter((f) => f.endsWith(".json") && f !== "evidence-manifest.json");

const artifacts = files.map((filename) => {
  const content = fs.readFileSync(path.join(evidenceDir, filename));
  return {
    type: classifyArtifact(filename),
    filename,
    sha256: sha256(content),
    sizeBytes: content.length,
  };
});

const manifest = generateManifest({ commit, runId, timestamp, artifacts });

const manifestPath = path.join(evidenceDir, "evidence-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Evidence manifest written: ${manifestPath}`);

console.log("\nEvidence Verification Report");
console.log("===========================");
console.log(
  `Pipeline: commit ${manifest.pipeline.commit} | run ${manifest.pipeline.runId}`,
);
console.log(
  `Artifacts: ${manifest.verification.presentCount}/${manifest.verification.requiredCount} required types present`,
);

for (const artifact of manifest.artifacts) {
  console.log(
    `  [OK] ${artifact.type}: ${artifact.filename} (${artifact.sha256.substring(0, 12)}...)`,
  );
}

if (manifest.verification.complete) {
  console.log("\nStatus: COMPLETE - all required artifact types present");
} else {
  console.error("\nStatus: INCOMPLETE - missing artifact types:");
  for (const missing of manifest.verification.missingTypes) {
    console.error(`  [MISSING] ${missing}`);
  }
  process.exit(1);
}
