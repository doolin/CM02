const {
  generateManifest,
  verifyCompleteness,
  classifyArtifact,
  sha256,
  REQUIRED_ARTIFACT_TYPES,
} = require("../lib/evidenceManifest");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fullArtifactSet() {
  return REQUIRED_ARTIFACT_TYPES.map((type) => ({
    type,
    filename: `${type}.json`,
    sha256: sha256(Buffer.from(`content-${type}`)),
    sizeBytes: 100,
  }));
}

describe("evidenceManifest", () => {
  describe("sha256", () => {
    test("produces consistent hex digest", () => {
      const digest = sha256(Buffer.from("hello"));
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256(Buffer.from("hello"))).toBe(digest);
    });

    test("different inputs produce different digests", () => {
      expect(sha256(Buffer.from("a"))).not.toBe(sha256(Buffer.from("b")));
    });
  });

  describe("classifyArtifact", () => {
    test("maps known filenames to artifact types", () => {
      expect(classifyArtifact("sbom-cyclonedx.json")).toBe("sbom-cyclonedx");
      expect(classifyArtifact("npm-audit-results.json")).toBe(
        "npm-audit-results",
      );
      expect(classifyArtifact("trivy-scan-results.json")).toBe(
        "trivy-scan-results",
      );
      expect(classifyArtifact("oscal-assessment-results.json")).toBe(
        "oscal-assessment-results",
      );
      expect(classifyArtifact("oscal-component-definition.json")).toBe(
        "oscal-component-definition",
      );
      expect(classifyArtifact("oscal-ssp-fragment.json")).toBe(
        "oscal-ssp-fragment",
      );
    });

    test("returns unknown for unrecognized files", () => {
      expect(classifyArtifact("random-file.json")).toBe("unknown");
      expect(classifyArtifact("readme.md")).toBe("unknown");
    });
  });

  describe("generateManifest", () => {
    test("produces manifest with required fields", () => {
      const manifest = generateManifest({
        commit: "abc123",
        runId: "456",
        timestamp: "2026-04-17T00:00:00Z",
        artifacts: fullArtifactSet(),
      });

      expect(manifest.manifestVersion).toBe("1.0.0");
      expect(manifest.uuid).toMatch(UUID_RE);
      expect(manifest.pipeline.commit).toBe("abc123");
      expect(manifest.pipeline.runId).toBe("456");
      expect(manifest.artifacts).toHaveLength(6);
      expect(manifest.requiredTypes).toEqual(REQUIRED_ARTIFACT_TYPES);
    });

    test("complete artifact set passes verification", () => {
      const manifest = generateManifest({
        commit: "abc123",
        runId: "456",
        timestamp: "2026-04-17T00:00:00Z",
        artifacts: fullArtifactSet(),
      });

      expect(manifest.verification.complete).toBe(true);
      expect(manifest.verification.missingTypes).toEqual([]);
      expect(manifest.verification.presentCount).toBe(6);
      expect(manifest.verification.requiredCount).toBe(6);
    });

    test("missing artifacts fail verification", () => {
      const partial = fullArtifactSet().slice(0, 3);
      const manifest = generateManifest({
        commit: "abc123",
        runId: "456",
        timestamp: "2026-04-17T00:00:00Z",
        artifacts: partial,
      });

      expect(manifest.verification.complete).toBe(false);
      expect(manifest.verification.missingTypes).toHaveLength(3);
      expect(manifest.verification.presentCount).toBe(3);
    });

    test("empty artifact set lists all types as missing", () => {
      const manifest = generateManifest({
        commit: "abc123",
        runId: "456",
        timestamp: "2026-04-17T00:00:00Z",
        artifacts: [],
      });

      expect(manifest.verification.complete).toBe(false);
      expect(manifest.verification.missingTypes).toEqual(
        REQUIRED_ARTIFACT_TYPES,
      );
    });

    test("unknown artifact types do not count toward required", () => {
      const artifacts = [
        {
          type: "unknown",
          filename: "extra.json",
          sha256: "abc",
          sizeBytes: 10,
        },
      ];
      const manifest = generateManifest({
        commit: "abc123",
        runId: "456",
        timestamp: "2026-04-17T00:00:00Z",
        artifacts,
      });

      expect(manifest.verification.complete).toBe(false);
      expect(manifest.verification.missingTypes).toEqual(
        REQUIRED_ARTIFACT_TYPES,
      );
    });

    test("defaults for missing pipeline fields", () => {
      const manifest = generateManifest({
        artifacts: fullArtifactSet(),
      });

      expect(manifest.pipeline.commit).toBe("unknown");
      expect(manifest.pipeline.runId).toBe("unknown");
      expect(manifest.pipeline.timestamp).toBeDefined();
    });
  });

  describe("verifyCompleteness", () => {
    test("re-verifies an existing manifest", () => {
      const manifest = {
        artifacts: [{ type: "sbom-cyclonedx" }, { type: "npm-audit-results" }],
        requiredTypes: REQUIRED_ARTIFACT_TYPES,
      };

      const verified = verifyCompleteness(manifest);
      expect(verified.verification.complete).toBe(false);
      expect(verified.verification.missingTypes).toContain(
        "trivy-scan-results",
      );
    });
  });

  describe("REQUIRED_ARTIFACT_TYPES", () => {
    test("contains all expected artifact types", () => {
      expect(REQUIRED_ARTIFACT_TYPES).toContain("sbom-cyclonedx");
      expect(REQUIRED_ARTIFACT_TYPES).toContain("npm-audit-results");
      expect(REQUIRED_ARTIFACT_TYPES).toContain("trivy-scan-results");
      expect(REQUIRED_ARTIFACT_TYPES).toContain("oscal-assessment-results");
      expect(REQUIRED_ARTIFACT_TYPES).toContain("oscal-component-definition");
      expect(REQUIRED_ARTIFACT_TYPES).toContain("oscal-ssp-fragment");
    });

    test("has exactly 6 required types", () => {
      expect(REQUIRED_ARTIFACT_TYPES).toHaveLength(6);
    });
  });

  describe("JSON serialization", () => {
    test("manifest serializes to valid JSON", () => {
      const manifest = generateManifest({
        commit: "test",
        runId: "1",
        timestamp: "2026-04-17T00:00:00Z",
        artifacts: fullArtifactSet(),
      });

      const json = JSON.stringify(manifest);
      const parsed = JSON.parse(json);
      expect(parsed.manifestVersion).toBe("1.0.0");
      expect(parsed.verification.complete).toBe(true);
    });
  });
});
