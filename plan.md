# Plan: CM-02 Baseline Configuration PDF Lambda

## Goal
Create a Node.js AWS Lambda that generates a filled-out PDF form for the
NIST SP 800-53 Rev 5 CM-02 (Baseline Configuration) control, uploads it
to the `inventium-artifacts` S3 bucket, and returns a presigned URL.

## Steps

### 1. Initialize Node.js project (`package.json`)
Dependencies:
- `pdfkit` — PDF generation (pure JS, no native deps, Lambda-friendly)
- `@aws-sdk/client-s3` — S3 upload
- `@aws-sdk/s3-request-presigner` — presigned URLs

Dev dependencies:
- `jest` — testing

### 2. Create the Lambda handler (`index.js`)
- Accept event payload with CM-02 control field values (system name,
  implementation narrative, responsible role, status, etc.)
- Fall back to sensible defaults when fields are omitted
- Entry point: `exports.handler = async (event) => { ... }`
- Orchestrate: generate PDF → upload to S3 → return presigned URL

### 3. Create PDF generator (`lib/cm02Pdf.js`)
Build a PDF with PDFKit containing the NIST 800-53 Rev 5 CM-02 fields:
- **Control ID:** CM-02
- **Control Name:** Baseline Configuration
- **Family:** Configuration Management
- **System Name** (from input)
- **Implementation Status** (from input)
- **Control Description** (standard NIST text)
- **Implementation Detail / Narrative** (from input)
- **Responsible Role** (from input)
- Layout: header, control info table, narrative section, signature/date

### 4. Create S3 uploader (`lib/s3Upload.js`)
- Write PDF bytes to `inventium-artifacts` under key `cm02/<uuid>.pdf`
- Generate 30-minute presigned GET URL
- Return the URL (follows the pattern documented in README)

### 5. Add tests (`test/`)
- Unit test for PDF generation (verify output is valid PDF buffer)
- Unit test for handler (mock S3, verify response shape)

### 6. Commit and push to `claude/read-readme-ew7mv`
