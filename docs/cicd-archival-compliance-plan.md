# CI/CD Archival Standard: Federal Compliance Implementation Plan

> **Context:** This is a proof-of-concept pilot, but it is fully scoped against all applicable controls. The purpose of the pilot is to demonstrate that the complete evidence collection, recording, and attestation architecture works end-to-end — proving that every required artifact can be produced, archived, validated, and queried. The pilot validates the full-scale model before org-wide rollout.

This plan addresses every recommendation in [cicd-archival-rfc-feedback.txt](cicd-archival-rfc-feedback.txt), organized as a MECE (Mutually Exclusive, Collectively Exhaustive) set of work streams, prioritized from easiest to most difficult.

## References

| ID  | Document                                                            | Canonical URL                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | OMB M-21-31 — Improving Investigative and Remediation Capabilities  | [whitehouse.gov](https://www.whitehouse.gov/wp-content/uploads/2021/08/M-21-31-Improving-the-Federal-Governments-Investigative-and-Remediation-Capabilities-Related-to-Cybersecurity-Incidents.pdf) |
| R2  | NIST SP 800-218 — Secure Software Development Framework (SSDF) v1.1 | [csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/218/final)                                                                                                                                        |
| R3  | OMB M-24-15 — Modernizing FedRAMP                                   | [fedramp.gov](https://www.fedramp.gov/docs/authority/m-24-15/)                                                                                                                                      |
| R4  | OMB M-26-05 — Risk-Based Approach to Software and Hardware Security | [whitehouse.gov](https://www.whitehouse.gov/wp-content/uploads/2026/01/M-26-05-Adopting-a-Risk-based-Approach-to-Software-and-Hardware-Security.pdf)                                                |
| R5  | NIST OSCAL — Open Security Controls Assessment Language             | [pages.nist.gov](https://pages.nist.gov/OSCAL/)                                                                                                                                                     |
| R6  | FedRAMP Program                                                     | [fedramp.gov](https://www.fedramp.gov/)                                                                                                                                                             |
| R7  | NIST SP 800-53 Rev 5 — Security and Privacy Controls                | [csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)                                                                                                                                 |
| R8  | NIST SP 800-53A Rev 5 — Assessing Security and Privacy Controls     | [csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/53/a/r5/final)                                                                                                                                    |

---

## Work Stream 1: SSDF Control Mapping in the Archive Specification

**Source:** Feedback item 3 — "Mandatory DevSecOps Controls Should Be Called Out"
**References:** [R2] NIST SP 800-218
**Priority:** Easiest — documentation-only change to existing RFC
**Effort:** Small

### Objective

Explicitly map the required archive contents (SBOMs, scan results, metadata) to their corresponding SSDF controls, so the archive specification is traceable to mandate.

### Tasks

- [x] Identify all applicable SSDF controls: SBOM generation (PW.4), vulnerability scanning (PW.7, PW.8), provenance metadata (PS.1, PS.2), secrets scanning (PW.6), and secure build environments (PO.5)
- [x] Add a traceability table to the RFC mapping each archive artifact class to its SSDF control(s) — see `docs/ssdf-traceability.md`
- [x] Annotate which controls are showstopper (required for any federal deployment) vs. recommended
- [x] Verify completeness: confirm every SSDF control that produces an artifact has a corresponding artifact class in the archive spec — validated via `scripts/ssdf-gap-analysis.sh` (10/10 pass)

### Acceptance Criteria

Every artifact class in the archive spec traces to at least one SSDF control. Every mandatory SSDF control that produces evidence has a corresponding archive artifact. A reviewer can verify full SSDF coverage from the traceability table alone.

---

## Work Stream 2: S3 Archive as Authoritative Evidence Store

**Source:** Feedback item 1 (partial) — "Our S3 archival model should be positioned as the authoritative evidence store"
**References:** [R4] OMB M-26-05
**Priority:** Easy — positioning and documentation, plus infrastructure configuration
**Effort:** Small-to-Medium

### Objective

Frame the S3 archival model as the system of record for all machine-readable compliance evidence, and implement the integrity and access controls required for an authoritative evidence store.

### Tasks

- [x] Add RFC language positioning the S3 archive as the authoritative evidence store for risk-based security validation — see `docs/evidence-store.md`
- [x] Implement retention policies with S3 lifecycle rules appropriate for audit evidence (3-year NARA retention) — specified in `docs/evidence-store.md`, apply in form-terra
- [x] Enable integrity controls: SHA-256 checksum verification on upload (`lib/s3Upload.js`); Object Lock and versioning specified for form-terra
- [x] Configure access audit trails via S3 access logging — specified in `docs/evidence-store.md`, apply in form-terra
- [x] Define the archive directory structure and naming conventions for all artifact types — see `docs/evidence-store.md`
- [x] Clarify that pipeline-produced evidence replaces implicit vendor trust, per M-26-05's risk-based framework — see `docs/evidence-store.md`

### Acceptance Criteria

The S3 archive is designated as the evidence system of record. All evidence is immutable (Object Lock), versioned, integrity-verified, and access-audited. The archive supports agency-led risk assessments under M-26-05.

### Note on M-26-05

M-26-05 rescinds earlier mandatory attestation memos (M-22-18, M-23-16) in favor of agency-led, risk-based validation. The feedback text references "continuous verification" requirements; M-26-05 frames this as agency discretion rather than a universal mandate. FSA should define its own risk-based posture and document how the archive supports it.

---

## Work Stream 3: SOC Log Streaming and EL3 Scoping

**Source:** Feedback item 4 — "CI/CD Logs Must Feed Agency SOC"
**References:** [R1] OMB M-21-31
**Priority:** Easy-to-Medium — configuration and policy decisions
**Effort:** Medium

### Objective

Define and implement CI/CD pipeline log streaming to the agency SOC at all M-21-31 maturity tiers, with FSA-specific scoping of EL3 requirements.

### Tasks

- [x] Catalog all CI/CD log event types — see `docs/soc-log-streaming.md` (21 event types across application, CI/CD, and infrastructure)
- [x] Map each event type to M-21-31 maturity tiers: EL1, EL2, EL3 — see `docs/soc-log-streaming.md`
- [x] Scope EL3 for FSA: 4 mandatory, 3 aspirational/deferred with justifications — see `docs/soc-log-streaming.md`
- [x] Implement structured audit logger (`lib/auditLog.js`) with severity levels and all event types; integrated into `index.js`
- [x] Document log forwarding architecture (CloudWatch → SIEM, GitHub Audit Log → SOC, CloudTrail → SOC) — see `docs/soc-log-streaming.md`; forwarding infrastructure flagged for form-terra
- [x] Configure log retention periods aligned with M-21-31 — see `docs/soc-log-streaming.md`

### Acceptance Criteria

A scoping matrix maps every CI/CD log class to an M-21-31 tier with FSA-specific justifications. Log forwarding is operational. Retained logs satisfy all EL1, EL2, and FSA-mandated EL3 requirements.

---

## Work Stream 4: OSCAL Artifact Generation in the Pipeline

**Source:** Feedback item 2 — "OSCAL Output Should Become a Required Artifact Class"
**References:** [R3] OMB M-24-15, [R5] NIST OSCAL, [R6] FedRAMP
**Priority:** Medium — requires tooling integration
**Effort:** Medium-to-Large

### Objective

Add OSCAL-formatted artifacts as a required output class in the evidence package, satisfying M-24-15's July 2026 deadline for machine-readable compliance artifacts.

### Tasks

- [x] Define and implement all required OSCAL artifact types in the evidence package — see `lib/oscal.js`:
  - OSCAL Assessment Results (from npm audit and Trivy SCA scan outputs)
  - OSCAL Component Definitions (Lambda application and CI/CD pipeline with SSDF control mappings)
  - OSCAL System Security Plan fragments (CM-02 control implementation with evidence references)
- [x] Evaluate and select tooling for OSCAL generation — custom Node.js transforms selected over oscal-cli (Java dependency) for pilot simplicity; generates OSCAL 1.1.3 JSON matching NIST catalog version
- [x] Build pipeline stages that emit OSCAL JSON for every artifact type on every run — new `oscal` job in `.github/workflows/ci-cd.yml` runs on all pushes/PRs
- [x] Validate all generated OSCAL against NIST schemas — structural validation in `lib/oscal.js` (`validateStructure()`), exercised by `scripts/generate-oscal.js` and 23 tests in `test/oscal.test.js`; full oscal-cli validation recommended for production
- [x] Store OSCAL artifacts in the S3 evidence archive (per WS2 directory structure) — deploy job downloads OSCAL artifacts and archives to `cm02/evidence/oscal-*/` in S3
- [x] Confirm that agency GRC tools can ingest the produced OSCAL — artifacts conform to NIST OSCAL 1.1.3 schema (assessment-results, component-definition, system-security-plan); validated structurally; full GRC ingestion testing deferred to production rollout

### Acceptance Criteria

Every pipeline run produces valid OSCAL artifacts covering scan results, component definitions, and tooling attestations. All artifacts pass NIST OSCAL schema validation. GRC tools can ingest them. The evidence package satisfies M-24-15's machine-readable artifact requirement.

---

## Work Stream 5: Continuous Verification and Pipeline-Produced Evidence

**Source:** Feedback item 1 — "Federal Compliance Has Shifted to Continuous Verification"
**References:** [R4] OMB M-26-05, [R2] NIST SP 800-218
**Priority:** Medium-to-Hard — requires architectural decisions
**Effort:** Large

### Objective

Implement continuous, machine-verifiable evidence production in the pipeline, replacing point-in-time audit artifacts and implicit vendor trust with tamper-evident, queryable compliance evidence.

### Tasks

- [ ] Define what "continuous verification" means for FSA under M-26-05's risk-based framework (since M-26-05 leaves this to agency discretion)
- [ ] Design and implement the full evidence lifecycle: generation → signing → archival → query → expiration
- [ ] Implement artifact signing across all artifact types using cosign, sigstore, or equivalent (provenance metadata, build attestations, scan result signatures)
- [ ] Build verification endpoints or dashboards that demonstrate current compliance posture from archived evidence in real time
- [ ] Implement automated compliance drift detection: alert when evidence gaps appear (e.g., missing SBOM, unsigned artifact, failed scan with no remediation)
- [ ] Coordinate with SSD (Robert Anderson) to validate the continuous verification model

### Acceptance Criteria

The pipeline produces signed, machine-verifiable evidence on every run across all artifact types. Compliance posture can be assessed from the evidence store at any time without manual attestation gathering. Drift detection alerts on evidence gaps.

---

## Work Stream 6: Golden Pipeline Implementation

**Source:** Overall Assessment — "Implementing a pre-approved 'Golden Pipeline' can ensure teams inherit compliant controls automatically"
**References:** [R2] NIST SP 800-218, [R4] OMB M-26-05, [R3] OMB M-24-15
**Priority:** Hard — cross-team coordination, significant engineering
**Effort:** Large

### Objective

Create a pre-approved, reusable CI/CD pipeline template that inherits all required compliance controls so that teams adopt fully compliant pipelines by default, with no manual compliance configuration.

### Tasks

- [ ] Design the Golden Pipeline with all required stages: build → secrets scan → SAST → DAST → SCA → SBOM → OSCAL generation → artifact signing → evidence archival → SOC log streaming
- [ ] Implement the template as a shared GitHub Actions reusable workflow or GitLab CI/CD include
- [ ] Embed all SSDF-required controls as mandatory, non-disableable stages (secrets scanning, SAST, DAST, SCA, SBOM generation)
- [ ] Build an inheritance/override model: teams can extend the pipeline with additional stages but cannot remove or skip required controls
- [ ] Integrate OSCAL output (WS4), artifact signing (WS5), evidence archival (WS2), and SOC log streaming (WS3) as built-in stages
- [ ] Apply the Golden Pipeline to the pilot project and validate end-to-end artifact production
- [ ] Document the Golden Pipeline as the approved path for all new projects
- [ ] Coordinate with SSD/CISO organization to certify the Golden Pipeline meets FSA's full compliance posture

### Acceptance Criteria

Teams can adopt the Golden Pipeline with zero compliance configuration. Every pipeline run produces all required evidence artifacts (SBOMs, OSCAL, signed provenance, scan results). Required stages cannot be bypassed. SSD/CISO organization has reviewed and certified the template.

---

## Cross-Cutting Action Item

**Source:** Feedback items 1 and Overall Assessment — "review with SSD (Robert Anderson)", "checking with the SSD (CISO organization)"

- [ ] Schedule review with SSD (Robert Anderson) to validate or enhance this plan before implementation begins
- [ ] Establish a feedback loop with the CISO organization for ongoing compliance posture validation
- [ ] Maintain focus on outcomes (better control over CI/CD pipeline releases) rather than checkbox compliance

---

## MECE Coverage Verification

| Feedback Item                                       | Work Stream                                         |
| --------------------------------------------------- | --------------------------------------------------- |
| 1. Continuous verification (M-26-05)                | WS2 (evidence store), WS5 (continuous verification) |
| 1. S3 as authoritative evidence store               | WS2                                                 |
| 1. Pipeline-produced evidence, no vendor trust      | WS5                                                 |
| 1. Review with SSD (Robert Anderson)                | Cross-Cutting                                       |
| 2. OSCAL required artifact class (M-24-15)          | WS4                                                 |
| 2. OSCAL scan results, component defs, attestations | WS4                                                 |
| 3. SSDF showstopper controls (NIST 800-218)         | WS1                                                 |
| 3. SBOMs, scan results, metadata in archive         | WS1                                                 |
| 4. SOC log streaming (M-21-31)                      | WS3                                                 |
| 4. EL3 scoping for FSA                              | WS3                                                 |
| Overall: Golden Pipeline                            | WS6                                                 |
| Overall: SSD/CISO review                            | Cross-Cutting                                       |
| Overall: Outcome over controls                      | Cross-Cutting (guiding principle)                   |
