# Plan: CM-02 Baseline Configuration PDF Lambda

## Goal
Create a Node.js AWS Lambda that generates a filled-out PDF form for the
NIST SP 800-53 Rev 5 CM-02 (Baseline Configuration) control, uploads it
to the `inventium-artifacts` S3 bucket, and returns a presigned URL.

## Data Sources
- **OSCAL JSON catalog** — downloaded to `data/NIST_SP-800-53_rev5_catalog.json` (10MB)
  - Source: [usnistgov/oscal-content](https://github.com/usnistgov/oscal-content)
  - Includes both 800-53 Rev 5 controls AND 800-53A Rev 5 assessment procedures
- **CM-02 extract** — `data/cm02-control.json` (full OSCAL object) and
  `data/cm02-verbatim.txt` (human-readable text)
- **800-53A PDF** — not downloadable from this environment (403); assessment
  procedure content is already in the OSCAL JSON

## PDF Form: 10-Line Table

The generated PDF contains a table with 10 rows:

| # | Field                     | Source                         |
|---|---------------------------|--------------------------------|
| 1 | Control ID                | `CM-02` (static)               |
| 2 | Control Name              | `Baseline Configuration`       |
| 3 | Control Family            | `Configuration Management`     |
| 4 | System Name               | event input                    |
| 5 | Implementation Status     | event input (enum)             |
| 6 | Control Description       | OSCAL statement text           |
| 7 | Implementation Narrative  | event input (free text)        |
| 8 | Responsible Role          | event input                    |
| 9 | Parameters (ODPs)         | event input (frequency, circumstances) |
| 10| Assessment Objective      | OSCAL assessment objectives    |

## Steps

### 1. Initialize Node.js project (`package.json`)
Dependencies:
- `pdfkit` — PDF generation (pure JS, no native deps, Lambda-friendly)
- `@aws-sdk/client-s3` — S3 upload
- `@aws-sdk/s3-request-presigner` — presigned URLs

Dev dependencies:
- `jest` — testing

### 2. Create the Lambda handler (`index.js`)
- Accept event payload with CM-02 field values:
  - `systemName` (string)
  - `implementationStatus` (enum: Implemented | Partially Implemented | Planned | Alternative | Not Applicable)
  - `implementationNarrative` (string, free text)
  - `responsibleRole` (string)
  - `frequency` (string — fills ODP cm-02_odp.01)
  - `circumstances` (string — fills ODP cm-02_odp.02)
- Fall back to sensible defaults when fields are omitted
- Entry point: `exports.handler = async (event) => { ... }`
- Orchestrate: generate PDF → upload to S3 → return presigned URL

### 3. Create PDF generator (`lib/cm02Pdf.js`)
- Read control text from `data/cm02-control.json`
- Substitute ODP parameters with caller-provided values
- Build 10-row table layout with PDFKit
- Header with NIST branding / form title
- Return PDF as a Buffer

### 4. Create S3 uploader (`lib/s3Upload.js`)
- Write PDF bytes to `inventium-artifacts` under key `cm02/<uuid>.pdf`
- Generate 30-minute presigned GET URL
- Return the URL (follows the pattern documented in README)

### 5. Add tests (`test/`)
- Unit test for PDF generation (verify output is valid PDF buffer)
- Unit test for handler (mock S3, verify response shape)
- Verify ODP substitution works correctly

### 6. Commit and push to `claude/read-readme-ew7mv`
