# Compliance

## For Claude

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

### Web form fields

The form collects the following from the user:

- **System Name** — name of the system being assessed
- **Implementation Status** — Implemented | Partially Implemented | Planned | Alternative | Not Applicable
- **Organization-Defined Parameters (ODPs)**
  - Frequency of baseline review/update (CM-02_ODP[01])
  - Circumstances requiring review/update (CM-02_ODP[02])
- **Implementation Narrative** — free-text description of how CM-02 is implemented
- **Responsible Role** — role accountable for the control

### Example: Federal Information System

The table below shows example values for a federal agency system at
FISMA Moderate baseline.

| Row | Section                     | NIST Text                                                                                                                                                                                                                                                                                                 | Response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Control Number/Title        | CM-02 Baseline Configuration                                                                                                                                                                                                                                                                              | DOJ Financial Management System (FMS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
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
  "responsibleRole": "Information System Security Officer (ISSO)"
}
```

## CI/CD

GitHub Actions runs on every push/PR to `master`:

1. **Test** — `npm ci && npm test` (Node 20)
2. **Deploy** (main only) — zips the Lambda, uploads via `aws lambda
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
npm test          # run all tests
npm run format    # auto-format with prettier
```

## PDF artifact storage (inventium-artifacts bucket)

CM02 generates PDFs and serves them to unauthenticated users via
presigned S3 URLs. The backing infrastructure lives in the
[form-terra](https://github.com/daviddoolin/form-terra) Terraform
repository — CM02 does not create or manage the bucket itself.

### What form-terra provides

The Terraform file `inventium-artifacts.tf` in form-terra creates:

- **S3 bucket** named `inventium-artifacts` in `us-west-1`
- **All public access blocked** (all four `aws_s3_bucket_public_access_block` settings are `true`) — there is no way to access objects via a plain S3 URL
- **SSL-only bucket policy** — denies any request over plain HTTP
- **Server-side encryption** with SSE-S3 (`AES256`)
- **Versioning** enabled
- **Lifecycle rule** that deletes all objects after **24 hours**
- **IAM policy** named `inventium-artifacts-lambda-access` granting `s3:PutObject` and `s3:GetObject` on the bucket contents — nothing else (no delete, list, or admin actions)

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
return the URL to the caller. The caller (a random unauthenticated
user) opens the URL directly in their browser — S3 serves the file
with no further Lambda involvement.

```
require 'aws-sdk-s3'
require 'securerandom'

# 1. Write the PDF
s3  = Aws::S3::Client.new
key = "cm02/#{SecureRandom.uuid}.pdf"

s3.put_object(
  bucket:       'inventium-artifacts',
  key:          key,
  body:         pdf_content,
  content_type: 'application/pdf'
)

# 2. Generate a presigned URL (30-minute expiration)
signer = Aws::S3::Presigner.new
url = signer.presigned_url(
  :get_object,
  bucket:     'inventium-artifacts',
  key:        key,
  expires_in: 1800  # 30 minutes
)

# 3. Return it
{ statusCode: 200, body: JSON.generate({ pdf_url: url }) }
```
