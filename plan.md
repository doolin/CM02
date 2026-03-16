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

## PDF Layout — Mimics NIST SP 800-53A Format

The PDF mimics the format and style of the 800-53A publication, with an
**extra rightmost column ("Response")** for data entry by the caller.

### Visual Layout (10-row table)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CM-02  BASELINE CONFIGURATION                                         │
│  Configuration Management Family                                       │
├──────────────────────────┬──────────────────────┬──────────────────────┤
│  SECTION                 │  NIST TEXT            │  RESPONSE (input)    │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ 1. Control ID            │ CM-02                │                      │
│ 2. Control Name          │ Baseline Config.     │                      │
│ 3. System Name           │                      │ [from event]         │
│ 4. Implementation Status │                      │ [from event: enum]   │
│ 5. Control Statement     │ (a) Develop, doc...  │                      │
│    (multi-line)          │ (b) Review and...    │                      │
│ 6. Parameters (ODPs)     │ cm-02_odp.01: freq.  │ [from event]         │
│                          │ cm-02_odp.02: circ.  │ [from event]         │
│ 7. Impl. Narrative       │                      │ [from event: text]   │
│ 8. Responsible Role      │                      │ [from event]         │
│ 9. Assessment Objective  │ Determine if:        │                      │
│    ("Determine if:")     │  cm-2_obj.a-1: ...   │                      │
│                          │  cm-2_obj.a-2: ...   │                      │
│                          │  cm-2_obj.b.1: ...   │                      │
│                          │  cm-2_obj.b.2: ...   │                      │
│                          │  cm-2_obj.b.3: ...   │                      │
│ 10. Assessment Methods   │ EXAMINE: [list]      │                      │
│                          │ INTERVIEW: [list]    │                      │
│                          │ TEST: [list]         │                      │
└──────────────────────────┴──────────────────────┴──────────────────────┘
```

### Style Notes (mimic 800-53A PDF)
- **Font:** Times New Roman (or closest PDFKit equivalent: Times-Roman)
- **Header row:** bold, dark background, white text — control ID + name
- **Section labels:** left column, bold
- **NIST text:** center column, regular weight, verbatim from OSCAL
- **Response column:** rightmost, contains caller-supplied data entry values
- **Assessment methods:** use bold sub-labels (Examine / Interview / Test)
- **Border lines** between rows; gray alternating row shading

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
- Build 3-column, 10-row table mimicking 800-53A style
- Columns: Section | NIST Text | Response
- Header with control ID, name, family
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
