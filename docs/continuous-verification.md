# Continuous Verification: FSA Implementation Under M-26-05

**References:**

- [OMB M-26-05 — Risk-Based Approach to Software and Hardware Security](https://www.whitehouse.gov/wp-content/uploads/2026/01/M-26-05-Adopting-a-Risk-based-Approach-to-Software-and-Hardware-Security.pdf)
- [NIST SP 800-218 — Secure Software Development Framework (SSDF) v1.1](https://csrc.nist.gov/pubs/sp/800/218/final)

## FSA's Definition of Continuous Verification

M-26-05 rescinds the mandatory vendor attestation model (M-22-18, M-23-16) in favor of agency-led, risk-based validation. FSA defines continuous verification as:

> **Every merge to the production branch produces a complete, integrity-verified evidence package demonstrating that all required security controls were executed and passed. Compliance posture is assessable from the evidence store at any time without manual attestation gathering.**

This replaces point-in-time audit artifacts and implicit vendor trust with tamper-evident, machine-readable evidence produced automatically by the CI/CD pipeline.

## Evidence Lifecycle

```
Generation ──► Integrity Verification ──► Archival ──► Query ──► Expiration
   │                    │                     │           │           │
   │              SHA-256 checksums      S3 Object    Evidence    3-year
   │              SLSA provenance        Lock +       manifest    NARA
   │              Evidence manifest      versioning   queries     retention
   │                                                              lifecycle
   │
   ├── SBOM (CycloneDX)
   ├── Vulnerability scans (npm audit, Trivy)
   ├── OSCAL artifacts (Assessment Results, Component Definition, SSP fragment)
   ├── Secrets scan (Gitleaks pass/fail)
   ├── Build provenance (SLSA attestation)
   └── Evidence manifest (artifact inventory with checksums)
```

### Generation

Every pipeline run produces evidence artifacts as a byproduct of security controls:

| Control (SSDF) | Artifact                             | Format             |
| -------------- | ------------------------------------ | ------------------ |
| PW.4           | Software Bill of Materials           | CycloneDX JSON     |
| PW.6           | Secrets scan results                 | Gitleaks pass/fail |
| PW.7           | Dependency vulnerability scan        | npm audit JSON     |
| PW.8           | Static analysis / vulnerability scan | Trivy JSON         |
| PS.1, PS.2     | Build provenance                     | SLSA attestation   |
| M-24-15        | OSCAL Assessment Results             | OSCAL 1.1.3 JSON   |
| M-24-15        | OSCAL Component Definition           | OSCAL 1.1.3 JSON   |
| M-24-15        | OSCAL SSP Fragment                   | OSCAL 1.1.3 JSON   |

### Integrity Verification

Evidence integrity is established at three layers:

1. **Artifact-level:** SHA-256 checksums computed at generation and verified on S3 upload (`ChecksumSHA256`).
2. **Package-level:** Evidence manifest lists all artifacts with their checksums, providing a tamper-evident inventory of the complete evidence package.
3. **Build-level:** SLSA build provenance attestation via `actions/attest-build-provenance` ties the deployment artifact to the specific pipeline run, commit, and actor.

**Production recommendation:** Add individual artifact signing via cosign/sigstore for cryptographic non-repudiation beyond what S3 server-side integrity provides.

### Archival

Evidence is archived to the S3 evidence store (`inventium-artifacts`) with:

- Object Lock (compliance mode, 3-year retention) — prevents deletion or modification
- Versioning — preserves history of all evidence
- Access logging — audits who accessed evidence and when
- Naming convention: `cm02/evidence/<type>/<timestamp>-<commit>-<filename>`

See `docs/evidence-store.md` for full archival architecture.

### Query

Compliance posture for any pipeline run can be assessed by:

1. Querying the evidence manifest for the run (`evidence-manifest.json`)
2. Verifying that all required artifact types are present
3. Checking that artifact checksums match the manifest
4. Reviewing OSCAL Assessment Results for scan findings

The `scripts/verify-evidence.js` script automates this process.

### Expiration

Evidence follows the retention policy defined in `docs/evidence-store.md`:

- Evidence artifacts: 3 years (NARA retention, S3 Object Lock)
- PDFs: 24 hours (ephemeral, user-facing)
- Access logs: 3 years

## Evidence Completeness Requirements

A complete evidence package for a production deployment must contain:

| Artifact Type                | Required | Source Job                               |
| ---------------------------- | -------- | ---------------------------------------- |
| `sbom-cyclonedx`             | Yes      | `sbom`                                   |
| `npm-audit-results`          | Yes      | `vulnerability-scan`                     |
| `trivy-scan-results`         | Yes      | `vulnerability-scan`                     |
| `oscal-assessment-results`   | Yes      | `oscal`                                  |
| `oscal-component-definition` | Yes      | `oscal`                                  |
| `oscal-ssp-fragment`         | Yes      | `oscal`                                  |
| `evidence-manifest`          | Yes      | `deploy` (generated during verification) |

The deploy job verifies completeness before archival. If any required artifact is missing, the pipeline fails.

## Compliance Drift Detection

Drift detection operates at two levels:

### Pipeline-Level (Automated)

The `verify-evidence` step in the deploy job checks evidence completeness before every deployment. Missing artifacts block deployment, ensuring no code reaches production without full evidence.

### Operational (Manual / Scheduled)

For ongoing verification between deployments:

- Query S3 evidence store for the most recent evidence manifest
- Verify that evidence exists for the current production commit
- Check evidence age against the review frequency (e.g., if the last evidence is older than the defined review cycle, flag for re-assessment)

**TODO (form-terra):** Implement a scheduled Lambda or EventBridge rule that runs `verify-evidence` against the evidence store and alerts via SNS when evidence gaps are detected.

## Artifact Integrity Model

### Current (Pilot)

| Layer                | Mechanism                                              | Status                 |
| -------------------- | ------------------------------------------------------ | ---------------------- |
| Build provenance     | SLSA attestation via `actions/attest-build-provenance` | Implemented            |
| Artifact checksums   | SHA-256 computed at generation, verified on S3 upload  | Implemented            |
| Evidence manifest    | Tamper-evident artifact inventory with checksums       | Implemented            |
| Storage integrity    | S3 `ChecksumSHA256` on every upload                    | Implemented            |
| Storage immutability | S3 Object Lock (compliance mode)                       | Specified (form-terra) |

### Production Recommendations

| Layer            | Mechanism                               | Status      |
| ---------------- | --------------------------------------- | ----------- |
| Artifact signing | cosign/sigstore per-artifact signatures | Recommended |
| Manifest signing | cosign-signed evidence manifest         | Recommended |
| Key management   | AWS KMS or Sigstore Fulcio (keyless)    | Recommended |
| Transparency log | Sigstore Rekor for public verifiability | Optional    |

## Coordination

- [ ] Review continuous verification model with SSD (Robert Anderson)
- [ ] Establish feedback loop with CISO organization for ongoing posture validation
