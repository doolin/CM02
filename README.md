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

| Secret                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`  | IAM role ARN for OIDC-based GitHub Actions auth |
| `LAMBDA_FUNCTION_NAME` | Name of the CM-02 Lambda function               |

## Setting up a similar Lambda project (with mobile browser access)

This section walks through setting up a new Node.js Lambda that serves
both an HTML form and an API endpoint, accessible from an iPhone browser.

### 1. Create the Lambda function

```bash
aws lambda create-function \
  --function-name my-form-lambda \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::ACCOUNT_ID:role/my-lambda-role \
  --region us-west-1 \
  --zip-file fileb://deployment.zip
```

### 2. Create an API Gateway (HTTP API)

An HTTP API gives you a public URL that works in any browser, including
mobile Safari on iPhone.

```bash
# Create the HTTP API
aws apigatewayv2 create-api \
  --name my-form-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:us-west-1:ACCOUNT_ID:function:my-form-lambda

# The output includes an ApiEndpoint like:
# https://abc123def.execute-api.us-west-1.amazonaws.com
```

This creates a `$default` stage with auto-deploy. The endpoint URL
works immediately in any browser.

### 3. Add Lambda permission for API Gateway

```bash
aws lambda add-permission \
  --function-name my-form-lambda \
  --statement-id apigateway-access \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-west-1:ACCOUNT_ID:API_ID/*"
```

### 4. Structure the handler to serve both HTML and API

The Lambda needs to handle two types of requests: GET (serve the form)
and POST (process the form and return results).

```javascript
const fs = require("fs");
const path = require("path");

exports.handler = async (event) => {
  // Serve the HTML form on GET
  if (event.requestContext?.http?.method === "GET") {
    const html = fs.readFileSync(
      path.join(__dirname, "public", "index.html"),
      "utf8",
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: html,
    };
  }

  // Process the form on POST
  const input = typeof event.body === "string" ? JSON.parse(event.body) : event;

  // ... your logic here ...

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: "ok" }),
  };
};
```

### 5. Configure routes (optional, for cleaner URLs)

By default the HTTP API sends all requests to the Lambda. If you want
separate paths:

```bash
# Create a GET /  route for the form
aws apigatewayv2 create-route \
  --api-id API_ID \
  --route-key "GET /"

# Create a POST /api route for form submission
aws apigatewayv2 create-route \
  --api-id API_ID \
  --route-key "POST /api"
```

### 6. Set the API endpoint in the web form

In `public/index.html`, point the form at the API Gateway URL:

```html
<script>
  // Use relative path if form is served from same API Gateway
  window.CM02_API_ENDPOINT = "/api/cm02";

  // Or use the full URL if hosted separately
  // window.CM02_API_ENDPOINT = "https://abc123def.execute-api.us-west-1.amazonaws.com/api/cm02";
</script>
```

### 7. Deploy and test from iPhone

```bash
# Package
zip -r deployment.zip index.js lib/ data/cm02-control.json public/ node_modules/ \
  -x "*.test.js" "data/NIST_SP-800-53_rev5_catalog.json"

# Deploy
aws lambda update-function-code \
  --function-name my-form-lambda \
  --zip-file fileb://deployment.zip \
  --publish
```

Open the API Gateway URL in Safari on your iPhone:
`https://abc123def.execute-api.us-west-1.amazonaws.com`

### 8. Optional: custom domain

To use a friendly URL instead of the API Gateway default:

1. Register a domain or use an existing one in Route 53
2. Request an ACM certificate in `us-east-1` (required for API Gateway)
3. Add a custom domain to the API:

```bash
aws apigatewayv2 create-domain-name \
  --domain-name forms.example.com \
  --domain-name-configurations \
    CertificateArn=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID

aws apigatewayv2 create-api-mapping \
  --api-id API_ID \
  --domain-name forms.example.com \
  --stage '$default'
```

4. Add a CNAME or alias record in Route 53 pointing to the API Gateway
   domain name.

### Terraform alternative

If you prefer infrastructure-as-code, define all of the above in
form-terra. See the existing `inventium-artifacts.tf` for the pattern.
The key Terraform resources are:

- `aws_lambda_function`
- `aws_apigatewayv2_api` (protocol_type = "HTTP")
- `aws_apigatewayv2_integration` (Lambda proxy)
- `aws_apigatewayv2_route` (GET / and POST /api)
- `aws_lambda_permission` (allow API Gateway to invoke)

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
