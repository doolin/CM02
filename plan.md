# Plan: CM-02 Baseline Configuration PDF Lambda

## Goal

Create a Node.js AWS Lambda that generates a filled-out PDF form for the
NIST SP 800-53 Rev 5 CM-02 (Baseline Configuration) control, uploads it
to the `inventium-artifacts` S3 bucket, and returns a presigned URL.

## Flow

```
Web Form  →  Lambda  →  PDF (PDFKit)  →  S3  →  Presigned URL  →  User
```

## Data Sources

- **OSCAL JSON catalog** — `data/NIST_SP-800-53_rev5_catalog.json`
  - Includes both 800-53 Rev 5 controls AND 800-53A Rev 5 assessment procedures
- **CM-02 extract** — `data/cm02-control.json` (full OSCAL object)
- **800-53A Rev 5 PDF** — `data/NIST.SP.800-53Ar5.pdf` (reference)
  - CM-02 section extracted to `data/NIST-800-53Ar5-CM-02-extract.pdf`

## PDF Layout — Matches NIST SP 800-53A Rev 5

The PDF mirrors the sections of an 800-53A assessment procedure entry,
with an extra rightmost **"Response"** column for user-provided values.

### 10-Row Table (matching 800-53A structure)

```
┌──────────────────────────────────────────────────────────────────┐
│  CM-02  BASELINE CONFIGURATION                                   │
├──────────────────┬─────────────────────┬─────────────────────────┤
│  SECTION         │  NIST TEXT          │  RESPONSE               │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 1. Control       │ CM-02 Baseline      │ [system name]           │
│    Number/Title  │ Configuration       │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 2. Control Text  │ a. Develop, doc...  │ [control text response] │
│                  │ b. Review and...    │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 3. Discussion    │ Baseline configs    │ [discussion response]   │
│                  │ for systems and...  │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 4. Related       │ AC-19, AU-6, CA-9,  │ [related controls       │
│    Controls      │ CM-1, CM-3, CM-5... │  response]              │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 5. Impl. Status  │ Impl | Partial...  │ [status from form]      │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 6. ODPs          │ ODP[01]: frequency  │ [frequency from form]   │
│                  │ ODP[02]: circum.    │ [circumstances]         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 7. Impl.         │                     │ [narrative from form]   │
│    Narrative     │                     │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 8. Assessment    │ Determine if:       │ [responsible role       │
│    Objective     │  a-1: ...           │  from form]             │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 9. Examine       │ [SELECT FROM:       │ [examine response]      │
│                  │  CM policy; ...]    │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 10. Interview    │ INTERVIEW: [...]    │ [interview/test         │
│     & Test       │ TEST: [...]         │  response]              │
└──────────────────┴─────────────────────┴─────────────────────────┘
```

### Row mapping to 800-53A sections

| Row | 800-53A Section             | NIST Text col                   | Response col                       |
| --- | --------------------------- | ------------------------------- | ---------------------------------- |
| 1   | Control Number & Title      | CM-02 Baseline Configuration    | System name *                      |
| 2   | Control Text                | Statement with substituted ODPs | Control text response              |
| 3   | Discussion                  | Guidance prose                  | Discussion response                |
| 4   | Related Controls            | AC-19, AU-6, CA-9, CM-1, etc.   | Related controls response          |
| 5   | Implementation Status       | Status options                  | Status *                           |
| 6   | Organization-Defined Params | ODP labels                      | Frequency *, Circumstances *       |
| 7   | Implementation Narrative    |                                 | Narrative *                        |
| 8   | Assessment Objective        | "Determine if:" + statements    | Responsible role *                 |
| 9   | Examine                     | [SELECT FROM: artifacts list]   | Examine response                   |
| 10  | Interview & Test            | Interview + Test lists          | Interview/test response            |

\* = required field

### Style (mimic 800-53A PDF)

- **Font:** Times-Roman (PDFKit built-in)
- **Header:** bold, dark blue background, white text
- **Section labels:** left column, bold
- **NIST text:** center column, verbatim from OSCAL
- **Response column:** rightmost, user-supplied values in navy
- **Borders** between rows; alternating gray row shading
- **Accessibility:** tagged PDF, document title, en-US lang

## Implementation Status

### Done

1. **PDF generator** (`lib/cm02Pdf.js`) — 10-row table with all response
   fields, ODP substitution, page breaks, accessibility metadata
2. **Web form** (`public/index.html`) — 3-column table layout matching
   PDF structure, localStorage draft save/load, all 10 response inputs
3. **Lambda handler** (`index.js`) — serves form on GET, validates and
   generates PDF on POST, trims inputs, rate limiting, audit logging
4. **Validation** (`lib/validate.js`) — required field checks with
   trimmed length limits (500 chars / 5000 for narrative)
5. **S3 upload** (`lib/s3Upload.js`) — upload PDF, return 30-min
   presigned URL, bucket configurable via `S3_BUCKET` env var
6. **Local dev server** (`serve.js`) — writes PDFs to `output/` instead
   of S3, serves form at `http://localhost:3002`
7. **CI/CD** (`.github/workflows/ci-cd.yml`) — test on PR, deploy to
   Lambda on push to `master`, smoke test via `jq`
8. **Terraform** (`terraform/`) — Lambda, API Gateway, OIDC deploy role,
   optional custom domain (S3 bucket/IAM policy managed in form-terra)
9. **Tests** — handler, validation (with boundary tests), PDF generation,
   rate limiting, e2e lifecycle
