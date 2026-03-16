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
│ 1. Control       │ CM-02 Baseline      │ [system name from form] │
│    Number/Title  │ Configuration       │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 2. Control Text  │ a. Develop, doc...  │                         │
│                  │ b. Review and...    │                         │
│                  │    1. [frequency]   │                         │
│                  │    2. [circum.]     │                         │
│                  │    3. When...       │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 3. Discussion    │ Baseline configs    │                         │
│                  │ for systems and...  │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 4. Related       │ AC-19, AU-6, CA-9,  │                         │
│    Controls      │ CM-1, CM-3, CM-5... │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 5. Impl. Status  │                     │ [status from form]      │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 6. ODPs          │ ODP[01]: frequency  │ [frequency from form]   │
│                  │ ODP[02]: circum.    │ [circumstances]         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 7. Impl.         │                     │ [narrative from form]   │
│    Narrative     │                     │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 8. Assessment    │ Determine if:       │ [responsible role       │
│    Objective     │  a-1: ...           │  from form]             │
│                  │  a-2: ...           │                         │
│                  │  b.1–b.3: ...       │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 9. Examine       │ [SELECT FROM:       │                         │
│                  │  CM policy; ...]    │                         │
├──────────────────┼─────────────────────┼─────────────────────────┤
│ 10. Interview    │ [SELECT FROM:       │                         │
│     & Test       │  Personnel ...]     │                         │
│                  │ TEST: [SELECT FROM: │                         │
│                  │  Processes ...]     │                         │
└──────────────────┴─────────────────────┴─────────────────────────┘
```

### Row mapping to 800-53A sections

| Row | 800-53A Section             | NIST Text col                   | Response col                 |
| --- | --------------------------- | ------------------------------- | ---------------------------- |
| 1   | Control Number & Title      | CM-02 Baseline Configuration    | System name (from form)      |
| 2   | Control Text                | Statement with substituted ODPs |                              |
| 3   | Discussion                  | Guidance prose                  |                              |
| 4   | Related Controls            | AC-19, AU-6, CA-9, CM-1, etc.   |                              |
| 5   | Implementation Status       |                                 | Status (from form)           |
| 6   | Organization-Defined Params | ODP labels                      | ODP values (from form)       |
| 7   | Implementation Narrative    |                                 | Narrative (from form)        |
| 8   | Assessment Objective        | "Determine if:" + statements    | Responsible role (from form) |
| 9   | Examine                     | [SELECT FROM: artifacts list]   |                              |
| 10  | Interview & Test            | Interview + Test lists          |                              |

### Style (mimic 800-53A PDF)

- **Font:** Times-Roman (PDFKit built-in)
- **Header:** bold, dark blue background, white text
- **Section labels:** left column, bold
- **NIST text:** center column, verbatim from OSCAL
- **Response column:** rightmost, user-supplied values
- **Borders** between rows; alternating gray row shading

## Steps

### 1. Update PDF generator (`lib/cm02Pdf.js`)

- Restructure to the 10 rows above
- Add Discussion (guidance) row
- Add Related Controls row
- Split Examine and Interview/Test into separate rows
- Move Responsible Role into Assessment Objective response column

### 2. Update handler and tests

### 3. Update README (done)

### 4. Commit and push to `claude/read-readme-ew7mv`
