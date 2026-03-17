---
id: ADR-001
title: Standard pattern for bootstrapping a Lambda web application
status: Proposed
date: 2026-03-16
authors: [David Doolin]
owner: David Doolin
reviewers: []
approvers: []
decision_type: Technical
impact_level: High
version: "0.1"
change_log:
  - date: 2026-03-16
    version: "0.1"
    author: David Doolin
    summary: Initial draft derived from CM02, slacronym, retirement, and this-day projects
related_documents:
  adrs: []
  prds: []
---

# ADR-001: Standard pattern for bootstrapping a Lambda web application

## 1. Executive Summary

This ADR defines the repeatable pattern for building a new AWS Lambda
web application where the application code lives in its own repository
and all infrastructure is managed by Terraform in the `form-terra`
repository. The pattern covers project structure, handler design,
deployment packaging, CI/CD, local development, and the boundary
between application and infrastructure concerns.

The intended consumer of this document is an autonomous coding agent
given a PRD. The agent should be able to produce a working, deployable
Lambda application by following these steps without human interaction.

---

## 2. Context

### 2.1 Problem Statement

Each new Lambda project requires the same scaffolding: handler, tests,
CI/CD, deployment packaging, local dev server, and Terraform
coordination. Without a documented pattern, each project reinvents
these decisions, producing inconsistent results and requiring human
guidance.

### 2.2 Constraints

- Solo developer
- Near-zero AWS cost (free tier or minimal spend)
- Must run locally without Lambda emulation
- Infrastructure lives in `form-terra`, not in the application repo
- All projects deploy to `us-west-1`
- CloudFront sits in front of all Lambda function URLs

### 2.3 Existing Projects Following This Pattern

| Project | Runtime | Framework | Data |
|---------|---------|-----------|------|
| CM02 | Node.js 20 | None (raw handler) | OSCAL JSON |
| slacronym | Node.js 20 (ESM) | None (raw handler) | JSON file |
| retirement | Ruby 3.3 | Sinatra + lamby | In-memory SQLite3 |
| this-day | Ruby 3.3 | Roda + lamby | Bundled SQLite3 |

---

## 3. Decision

### 3.1 Repository Separation

The application repo contains **only application code, tests, CI/CD,
and deployment packaging**. It does not create or manage any AWS
resources. All infrastructure is defined in `form-terra`:

| Concern | Where |
|---------|-------|
| Lambda function, API Gateway, IAM role | `form-terra` |
| S3 buckets, IAM policies for data access | `form-terra` |
| CloudFront distribution, custom domain, ACM cert | `form-terra` |
| GitHub Actions OIDC deploy role | `form-terra` |
| Application code, handler, tests, CI/CD workflow | Application repo |
| Optional: Terraform for custom domain mapping | Application repo (`terraform/`) |

The application repo may include a `terraform/` directory for
resources tightly coupled to the application (e.g., custom domain
mapping, API Gateway route overrides) but this is optional.

### 3.2 Project Structure

Every project follows this layout. Adapt filenames for the runtime.

```
project-name/
├── .github/
│   └── workflows/
│       └── ci-cd.yml              # Test on PR, deploy on push to master
├── data/                          # Static data files (JSON, SQLite3, etc.)
├── lib/                           # Application modules
├── public/                        # Static assets (HTML form, CSS, JS)
│   └── index.html
├── test/                          # Tests (Jest, RSpec, node:test)
├── terraform/                     # Optional: app-specific Terraform
├── docs/
│   └── adrs/                     # Architecture decision records
├── .gitignore
├── .prettierignore                # If using Prettier
├── index.js | app.rb             # Lambda handler entry point
├── serve.js | config.ru          # Local development server
├── package.json | Gemfile        # Dependencies
├── plan.md                        # Implementation plan
└── README.md
```

### 3.3 Handler Design

The Lambda handler is the entry point. It must:

1. **Route by HTTP method** — serve HTML on GET, process input on POST,
   handle OPTIONS for CORS
2. **Return API Gateway v2 response format** — `{ statusCode, headers, body }`
3. **Include CORS headers** on all responses
4. **Parse the body** — handle both `event.body` (string from API
   Gateway) and direct event invocation (object)
5. **Validate input** before processing
6. **Return structured errors** — `{ errors: [...] }` for validation,
   `{ error: "message" }` for other failures
7. **Log structured JSON** to stdout for CloudWatch

#### Node.js handler skeleton

```javascript
const fs = require("fs");
const path = require("path");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (method === "GET") {
    const html = fs.readFileSync(
      path.join(__dirname, "public", "index.html"), "utf8"
    );
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "text/html" },
      body: html,
    };
  }

  if (method && method !== "POST") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Method ${method} not allowed` }),
    };
  }

  // Parse, validate, process, return result
};
```

#### Ruby handler skeleton (with lamby)

```ruby
require "lamby"
require_relative "lib/my_app"

def handler(event:, context:)
  Lamby.handler(MyApp, event, context)
end
```

### 3.4 Local Development Server

Every project must include a local dev server that runs the same
application logic without requiring AWS credentials or Lambda
emulation.

- **Node.js:** `serve.js` using `http.createServer`, wrapping the same
  validation and processing logic. Write output files to `output/`
  instead of uploading to S3.
- **Ruby:** `config.ru` with `rackup`. The Rack app runs identically
  to Lambda minus the lamby handler path.

Add `"start": "node serve.js"` (or equivalent) to package.json.
Default to a port other than 3000 (commonly in use).

### 3.5 Validation

Validation is a separate module (`lib/validate.js` or equivalent):

- Trim inputs before checking length
- Return an array of error strings, not a single error
- Define max lengths as constants
- Validate at the handler level, not inside business logic

### 3.6 Testing

- **Test framework:** Jest (Node.js), RSpec (Ruby), or node:test
- **Mock external services** (S3, DynamoDB) in unit tests
- **Test the handler** with realistic API Gateway event shapes
- **Test validation** including boundary conditions (exact max length,
  max + 1, whitespace-padded inputs)
- **E2E test:** invoke the handler with a full realistic payload,
  verify response shape and output validity

### 3.7 CI/CD

GitHub Actions workflow (`.github/workflows/ci-cd.yml`):

```yaml
name: CI/CD

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

permissions:
  contents: read
  id-token: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # Setup runtime (Node/Ruby)
      - # Install dependencies
      - # Lint/format check
      - # Run tests

  deploy:
    needs: test
    if: github.ref == 'refs/heads/master' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # Setup runtime
      - # Install production dependencies only
      - # Build deployment zip (exclude tests, dev deps, large data files)
      - # Configure AWS credentials via OIDC
      - # Upload zip to Lambda
      - # Wait for update
      - # Smoke test (invoke and verify response with jq)
```

**Critical details:**
- Branch name must match the actual default branch (`master` or `main`)
- OIDC trust condition in form-terra must match the branch name
- Smoke test must parse the Lambda response body (use `jq`), not grep
  raw invocation metadata
- Required GitHub Secrets: `AWS_DEPLOY_ROLE_ARN`, `LAMBDA_FUNCTION_NAME`

### 3.8 Deployment Packaging

The deployment zip must include only what Lambda needs:

```bash
zip -r deployment.zip \
  index.js \
  lib/ \
  data/app-specific-data.json \
  public/ \
  node_modules/ \
  -x "*.test.js" "data/large-reference-files.*"
```

Exclude: tests, dev dependencies, large reference data, `.git`,
`node_modules/.cache`, documentation.

### 3.9 Infrastructure Coordination with form-terra

When creating a new Lambda project, the following must be added to
`form-terra`:

1. **Lambda function** — runtime, handler, memory, timeout
2. **API Gateway HTTP API** — routes (GET /, POST /api/endpoint)
3. **Lambda execution role** — basic execution + any S3/DynamoDB access
4. **Lambda permission** — allow API Gateway to invoke
5. **GitHub Actions OIDC deploy role** — scoped to the repo and branch
6. **S3 bucket** (if needed) — for artifacts, with lifecycle rules
7. **IAM policy** (if needed) — for S3/DynamoDB access, least privilege
8. **Outputs** — API endpoint URL, deploy role ARN, function name

The application repo README must document which secrets to set from
the Terraform outputs.

### 3.10 README Structure

Every project README follows this structure:

1. **Title and summary** — what it does, one-line architecture diagram
2. **Form fields / API** — what the user provides
3. **Example** — realistic example with all fields populated
4. **CI/CD** — branch, what runs, required secrets
5. **Infrastructure setup** — pointer to form-terra, what it provides
6. **Local development** — `npm install && npm start`
7. **Data storage** (if applicable) — bucket, access pattern, lifecycle

---

## 4. Agent Bootstrap Procedure

An autonomous agent given a PRD should execute these steps in order:

### Phase 1: Scaffold (no AWS needed)

1. Initialize git repo, create `.gitignore` (node_modules/, output/)
2. Create `package.json` with name, scripts (start, test, format), and
   dependencies
3. Create the data layer — extract or generate any static data files
   into `data/`
4. Create the core business logic in `lib/` — the module that does
   the actual work (PDF generation, calculation, lookup, etc.)
5. Create `lib/validate.js` — input validation with trimmed length
   checks
6. Create `index.js` — Lambda handler following the skeleton above
7. Create `public/index.html` — web form that POSTs to `/api/endpoint`
8. Create `serve.js` — local dev server that writes output to disk
   instead of S3
9. Create tests for validation, business logic, handler, and e2e
10. Run tests, fix any failures
11. Create `.prettierignore` and run formatter
12. Write `README.md` following the structure above
13. Write `plan.md` documenting what was built

### Phase 2: CI/CD

14. Create `.github/workflows/ci-cd.yml` following the template above
15. Ensure branch names in the workflow match the actual default branch

### Phase 3: Infrastructure (requires form-terra access)

16. Add Terraform resources to form-terra for the new Lambda
17. Apply Terraform, collect outputs
18. Set GitHub Secrets from Terraform outputs
19. Push to trigger first deployment
20. Verify smoke test passes

### Phase 4: Iterate

21. Add any optional Terraform in the application repo (custom domain)
22. Refine based on testing against the live endpoint

---

## 5. Consequences

### 5.1 Positive
- New Lambda projects can be scaffolded in minutes by an agent
- Consistent structure across all projects makes maintenance easier
- Clear separation between application and infrastructure concerns
- Every project works locally without AWS credentials

### 5.2 Negative
- Pattern is opinionated — projects that don't fit the mold need
  explicit deviations documented
- Two-repo coordination (app + form-terra) requires understanding
  the boundary

### 5.3 Risks

| Risk | Mitigation |
|------|------------|
| Agent scaffolds CI for wrong branch name | Verify with `git branch` before writing workflow |
| Agent creates Terraform resources that reference undefined policies | All cross-repo references must use `data` sources or be clearly commented |
| Agent over-engineers the solution | Follow the PRD scope; do not add features not requested |

---

## 6. Tags and Classification

- **Domain Tags:** serverless, deployment, bootstrap
- **Technology Tags:** lambda, node.js, ruby, terraform, github-actions, api-gateway, cloudfront
- **Search Keywords:** lambda bootstrap, project template, agent automation, form-terra, OIDC deploy
