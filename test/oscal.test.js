const {
  generateAssessmentResults,
  generateComponentDefinition,
  generateSSPFragment,
  validateStructure,
  OSCAL_VERSION,
} = require("../lib/oscal");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const context = {
  commit: "abc123def456",
  runId: "12345",
  timestamp: "2026-04-17T00:00:00.000Z",
};

describe("OSCAL generation", () => {
  describe("OSCAL_VERSION", () => {
    test("matches NIST catalog version", () => {
      expect(OSCAL_VERSION).toBe("1.1.3");
    });
  });

  describe("generateAssessmentResults", () => {
    test("produces valid structure with clean scans", () => {
      const doc = generateAssessmentResults(context);
      const ar = doc["assessment-results"];

      expect(ar.uuid).toMatch(UUID_RE);
      expect(ar.metadata.title).toContain("Assessment Results");
      expect(ar.metadata["oscal-version"]).toBe(OSCAL_VERSION);
      expect(ar["import-ap"]).toBeDefined();
      expect(ar.results).toHaveLength(1);
      expect(ar.results[0].start).toBe(context.timestamp);
      expect(ar.results[0].findings).toHaveLength(1);
      expect(ar.results[0].findings[0].title).toBe(
        "No vulnerabilities detected",
      );
      expect(ar.results[0].findings[0].target.status.state).toBe("satisfied");
    });

    test("transforms npm audit vulnerabilities into findings", () => {
      const npmAudit = {
        vulnerabilities: {
          "bad-package": {
            name: "bad-package",
            severity: "high",
            via: [{ title: "Prototype pollution", severity: "high" }],
          },
          "ok-package": {
            name: "ok-package",
            severity: "low",
            via: [{ title: "Minor issue", severity: "low" }],
          },
        },
      };

      const doc = generateAssessmentResults({ ...context, npmAudit });
      const findings = doc["assessment-results"].results[0].findings;

      expect(findings).toHaveLength(2);

      const highFinding = findings.find((f) => f.title.includes("bad-package"));
      expect(highFinding.target.status.state).toBe("not-satisfied");
      expect(highFinding.target["target-id"]).toBe("pw-7_obj");

      const lowFinding = findings.find((f) => f.title.includes("ok-package"));
      expect(lowFinding.target.status.state).toBe("satisfied");
    });

    test("transforms Trivy vulnerabilities into findings", () => {
      const trivyScan = {
        Results: [
          {
            Target: "package-lock.json",
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2026-0001",
                PkgName: "vuln-lib",
                Severity: "CRITICAL",
                Title: "Remote code execution",
              },
              {
                VulnerabilityID: "CVE-2026-0002",
                PkgName: "minor-lib",
                Severity: "MEDIUM",
                Title: "Information disclosure",
              },
            ],
          },
        ],
      };

      const doc = generateAssessmentResults({ ...context, trivyScan });
      const findings = doc["assessment-results"].results[0].findings;

      expect(findings).toHaveLength(2);

      const critical = findings.find((f) => f.title.includes("CVE-2026-0001"));
      expect(critical.target.status.state).toBe("not-satisfied");
      expect(critical.target["target-id"]).toBe("pw-8_obj");

      const medium = findings.find((f) => f.title.includes("CVE-2026-0002"));
      expect(medium.target.status.state).toBe("satisfied");
    });

    test("combines npm audit and Trivy findings", () => {
      const npmAudit = {
        vulnerabilities: {
          pkg1: { severity: "critical", via: ["pkg1"] },
        },
      };
      const trivyScan = {
        Results: [
          {
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2026-9999",
                PkgName: "pkg2",
                Severity: "HIGH",
                Title: "Test",
              },
            ],
          },
        ],
      };

      const doc = generateAssessmentResults({
        ...context,
        npmAudit,
        trivyScan,
      });
      const findings = doc["assessment-results"].results[0].findings;
      expect(findings).toHaveLength(2);
    });

    test("includes observation with commit metadata", () => {
      const doc = generateAssessmentResults(context);
      const obs = doc["assessment-results"].results[0].observations;

      expect(obs).toHaveLength(1);
      expect(obs[0].methods).toEqual(["TEST"]);
      expect(obs[0].collected).toBe(context.timestamp);
      expect(obs[0].description).toContain(context.commit);
    });

    test("includes reviewed controls", () => {
      const doc = generateAssessmentResults(context);
      const controls =
        doc["assessment-results"].results[0]["reviewed-controls"];

      expect(controls["control-selections"]).toHaveLength(1);
      const ids = controls["control-selections"][0]["include-controls"].map(
        (c) => c["control-id"],
      );
      expect(ids).toContain("cm-02");
      expect(ids).toContain("ra-05");
      expect(ids).toContain("si-02");
    });

    test("passes structural validation", () => {
      const doc = generateAssessmentResults(context);
      expect(validateStructure(doc)).toEqual([]);
    });
  });

  describe("generateComponentDefinition", () => {
    test("produces valid structure with two components", () => {
      const doc = generateComponentDefinition(context);
      const cd = doc["component-definition"];

      expect(cd.uuid).toMatch(UUID_RE);
      expect(cd.metadata["oscal-version"]).toBe(OSCAL_VERSION);
      expect(cd.components).toHaveLength(2);
    });

    test("Lambda component has 800-53 control implementations", () => {
      const doc = generateComponentDefinition(context);
      const lambda = doc["component-definition"].components.find(
        (c) => c.type === "software",
      );

      expect(lambda.title).toContain("Lambda");
      const reqs =
        lambda["control-implementations"][0]["implemented-requirements"];
      const controlIds = reqs.map((r) => r["control-id"]);

      expect(controlIds).toContain("cm-02");
      expect(controlIds).toContain("sa-11");
      expect(controlIds).toContain("sr-04");
    });

    test("Pipeline component has SSDF control implementations", () => {
      const doc = generateComponentDefinition(context);
      const pipeline = doc["component-definition"].components.find(
        (c) => c.type === "service",
      );

      expect(pipeline.title).toContain("Pipeline");
      const reqs =
        pipeline["control-implementations"][0]["implemented-requirements"];
      const controlIds = reqs.map((r) => r["control-id"]);

      expect(controlIds).toEqual(
        expect.arrayContaining([
          "po-5",
          "ps-1",
          "ps-2",
          "pw-4",
          "pw-6",
          "pw-7",
          "pw-8",
        ]),
      );
    });

    test("includes build metadata in props", () => {
      const doc = generateComponentDefinition(context);
      const lambda = doc["component-definition"].components.find(
        (c) => c.type === "software",
      );

      const commitProp = lambda.props.find((p) => p.name === "commit");
      expect(commitProp.value).toBe(context.commit);
    });

    test("passes structural validation", () => {
      const doc = generateComponentDefinition(context);
      expect(validateStructure(doc)).toEqual([]);
    });
  });

  describe("generateSSPFragment", () => {
    test("produces valid structure with required sections", () => {
      const doc = generateSSPFragment(context);
      const ssp = doc["system-security-plan"];

      expect(ssp.uuid).toMatch(UUID_RE);
      expect(ssp.metadata["oscal-version"]).toBe(OSCAL_VERSION);
      expect(ssp["import-profile"]).toBeDefined();
      expect(ssp["system-characteristics"]).toBeDefined();
      expect(ssp["system-implementation"]).toBeDefined();
      expect(ssp["control-implementation"]).toBeDefined();
    });

    test("system characteristics have required fields", () => {
      const doc = generateSSPFragment(context);
      const sc = doc["system-security-plan"]["system-characteristics"];

      expect(sc["system-name"]).toBeDefined();
      expect(sc.description).toBeDefined();
      expect(sc["security-sensitivity-level"]).toBe("moderate");
      expect(sc.status.state).toBe("operational");
      expect(sc["authorization-boundary"]).toBeDefined();
    });

    test("system implementation has components and users", () => {
      const doc = generateSSPFragment(context);
      const si = doc["system-security-plan"]["system-implementation"];

      expect(si.users).toHaveLength(1);
      expect(si.components).toHaveLength(2);
      expect(si.components[0].type).toBe("software");
      expect(si.components[1].type).toBe("service");
    });

    test("control implementation includes CM-02", () => {
      const doc = generateSSPFragment(context);
      const ci = doc["system-security-plan"]["control-implementation"];
      const reqs = ci["implemented-requirements"];

      expect(reqs).toHaveLength(1);
      expect(reqs[0]["control-id"]).toBe("cm-02");
      expect(reqs[0].remarks).toContain("baseline configurations");
    });

    test("includes evidence references when provided", () => {
      const doc = generateSSPFragment({
        ...context,
        evidenceRefs: {
          sbom: "cm02/evidence/sboms/test.json",
          scan: "cm02/evidence/scans/test.json",
          provenance: "cm02/evidence/provenance/test.json",
        },
      });

      const reqs =
        doc["system-security-plan"]["control-implementation"][
          "implemented-requirements"
        ];
      const props = reqs[0].props;

      expect(props).toHaveLength(3);
      expect(props.find((p) => p.name === "evidence-sbom").value).toContain(
        "sboms",
      );
    });

    test("omits evidence props when no refs provided", () => {
      const doc = generateSSPFragment(context);
      const reqs =
        doc["system-security-plan"]["control-implementation"][
          "implemented-requirements"
        ];

      expect(reqs[0].props).toEqual([]);
    });

    test("passes structural validation", () => {
      const doc = generateSSPFragment(context);
      expect(validateStructure(doc)).toEqual([]);
    });
  });

  describe("validateStructure", () => {
    test("rejects unknown document type", () => {
      const errors = validateStructure({ unknown: {} });
      expect(errors).toContain("Unknown OSCAL document type");
    });

    test("reports missing required fields", () => {
      const errors = validateStructure({
        "assessment-results": { uuid: null, metadata: null },
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("missing uuid"))).toBe(true);
    });
  });

  describe("JSON serialization", () => {
    test("all documents serialize to valid JSON", () => {
      const docs = [
        generateAssessmentResults(context),
        generateComponentDefinition(context),
        generateSSPFragment(context),
      ];

      for (const doc of docs) {
        const json = JSON.stringify(doc);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(doc);
      }
    });
  });
});
