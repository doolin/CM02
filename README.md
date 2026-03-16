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

## CI/CD

GitHub Actions runs on every push/PR to `main`:

1. **Test** — `npm ci && npm test` (Node 20)
2. **Deploy** (main only) — zips the Lambda, uploads via `aws lambda
   update-function-code`, runs a smoke test invocation

Lambda infrastructure (function, API Gateway, IAM role) is managed in
[form-terra](https://github.com/daviddoolin/form-terra). The web form
is served from the same Lambda via API Gateway.

### Required GitHub Secrets

| Secret                   | Description                                    |
|--------------------------|------------------------------------------------|
| `AWS_DEPLOY_ROLE_ARN`    | IAM role ARN for OIDC-based GitHub Actions auth |
| `LAMBDA_FUNCTION_NAME`   | Name of the CM-02 Lambda function               |

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


