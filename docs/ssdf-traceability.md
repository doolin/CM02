# SSDF Control Traceability Matrix

This document maps every artifact produced by the CI/CD pipeline to its
corresponding NIST SP 800-218 (SSDF v1.1) control. An auditor can verify
full SSDF coverage from this table alone.

**Reference:** [NIST SP 800-218 — Secure Software Development Framework v1.1](https://csrc.nist.gov/pubs/sp/800/218/final)

## Traceability Table

| SSDF Control | Control Name                                                                                                 | Artifact / Evidence                                   | Pipeline Stage                          | CI/CD Job                    | Showstopper |
| ------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------- | ---------------------------- | ----------- |
| PO.5         | Implement and Maintain Secure Environments for Software Development                                          | SHA-pinned actions, `ubuntu-latest` runner            | All jobs                                | All                          | Yes         |
| PS.1         | Protect All Forms of Code from Unauthorized Access and Tampering                                             | SLSA build provenance attestation (`deployment.zip`)  | `actions/attest-build-provenance`       | `deploy`                     | Yes         |
| PS.2         | Provide a Mechanism for Verifying Software Release Integrity                                                 | Build provenance + artifact upload with retention     | `actions/upload-artifact`               | `deploy`                     | Yes         |
| PW.4         | Reuse Existing, Well-Secured Software When Feasible; Generate SBOM                                           | CycloneDX SBOM (`sbom-cyclonedx.json`)                | `anchore/sbom-action`                   | `sbom`                       | Yes         |
| PW.6         | Configure the Compilation, Interpreter, and Build Processes to Improve Executable Security; Secrets Scanning | Gitleaks scan results (pass/fail + findings)          | `gitleaks/gitleaks-action`              | `secrets-scan`               | Yes         |
| PW.7         | Review and/or Analyze Human-Readable Code to Identify Vulnerabilities                                        | `npm audit` results (dependency vulnerability report) | `npm audit --audit-level=high`          | `vulnerability-scan`         | Yes         |
| PW.8         | Test Executable Code to Identify Vulnerabilities                                                             | Trivy filesystem scan results; Jest test results      | `aquasecurity/trivy-action`, `npm test` | `vulnerability-scan`, `test` | Yes         |

## Controls Not Producing Artifacts (Addressed by Process)

| SSDF Control | Control Name                                                    | How Addressed                                                     |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| PO.1         | Define Security Requirements for Software Development           | Documented in this traceability matrix and the compliance plan    |
| PO.2         | Implement Roles and Responsibilities                            | GitHub branch protection, CODEOWNERS, OIDC deploy role            |
| PO.3         | Implement Supporting Toolchain                                  | CI/CD pipeline itself; tool selection documented above            |
| PO.4         | Define and Use Criteria for Software Security Checks            | Pipeline gates: all security jobs must pass before deploy         |
| PW.1         | Design Software to Meet Security Requirements                   | Architecture decisions documented in project README and Terraform |
| PW.2         | Verify Third-Party Software Complies with Security Requirements | `npm audit` + Trivy scans of dependencies (PW.7/PW.8 artifacts)   |
| PW.5         | Create Source Code by Adhering to Secure Coding Practices       | Prettier formatting enforcement, code review via PR               |
| PW.9         | Configure Software to Have Secure Settings by Default           | Lambda least-privilege IAM role, API Gateway CORS configuration   |
| RV.1         | Identify and Confirm Vulnerabilities on an Ongoing Basis        | CI runs on every push (continuous scanning)                       |
| RV.2         | Assess, Prioritize, and Remediate Vulnerabilities               | Severity-gated scans (CRITICAL, HIGH); audit-level=high           |
| RV.3         | Analyze Vulnerabilities to Identify Root Causes                 | Trivy and npm audit provide CVE details and remediation guidance  |

## Pipeline Gate Architecture

```
  secrets-scan ──┐
  test ──────────┼──► deploy (master only)
  vuln-scan ─────┤
  sbom ──────────┘
```

All four pre-deploy jobs must pass. Deploy is gated to `master` branch pushes only.
Security jobs (`secrets-scan`, `vulnerability-scan`) run in parallel with `test` to
minimize pipeline duration without compromising coverage.

## Artifact Retention

| Artifact                        | Retention                        | Location                 |
| ------------------------------- | -------------------------------- | ------------------------ |
| SBOM (CycloneDX JSON)           | 90 days                          | GitHub Actions artifacts |
| Deployment package              | 90 days                          | GitHub Actions artifacts |
| Build provenance attestation    | Permanent                        | GitHub attestation store |
| Scan results (Trivy, npm audit) | Per GitHub Actions log retention | CI/CD logs               |
| Gitleaks results                | Per GitHub Actions log retention | CI/CD logs               |
