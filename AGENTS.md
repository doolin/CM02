# AGENTS

## What this project is

CM02 is a serverless Lambda application that generates NIST SP 800-53
Rev 5 CM-02 (Baseline Configuration) PDF assessment forms. Users fill
out the web form and receive a pre-signed S3 URL to download the PDF.

Deployed behind CloudFront at `clubstraylight.com/cm02`.

## Architecture

- **Runtime:** Node.js on AWS Lambda behind a Function URL
- **Entry point:** `index.js` — Lambda handler serving HTML (GET) and
  generating PDFs (POST)
- **Local dev:** `serve.js` — standalone HTTP server (`npm start`,
  port 3000+)
- **Frontend:** Single-file `public/index.html` with inline CSS/JS
- **PDF generation:** `lib/cm02Pdf.js` using pdfkit
- **Storage:** S3 upload with pre-signed URLs (`lib/s3Upload.js`)

## CI/CD

Two workflow files in `.github/workflows/`:

- `golden-pipeline.yml` — reusable `workflow_call` pipeline: secrets
  scan (gitleaks), tests, vulnerability scan (npm audit + Trivy),
  SBOM generation (CycloneDX), OSCAL artifact generation, evidence
  verification
- `ci-cd.yml` — calls the golden pipeline, then deploys to Lambda and
  runs Solana attestation on master push

All GitHub Actions are pinned to full SHAs with Node 24 support.
Workflow-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` covers any
runner-injected actions (e.g. `actions/cache`).

## Testing

```bash
npm test          # jest, 87 tests across 8 suites
npm run format:check  # prettier
```

Always run tests before committing changes.

## Key directories

```
index.js          — Lambda handler
serve.js          — local dev server
public/           — static HTML (single page)
lib/              — business logic (PDF, validation, S3, rate limit, audit log, OSCAL)
scripts/          — CI scripts (attestation, OSCAL generation, evidence verification)
test/             — jest tests
data/             — NIST control catalog and extracted control JSON
```

## Compliance context

This project itself is a compliance tool and also follows NIST SSDF
practices in its own pipeline:

- **PW.4** — SBOM generation (CycloneDX)
- **PW.6** — Secrets scanning (gitleaks)
- **PW.7/PW.8** — Vulnerability scanning (npm audit, Trivy)
- **PS.1/PS.2** — Build provenance attestation
- **M-24-15** — OSCAL artifact generation

Evidence artifacts are archived to S3 with 90-day retention and
Solana on-chain attestation.
