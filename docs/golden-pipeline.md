# Golden Pipeline: Pre-Approved Compliant CI/CD Template

**References:**

- [NIST SP 800-218 — Secure Software Development Framework (SSDF) v1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OMB M-26-05 — Risk-Based Approach to Software and Hardware Security](https://www.whitehouse.gov/wp-content/uploads/2026/01/M-26-05-Adopting-a-Risk-based-Approach-to-Software-and-Hardware-Security.pdf)
- [OMB M-24-15 — Modernizing FedRAMP](https://www.fedramp.gov/docs/authority/m-24-15/)

## Overview

The Golden Pipeline is a reusable GitHub Actions workflow that embeds all required compliance controls as mandatory, non-disableable stages. Teams adopt it to inherit a fully compliant CI/CD pipeline with zero compliance configuration.

The pipeline is defined in `.github/workflows/golden-pipeline.yml` and called from project-specific workflows via `workflow_call`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Golden Pipeline (reusable)                  │
│                                                                 │
│  ┌──────────────┐  ┌──────┐  ┌────────────────────┐            │
│  │ Secrets Scan  │  │ Test │  │ Vulnerability Scan  │            │
│  │    (PW.6)     │  │      │  │   (PW.7, PW.8)     │            │
│  └──────────────┘  └──┬───┘  └─────────┬──────────┘            │
│                       │                 │                        │
│                  ┌────▼───┐      ┌──────▼──────┐                │
│                  │  SBOM  │      │    OSCAL     │                │
│                  │ (PW.4) │      │  (M-24-15)  │                │
│                  └────┬───┘      └──────┬──────┘                │
│                       │                 │                        │
│                  ┌────▼─────────────────▼──────┐                │
│                  │    Evidence Verification     │                │
│                  │     (drift detection)        │                │
│                  └─────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ Project-Specific   │
                    │ Deploy Job         │
                    │ (calling workflow) │
                    └───────────────────┘
```

## Mandatory Stages

These stages cannot be bypassed or removed. They are embedded in the reusable workflow.

| Stage                 | SSDF Control | Tooling                    | Evidence Produced                                                                       |
| --------------------- | ------------ | -------------------------- | --------------------------------------------------------------------------------------- |
| Secrets Scan          | PW.6         | Gitleaks                   | Pass/fail gate                                                                          |
| Test                  | PW.8         | Jest + Prettier            | Pass/fail gate                                                                          |
| Vulnerability Scan    | PW.7, PW.8   | npm audit, Trivy           | npm-audit-results.json, trivy-scan-results.json                                         |
| SBOM Generation       | PW.4         | anchore/sbom-action        | sbom-cyclonedx.json                                                                     |
| OSCAL Generation      | M-24-15      | scripts/generate-oscal.js  | oscal-assessment-results.json, oscal-component-definition.json, oscal-ssp-fragment.json |
| Evidence Verification | WS5          | scripts/verify-evidence.js | evidence-manifest.json                                                                  |

## Adoption

### Minimal Example

```yaml
name: CI/CD

on:
  push:
  pull_request:
    branches: [main]

permissions:
  contents: read
  id-token: write
  attestations: write
  security-events: write

jobs:
  compliance:
    uses: ./.github/workflows/golden-pipeline.yml
    permissions:
      contents: read
      id-token: write
      attestations: write
      security-events: write
    secrets: inherit
```

### With Deployment

```yaml
jobs:
  compliance:
    uses: ./.github/workflows/golden-pipeline.yml
    permissions:
      contents: read
      id-token: write
      attestations: write
      security-events: write
    secrets: inherit

  deploy:
    needs: compliance
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      # Project-specific deployment steps
      # Evidence artifacts are available via actions/download-artifact
```

### Cross-Repository Usage

For org-wide adoption, host the golden pipeline in a central repository:

```yaml
jobs:
  compliance:
    uses: my-org/golden-pipeline/.github/workflows/golden-pipeline.yml@v1
    secrets: inherit
```

## Customization

The golden pipeline accepts inputs for project-specific configuration. All inputs have defaults.

| Input                  | Default                  | Description                    |
| ---------------------- | ------------------------ | ------------------------------ |
| `node-version`         | `"20"`                   | Node.js version for all stages |
| `test-command`         | `"npm test"`             | Test command to execute        |
| `format-check-command` | `"npm run format:check"` | Code formatting check          |
| `trivy-severity`       | `"CRITICAL,HIGH"`        | Trivy scan severity threshold  |
| `npm-audit-level`      | `"high"`                 | npm audit minimum severity     |

Example with custom inputs:

```yaml
jobs:
  compliance:
    uses: ./.github/workflows/golden-pipeline.yml
    with:
      node-version: "22"
      test-command: "npm run test:ci"
      trivy-severity: "CRITICAL"
    secrets: inherit
```

## Inheritance Model

| What teams CAN do                          | What teams CANNOT do                 |
| ------------------------------------------ | ------------------------------------ |
| Add project-specific deploy jobs           | Remove mandatory security stages     |
| Customize inputs (Node version, severity)  | Skip secrets scanning                |
| Add additional test stages                 | Bypass vulnerability scanning        |
| Extend with project-specific checks        | Omit SBOM or OSCAL generation        |
| Choose when to deploy (branch, conditions) | Deploy without evidence verification |

## Required Project Files

Projects adopting the golden pipeline must include:

| File                         | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `package.json`               | With `test` and `format:check` scripts |
| `scripts/generate-oscal.js`  | OSCAL artifact generation              |
| `scripts/verify-evidence.js` | Evidence completeness verification     |
| `lib/oscal.js`               | OSCAL generation library               |
| `lib/evidenceManifest.js`    | Evidence manifest library              |

For org-wide adoption, these shared libraries should be published as an npm package or checked out from a central repository during CI.

## Certification

- [ ] SSD/CISO organization review and certification
- [ ] Documented as the approved path for all new FSA projects
- [ ] Annual review cycle aligned with SSDF and M-26-05 updates
