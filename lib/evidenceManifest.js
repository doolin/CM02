const { createHash, randomUUID } = require("crypto");

const REQUIRED_ARTIFACT_TYPES = [
  "sbom-cyclonedx",
  "npm-audit-results",
  "trivy-scan-results",
  "oscal-assessment-results",
  "oscal-component-definition",
  "oscal-ssp-fragment",
];

const FILENAME_TO_TYPE = {
  "sbom-cyclonedx": "sbom-cyclonedx",
  "npm-audit-results": "npm-audit-results",
  "trivy-scan-results": "trivy-scan-results",
  "oscal-assessment-results": "oscal-assessment-results",
  "oscal-component-definition": "oscal-component-definition",
  "oscal-ssp-fragment": "oscal-ssp-fragment",
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function classifyArtifact(filename) {
  const basename = filename.replace(/\.json$/, "");
  return FILENAME_TO_TYPE[basename] || "unknown";
}

function generateManifest({ commit, runId, timestamp, artifacts }) {
  const manifest = {
    manifestVersion: "1.0.0",
    uuid: randomUUID(),
    pipeline: {
      commit: commit || "unknown",
      runId: runId || "unknown",
      timestamp: timestamp || new Date().toISOString(),
    },
    artifacts: artifacts.map((a) => ({
      type: a.type,
      filename: a.filename,
      sha256: a.sha256,
      sizeBytes: a.sizeBytes,
    })),
    requiredTypes: REQUIRED_ARTIFACT_TYPES,
  };

  return verifyCompleteness(manifest);
}

function verifyCompleteness(manifest) {
  const presentTypes = new Set(manifest.artifacts.map((a) => a.type));
  const missing = manifest.requiredTypes.filter((t) => !presentTypes.has(t));

  manifest.verification = {
    complete: missing.length === 0,
    presentCount: presentTypes.size,
    requiredCount: manifest.requiredTypes.length,
    missingTypes: missing,
    verifiedAt: new Date().toISOString(),
  };

  return manifest;
}

module.exports = {
  generateManifest,
  verifyCompleteness,
  classifyArtifact,
  sha256,
  REQUIRED_ARTIFACT_TYPES,
};
