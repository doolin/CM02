const { randomUUID } = require("crypto");

const OSCAL_VERSION = "1.1.3";

function metadata(title) {
  return {
    title,
    "last-modified": new Date().toISOString(),
    version: "1.0.0",
    "oscal-version": OSCAL_VERSION,
    roles: [{ id: "pipeline", title: "CI/CD Pipeline" }],
    parties: [
      {
        uuid: randomUUID(),
        type: "organization",
        name: "Farm Service Agency (FSA)",
      },
    ],
  };
}

function npmAuditToFindings(npmAudit) {
  const findings = [];
  if (!npmAudit?.vulnerabilities) return findings;

  for (const [name, vuln] of Object.entries(npmAudit.vulnerabilities)) {
    const via = Array.isArray(vuln.via) ? vuln.via[0] : null;
    const title =
      typeof via === "object" ? via.title || name : vuln.title || name;

    findings.push({
      uuid: randomUUID(),
      title: `Dependency vulnerability: ${name}`,
      description: `${vuln.severity} severity vulnerability in ${name}: ${title}`,
      target: {
        type: "objective-id",
        "target-id": "pw-7_obj",
        status: {
          state:
            vuln.severity === "critical" || vuln.severity === "high"
              ? "not-satisfied"
              : "satisfied",
        },
      },
    });
  }
  return findings;
}

function trivyToFindings(trivyScan) {
  const findings = [];
  if (!trivyScan?.Results) return findings;

  for (const result of trivyScan.Results) {
    if (!result.Vulnerabilities) continue;
    for (const v of result.Vulnerabilities) {
      findings.push({
        uuid: randomUUID(),
        title: `${v.VulnerabilityID}: ${v.PkgName}`,
        description: `${v.Severity} - ${v.Title || v.Description || "See advisory"}`,
        target: {
          type: "objective-id",
          "target-id": "pw-8_obj",
          status: {
            state:
              v.Severity === "CRITICAL" || v.Severity === "HIGH"
                ? "not-satisfied"
                : "satisfied",
          },
        },
      });
    }
  }
  return findings;
}

function generateAssessmentResults({
  npmAudit,
  trivyScan,
  commit,
  runId,
  timestamp,
}) {
  const ts = timestamp || new Date().toISOString();
  const findings = [
    ...npmAuditToFindings(npmAudit),
    ...trivyToFindings(trivyScan),
  ];

  if (findings.length === 0) {
    findings.push({
      uuid: randomUUID(),
      title: "No vulnerabilities detected",
      description:
        "Vulnerability scans completed with no high or critical findings",
      target: {
        type: "objective-id",
        "target-id": "pw-7_obj",
        status: { state: "satisfied" },
      },
    });
  }

  return {
    "assessment-results": {
      uuid: randomUUID(),
      metadata: metadata("CM02 Pipeline Vulnerability Assessment Results"),
      "import-ap": { href: "#" },
      results: [
        {
          uuid: randomUUID(),
          title: "Automated Pipeline Security Assessment",
          description:
            "Vulnerability assessment results from CI/CD pipeline security scanning tools",
          start: ts,
          "reviewed-controls": {
            "control-selections": [
              {
                "include-controls": [
                  { "control-id": "cm-02" },
                  { "control-id": "ra-05" },
                  { "control-id": "si-02" },
                ],
              },
            ],
          },
          observations: [
            {
              uuid: randomUUID(),
              description: `Pipeline vulnerability scans executed for commit ${commit || "unknown"}`,
              methods: ["TEST"],
              collected: ts,
            },
          ],
          findings,
        },
      ],
    },
  };
}

function generateComponentDefinition({ commit, runId, timestamp }) {
  return {
    "component-definition": {
      uuid: randomUUID(),
      metadata: metadata("CM02 System Component Definition"),
      components: [
        {
          uuid: randomUUID(),
          type: "software",
          title: "CM02 PDF Generator Lambda",
          description:
            "AWS Lambda function implementing NIST SP 800-53 CM-02 control assessment documentation",
          props: [
            { name: "commit", value: commit || "unknown" },
            {
              name: "build-timestamp",
              value: timestamp || new Date().toISOString(),
            },
          ],
          "control-implementations": [
            {
              uuid: randomUUID(),
              source:
                "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
              description: "NIST SP 800-53 Rev 5 controls implemented by CM02",
              "implemented-requirements": [
                {
                  uuid: randomUUID(),
                  "control-id": "cm-02",
                  description:
                    "The system maintains baseline configurations documented through automated PDF generation and evidence archival.",
                },
                {
                  uuid: randomUUID(),
                  "control-id": "sa-11",
                  description:
                    "Developer testing includes automated unit tests (Jest), vulnerability scanning (Trivy, npm audit), and secrets scanning (Gitleaks) executed on every pipeline run.",
                },
                {
                  uuid: randomUUID(),
                  "control-id": "sr-04",
                  description:
                    "Software supply chain provenance is established through SLSA build attestations, CycloneDX SBOMs, and SHA-pinned GitHub Actions dependencies.",
                },
              ],
            },
          ],
        },
        {
          uuid: randomUUID(),
          type: "service",
          title: "CM02 CI/CD Pipeline",
          description:
            "GitHub Actions pipeline implementing SSDF controls for secure software development",
          props: [{ name: "pipeline-run-id", value: runId || "unknown" }],
          "control-implementations": [
            {
              uuid: randomUUID(),
              source: "https://csrc.nist.gov/pubs/sp/800/218/final",
              description:
                "NIST SP 800-218 (SSDF) controls implemented by the CI/CD pipeline",
              "implemented-requirements": [
                {
                  uuid: randomUUID(),
                  "control-id": "po-5",
                  description:
                    "Build environment security: all GitHub Actions dependencies are SHA-pinned to prevent supply chain attacks.",
                },
                {
                  uuid: randomUUID(),
                  "control-id": "ps-1",
                  description:
                    "Software provenance: SLSA build provenance attestation generated for every deployment artifact.",
                },
                {
                  uuid: randomUUID(),
                  "control-id": "ps-2",
                  description:
                    "Provenance verification: build attestations archived with SHA-256 checksums to S3 evidence store.",
                },
                {
                  uuid: randomUUID(),
                  "control-id": "pw-4",
                  description:
                    "SBOM generation: CycloneDX SBOM produced on every build via anchore/sbom-action.",
                },
                {
                  uuid: randomUUID(),
                  "control-id": "pw-6",
                  description:
                    "Secrets scanning: Gitleaks scans all commits for exposed credentials before deployment.",
                },
                {
                  uuid: randomUUID(),
                  "control-id": "pw-7",
                  description:
                    "Dependency scanning: npm audit checks for known vulnerabilities in production dependencies.",
                },
                {
                  uuid: randomUUID(),
                  "control-id": "pw-8",
                  description:
                    "Static analysis: Trivy filesystem scanning for vulnerabilities; Jest test suite for functional verification.",
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function generateSSPFragment({ commit, runId, timestamp, evidenceRefs }) {
  const refs = evidenceRefs || {};
  const evidenceProps = [];
  if (refs.sbom)
    evidenceProps.push({ name: "evidence-sbom", value: refs.sbom });
  if (refs.scan)
    evidenceProps.push({ name: "evidence-scan", value: refs.scan });
  if (refs.provenance)
    evidenceProps.push({
      name: "evidence-provenance",
      value: refs.provenance,
    });

  return {
    "system-security-plan": {
      uuid: randomUUID(),
      metadata: metadata("CM02 System Security Plan Fragment"),
      "import-profile": {
        href: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline_profile.json",
      },
      "system-characteristics": {
        "system-ids": [{ id: "cm02-pilot" }],
        "system-name": "CM02 Baseline Configuration Assessment Tool",
        description:
          "Proof-of-concept pilot: AWS Lambda function generating NIST SP 800-53 CM-02 control assessment documentation with full CI/CD evidence archival",
        "security-sensitivity-level": "moderate",
        "system-information": {
          "information-types": [
            {
              uuid: randomUUID(),
              title: "Security Assessment Documentation",
              description:
                "Control implementation evidence and assessment artifacts",
              "confidentiality-impact": { base: "fips-199-moderate" },
              "integrity-impact": { base: "fips-199-moderate" },
              "availability-impact": { base: "fips-199-low" },
            },
          ],
        },
        "security-impact-level": {
          "security-objective-confidentiality": "moderate",
          "security-objective-integrity": "moderate",
          "security-objective-availability": "low",
        },
        status: { state: "operational" },
        "authorization-boundary": {
          description:
            "CM02 Lambda function, API Gateway endpoint, S3 evidence store, and GitHub Actions CI/CD pipeline",
        },
      },
      "system-implementation": {
        users: [
          {
            uuid: randomUUID(),
            title: "CI/CD Pipeline Service Account",
            "role-ids": ["pipeline"],
            props: [{ name: "type", value: "internal" }],
          },
        ],
        components: [
          {
            uuid: randomUUID(),
            type: "software",
            title: "CM02 Lambda Function",
            description:
              "Node.js Lambda function for CM-02 control assessment PDF generation",
            status: { state: "operational" },
          },
          {
            uuid: randomUUID(),
            type: "service",
            title: "S3 Evidence Store",
            description:
              "Authoritative evidence store with Object Lock, versioning, and integrity verification",
            status: { state: "operational" },
          },
        ],
      },
      "control-implementation": {
        description:
          "Control implementations for CM02 pilot system, validated through pipeline-produced evidence",
        "implemented-requirements": [
          {
            uuid: randomUUID(),
            "control-id": "cm-02",
            props: evidenceProps,
            remarks:
              "The organization develops, documents, and maintains baseline configurations for the CM02 system. Baseline configurations are reviewed and updated per organizationally defined frequency and circumstances. Evidence: automated PDF assessment generation, CI/CD pipeline evidence archival to S3.",
          },
        ],
      },
    },
  };
}

function validateStructure(doc) {
  const errors = [];

  if (doc["assessment-results"]) {
    const ar = doc["assessment-results"];
    if (!ar.uuid) errors.push("assessment-results: missing uuid");
    if (!ar.metadata) errors.push("assessment-results: missing metadata");
    if (!ar.metadata?.["oscal-version"])
      errors.push("assessment-results: missing oscal-version");
    if (!ar["import-ap"]) errors.push("assessment-results: missing import-ap");
    if (!ar.results?.length) errors.push("assessment-results: missing results");
    if (ar.results?.[0] && !ar.results[0].start)
      errors.push("assessment-results: result missing start timestamp");
  } else if (doc["component-definition"]) {
    const cd = doc["component-definition"];
    if (!cd.uuid) errors.push("component-definition: missing uuid");
    if (!cd.metadata) errors.push("component-definition: missing metadata");
    if (!cd.metadata?.["oscal-version"])
      errors.push("component-definition: missing oscal-version");
    if (!cd.components?.length)
      errors.push("component-definition: missing components");
  } else if (doc["system-security-plan"]) {
    const ssp = doc["system-security-plan"];
    if (!ssp.uuid) errors.push("system-security-plan: missing uuid");
    if (!ssp.metadata) errors.push("system-security-plan: missing metadata");
    if (!ssp.metadata?.["oscal-version"])
      errors.push("system-security-plan: missing oscal-version");
    if (!ssp["import-profile"])
      errors.push("system-security-plan: missing import-profile");
    if (!ssp["system-characteristics"])
      errors.push("system-security-plan: missing system-characteristics");
    if (!ssp["system-implementation"])
      errors.push("system-security-plan: missing system-implementation");
    if (!ssp["control-implementation"])
      errors.push("system-security-plan: missing control-implementation");
  } else {
    errors.push("Unknown OSCAL document type");
  }

  return errors;
}

module.exports = {
  generateAssessmentResults,
  generateComponentDefinition,
  generateSSPFragment,
  validateStructure,
  OSCAL_VERSION,
};
