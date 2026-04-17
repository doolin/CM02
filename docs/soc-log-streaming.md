# SOC Log Streaming and M-21-31 EL3 Scoping

**Reference:** [OMB M-21-31 — Improving the Federal Government's Investigative and Remediation Capabilities](https://www.whitehouse.gov/wp-content/uploads/2021/08/M-21-31-Improving-the-Federal-Governments-Investigative-and-Remediation-Capabilities-Related-to-Cybersecurity-Incidents.pdf)

## CI/CD Log Event Catalog

Every event produced by this system is classified below by M-21-31 maturity tier and assigned a structured event type for SOC ingestion.

### Application Events (Lambda / CloudWatch)

| Event Type             | Description                               | M-21-31 Tier | FSA Mandatory | Example Fields                             |
| ---------------------- | ----------------------------------------- | ------------ | ------------- | ------------------------------------------ |
| `pdf_generated`        | Successful PDF generation and S3 upload   | EL1          | Yes           | control, sourceIp, pdfSizeBytes, timestamp |
| `lambda_error`         | Unhandled error during request processing | EL1          | Yes           | error, stack, timestamp                    |
| `validation_failed`    | Input validation rejected                 | EL1          | Yes           | errors, sourceIp, timestamp                |
| `rate_limit_exceeded`  | Request blocked by rate limiter           | EL2          | Yes           | sourceIp, timestamp                        |
| `method_not_allowed`   | Non-POST/GET/OPTIONS request attempted    | EL2          | Yes           | method, sourceIp, timestamp                |
| `invalid_json`         | Malformed JSON in request body            | EL1          | Yes           | sourceIp, timestamp                        |
| `s3_upload_failed`     | S3 upload or presign failure              | EL1          | Yes           | error, key, timestamp                      |
| `s3_evidence_archived` | Evidence artifact archived to S3          | EL2          | Yes           | artifactType, key, checksum, timestamp     |

### CI/CD Pipeline Events (GitHub Actions)

| Event Type                     | Description                             | M-21-31 Tier | FSA Mandatory | Source                             |
| ------------------------------ | --------------------------------------- | ------------ | ------------- | ---------------------------------- |
| `pipeline_triggered`           | Pipeline run started                    | EL1          | Yes           | GitHub Actions webhook / audit log |
| `test_completed`               | Test suite pass/fail                    | EL1          | Yes           | CI job output                      |
| `secrets_scan_completed`       | Gitleaks scan pass/fail                 | EL1          | Yes           | CI job output                      |
| `vulnerability_scan_completed` | Trivy/npm audit results                 | EL1          | Yes           | CI job output                      |
| `sbom_generated`               | SBOM artifact produced                  | EL2          | Yes           | CI job output                      |
| `build_provenance_attested`    | SLSA provenance attestation created     | EL2          | Yes           | CI job output                      |
| `deployment_completed`         | Lambda deployment success/failure       | EL1          | Yes           | CI job output                      |
| `smoke_test_completed`         | Post-deploy smoke test result           | EL1          | Yes           | CI job output                      |
| `evidence_archived`            | Artifacts uploaded to S3 evidence store | EL2          | Yes           | CI job output                      |
| `pipeline_config_changed`      | Workflow YAML modified                  | EL3          | Yes           | Git diff / GitHub audit log        |
| `branch_protection_changed`    | Branch protection rule modified         | EL3          | Yes           | GitHub audit log                   |
| `iam_role_assumed`             | OIDC role assumption for deployment     | EL2          | Yes           | CloudTrail                         |

### Infrastructure Events (AWS / CloudTrail)

| Event Type                  | Description                              | M-21-31 Tier | FSA Mandatory | Source         |
| --------------------------- | ---------------------------------------- | ------------ | ------------- | -------------- |
| `lambda_code_updated`       | Lambda function code changed             | EL1          | Yes           | CloudTrail     |
| `lambda_config_changed`     | Lambda env vars, timeout, memory changed | EL2          | Yes           | CloudTrail     |
| `s3_object_accessed`        | Evidence store object read               | EL2          | No            | S3 access logs |
| `s3_bucket_policy_changed`  | Bucket policy or ACL modified            | EL3          | Yes           | CloudTrail     |
| `api_gateway_route_changed` | API Gateway route configuration modified | EL3          | Yes           | CloudTrail     |

## EL3 Scoping for FSA

Per the feedback: _"FSA should selectively identify what under EL3 we consider mandatory rather than blindly follow OMB 21-31."_

### FSA-Mandatory EL3 Events

These EL3 events represent high-impact configuration changes that could undermine pipeline security. FSA considers them mandatory for SOC ingestion.

| Event                       | Justification                                                     |
| --------------------------- | ----------------------------------------------------------------- |
| `pipeline_config_changed`   | Workflow changes can disable security gates; must be auditable    |
| `branch_protection_changed` | Weakening branch protection could allow unreviewed code to deploy |
| `s3_bucket_policy_changed`  | Evidence store access changes could compromise audit integrity    |
| `api_gateway_route_changed` | Route changes could expose unauthorized endpoints                 |

### FSA-Aspirational EL3 Events (Deferred)

These EL3 capabilities are recognized but deferred until infrastructure maturity allows:

| Capability                               | M-21-31 EL3 Requirement      | FSA Justification for Deferral                                          |
| ---------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| User behavior analytics on CI/CD access  | Behavioral anomaly detection | Requires UEBA tooling not yet procured; covered partially by CloudTrail |
| Container security monitoring            | Runtime container telemetry  | Lambda is serverless; no persistent containers to monitor               |
| Full network traffic inspection of CI/CD | Network-level logging        | GitHub-hosted runners are outside FSA's network perimeter               |

## Log Format Specification

All application-level logs use structured JSON. Every log entry includes:

```json
{
  "event": "<event_type>",
  "severity": "INFO|WARN|ERROR",
  "timestamp": "2026-04-17T21:30:00.000Z",
  "sourceIp": "10.0.0.1",
  "requestId": "<api-gateway-request-id>",
  ...event-specific fields
}
```

## Log Forwarding Architecture

```
Lambda (console.log) ──► CloudWatch Logs ──► Subscription Filter ──► SOC SIEM
                                          └──► CloudWatch Insights (query/dashboard)

GitHub Actions ──► GitHub Audit Log API ──► Scheduled poller ──► SOC SIEM
                                         └──► S3 evidence store (archival)

AWS CloudTrail ──► CloudTrail Lake / S3 ──► SOC SIEM
```

### Implementation Notes

- **Lambda → CloudWatch:** Already operational. Lambda automatically sends `console.log` output to CloudWatch Logs.
- **CloudWatch → SOC:** Requires a CloudWatch Logs subscription filter forwarding to the agency SIEM. **TODO: implement in form-terra** (Kinesis Firehose or Lambda forwarder to SIEM endpoint).
- **GitHub Audit Log → SOC:** Requires a scheduled job (Lambda or GitHub Action) polling the GitHub Audit Log API and forwarding events. **TODO: implement as a separate service.**
- **CloudTrail → SOC:** Requires CloudTrail to be configured for the relevant AWS account with forwarding to the SIEM. **TODO: verify in form-terra.**

## Log Retention

| Source                   | Retention                          | Rationale                                             |
| ------------------------ | ---------------------------------- | ----------------------------------------------------- |
| CloudWatch Logs (Lambda) | 1 year                             | M-21-31 EL2 minimum; aligns with CloudTrail retention |
| GitHub Actions logs      | 90 days (GitHub default)           | Supplement with S3 evidence archive for long-term     |
| CloudTrail               | 1 year (standard) / 7 years (Lake) | M-21-31 EL3 for investigative capability              |
| S3 access logs           | 3 years (Object Lock)              | Matches evidence store retention                      |
