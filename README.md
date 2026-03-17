# Compliance

## How it works

A user fills out a web form with their system-specific values for the
NIST SP 800-53 Rev 5 CM-02 (Baseline Configuration) control. The form
submits to an AWS Lambda, which generates a PDF that mirrors the layout
of the NIST SP 800-53A Rev 5 assessment procedure — with the user's
responses filled into a rightmost "Response" column. The Lambda uploads
the PDF to S3 and returns a presigned URL so the user can download it
immediately.

```
Web Form  →  Lambda  →  PDF (PDFKit)  →  S3  →  Presigned URL  →  User
```

## Run on localhost

```bash
npm install
npm start
```

Then open:

`http://localhost:3000`

Notes:

- If port 3000 is busy, the server automatically tries the next available port.
- You can force a specific port with `PORT=3005 npm start`.
- Generated PDFs are written to the `output/` directory and returned as localhost URLs.

### Web form fields

The form is a 10-row table (Section | NIST Text | Response) matching
the 800-53A assessment layout. Required fields are marked with *.

- **System Name** * — name of the system being assessed
- **Control Text Response** — how the system addresses each sub-requirement
- **Discussion Response** — what baselines cover and where they are stored
- **Related Controls Response** — which related controls are most relevant
- **Implementation Status** * — Implemented | Partially Implemented | Planned | Alternative | Not Applicable
- **Organization-Defined Parameters** *
  - Frequency of baseline review/update (CM-02_ODP[01])
  - Circumstances requiring review/update (CM-02_ODP[02])
- **Implementation Narrative** * — free-text description of how CM-02 is implemented
- **Responsible Role** * — role accountable for the control
- **Examine Response** — specific artifacts/evidence for the system
- **Interview & Test Response** — interviewees and test procedures

### Example: Federal Information System

The table below shows example values for a federal agency system at
FISMA Moderate baseline.

| Row | Section                     | NIST Text                                                                                                                                                                                                                                                                                                 | Response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CM-02_ODP[01]         | the frequency of baseline configuration review and update is defined; Configuration                                                                                                                                                                                                                                                                              | Annually and whenever directed by the Authorizing Official (AO). |
| 2   | Control Text                | (A) Develop, document, and maintain under configuration control, a current baseline configuration of the system; and (B) Review and update the baseline configuration of the system: (B.1) annually; (B.2) When required due to \[see ODPs\]; and (B.3) When system components are installed or upgraded. | (A) Baseline documented in CMP v4.2 and maintained in ServiceNow CMDB under change control. (B.1) Annual review completed 2025-09-15 by ISSO. (B.2) Ad-hoc reviews triggered per ODP circumstances. (B.3) Component baselines updated at each CCB-approved install/upgrade. |
| 3   | Discussion                  | Baseline configurations for systems and system components include connectivity, operational, and communications aspects...                                                                                                                                                                                | FMS baselines cover OS hardening (DISA STIGs), network device configs (Cisco IOS-XE), database parameters (Oracle 19c), and application middleware. Baselines are stored in the CMDB with full version history and tied to the SSP Appendix M. |
| 4   | Related Controls            | AC-19, AU-6, CA-9, CM-1, CM-3, CM-5, CM-6, CM-8, CM-9, CP-9, CP-10, CP-12, MA-2, PL-8, PM-5, SA-8, SA-10, SA-15, SC-18                                                                                                                                                                                    | CM-1 (CMP), CM-3 (CCB change process), CM-6 (STIG/CIS settings), CM-8 (CMDB inventory), SA-10 (developer config mgmt) are the primary related controls for FMS. |
| 5   | Implementation Status       | Implemented \| Partially Implemented \| Planned \| Alternative \| Not Applicable                                                                                                                                                                                                                          | Implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6   | Organization-Defined Params | CM-02_ODP[01]: frequency; CM-02_ODP[02]: circumstances                                                                                                                                                                                                                                                    | Frequency: annually and when directed by the Authorizing Official (AO). Circumstances: security incidents, changes to federal mandates (OMB, CISA BODs, NIST updates), system architecture changes, or software/hardware end-of-life events.                                                                                                                                                                                                                                                                                                                                                    |
| 7   | Implementation Narrative    |                                                                                                                                                                                                                                                                                                           | The FMS baseline configuration is documented in the Configuration Management Plan (CMP) and maintained in an agency-approved CMDB. Baselines are established for operating systems (Windows Server 2022, RHEL 9), network devices (Cisco IOS-XE), and database servers (Oracle 19c) using DISA STIGs and CIS Benchmarks. Changes are processed through the agency CCB and tracked in ServiceNow. Automated compliance scans (SCAP/Nessus) run weekly to detect drift from approved baselines. All baseline documents are version-controlled and reviewed annually by the ISSO and system owner. |
| 8   | Assessment Objective        | Determine if: a-1: baseline is developed and documented; a-2: maintained under configuration control; b.1–b.3: reviewed and updated per frequency, circumstances, and component changes.                                                                                                                  | Responsible Role: Information System Security Officer (ISSO)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9   | Examine                     | \[SELECT FROM: Configuration management policy; CM procedures; CMP; enterprise architecture docs; system design docs; SSP; privacy plan; system architecture and config docs; config settings; component inventory; change control records\]                                                              | Configuration Management Plan (CMP) v4.2; SSP Appendix M; CMDB baseline export (ServiceNow); SCAP scan results (Nessus, weekly); CCB meeting minutes and change records; DISA STIG checklists for Windows Server 2022, RHEL 9, Oracle 19c; network device running-config backups. |
| 10  | Interview & Test            | INTERVIEW: \[SELECT FROM: CM personnel; ISSO/ISSM; system/network admins\]. TEST: \[SELECT FROM: CM processes; automated config control mechanisms\]                                                                                                                                                      | INTERVIEW: ISSO (J. Martinez), CM Lead (R. Nguyen), Senior Network Admin (T. Brooks). TEST: Execute SCAP benchmark scan against server baseline; verify CMDB accuracy against live inventory; validate CCB workflow in ServiceNow produces audit trail; confirm drift alerts trigger within 24h. |

### Example event payload (JSON)

```json
{
  "systemName": "DOJ Financial Management System (FMS)",
  "implementationStatus": "Implemented",
  "frequency": "annually and when directed by the Authorizing Official (AO)",
  "circumstances": "security incidents, changes to federal mandates (OMB, CISA BODs, NIST updates), system architecture changes, or software/hardware end-of-life events",
  "implementationNarrative": "The FMS baseline configuration is documented in the Configuration Management Plan (CMP) and maintained in an agency-approved CMDB. Baselines are established for operating systems (Windows Server 2022, RHEL 9), network devices (Cisco IOS-XE), and database servers (Oracle 19c) using DISA STIGs and CIS Benchmarks. Changes are processed through the agency CCB and tracked in ServiceNow. Automated compliance scans (SCAP/Nessus) run weekly to detect drift from approved baselines. All baseline documents are version-controlled and reviewed annually by the ISSO and system owner.",
  "responsibleRole": "Information System Security Officer (ISSO)",
  "controlTextResponse": "(A) Baseline documented in CMP v4.2 and maintained in ServiceNow CMDB under change control. (B.1) Annual review completed 2025-09-15 by ISSO. (B.2) Ad-hoc reviews triggered per ODP circumstances. (B.3) Component baselines updated at each CCB-approved install/upgrade.",
  "discussionResponse": "FMS baselines cover OS hardening (DISA STIGs), network device configs (Cisco IOS-XE), database parameters (Oracle 19c), and application middleware. Baselines are stored in the CMDB with full version history and tied to the SSP Appendix M.",
  "relatedControlsResponse": "CM-1 (CMP), CM-3 (CCB change process), CM-6 (STIG/CIS settings), CM-8 (CMDB inventory), SA-10 (developer config mgmt) are the primary related controls for FMS.",
  "examineResponse": "Configuration Management Plan (CMP) v4.2; SSP Appendix M; CMDB baseline export (ServiceNow); SCAP scan results (Nessus, weekly); CCB meeting minutes and change records; DISA STIG checklists for Windows Server 2022, RHEL 9, Oracle 19c; network device running-config backups.",
  "interviewTestResponse": "INTERVIEW: ISSO (J. Martinez), CM Lead (R. Nguyen), Senior Network Admin (T. Brooks). TEST: Execute SCAP benchmark scan against server baseline; verify CMDB accuracy against live inventory; validate CCB workflow in ServiceNow produces audit trail; confirm drift alerts trigger within 24h."
}
```

## CI/CD

GitHub Actions runs on every push/PR to `master`:

1. **Test** — `npm ci && npm test` (Node 20)
2. **Deploy** (master only) — zips the Lambda, uploads via `aws lambda
update-function-code`, runs a smoke test invocation

Lambda infrastructure (function, API Gateway, IAM role) is managed in
[form-terra](https://github.com/daviddoolin/form-terra). The web form
is served from the same Lambda via API Gateway.

### Required GitHub Secrets

| Secret                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`  | IAM role ARN for OIDC-based GitHub Actions auth |
| `LAMBDA_FUNCTION_NAME` | Name of the CM-02 Lambda function               |

## Infrastructure setup

All Lambda infrastructure is managed via Terraform in
[form-terra](https://github.com/daviddoolin/form-terra). This repo
contains only application code — it does not create or manage any AWS
resources directly.

### What form-terra provides

- **Lambda function** — `cm02-baseline-configuration`, Node.js 20
- **HTTP API Gateway** — routes `GET /` (serve form) and `POST /api/cm02` (generate PDF)
- **Lambda execution role** — with `AWSLambdaBasicExecutionRole` and S3 artifact access
- **S3 bucket** — `inventium-artifacts` with encryption, versioning, 24h lifecycle
- **IAM policy** — `inventium-artifacts-lambda-access` granting `s3:PutObject`/`s3:GetObject`
- **GitHub Actions OIDC deploy role** — for keyless CI/CD deployment
- **Optional custom domain** — via `custom-domain.tf` in this repo

### Deploying a new environment

1. Apply the Terraform in form-terra (creates Lambda, API Gateway, S3, IAM)
2. Set GitHub Secrets from the Terraform outputs:
   - `AWS_DEPLOY_ROLE_ARN` — the OIDC deploy role ARN
   - `LAMBDA_FUNCTION_NAME` — the Lambda function name
3. Push to `master` — CI/CD deploys automatically

### Local development

```bash
npm install
npm start         # local server at http://localhost:3002
npm test          # run all tests
npm run format    # auto-format with prettier
```

## PDF artifact storage (inventium-artifacts bucket)

CM02 generates PDFs and serves them to unauthenticated users via
presigned S3 URLs. The backing infrastructure lives in the
[form-terra](https://github.com/daviddoolin/form-terra) Terraform
repository — CM02 does not create or manage the bucket itself.

### How CM02 gets access

The CM02 Lambda execution role must have the shared IAM policy
attached. This is done in form-terra when the CM02 Lambda
infrastructure is created:

```hcl
resource "aws_iam_role_policy_attachment" "cm02_artifacts_access" {
  role       = aws_iam_role.cm02_lambda_role.name
  policy_arn = aws_iam_policy.inventium_artifacts_lambda_access.arn
}
```

### How to write a PDF and serve it

The pattern is: write the PDF to S3, generate a presigned GET URL,
return the URL to the caller. See `lib/s3Upload.js` for the full
implementation.

```javascript
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { randomUUID } = require("crypto");

const s3 = new S3Client();
const key = `cm02/${randomUUID()}.pdf`;

// 1. Write the PDF
await s3.send(new PutObjectCommand({
  Bucket: "inventium-artifacts",
  Key: key,
  Body: pdfBuffer,
  ContentType: "application/pdf",
}));

// 2. Generate a presigned URL (30-minute expiration)
const url = await getSignedUrl(s3, new GetObjectCommand({
  Bucket: "inventium-artifacts",
  Key: key,
}), { expiresIn: 1800 });

// 3. Return it
return { statusCode: 200, body: JSON.stringify({ pdf_url: url }) };
```
