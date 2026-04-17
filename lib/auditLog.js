const SEVERITY = { INFO: "INFO", WARN: "WARN", ERROR: "ERROR" };

function emit(event, severity, fields) {
  const entry = {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  if (severity === SEVERITY.ERROR) {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
  return entry;
}

const auditLog = {
  pdfGenerated(fields) {
    return emit("pdf_generated", SEVERITY.INFO, fields);
  },

  validationFailed(fields) {
    return emit("validation_failed", SEVERITY.WARN, fields);
  },

  rateLimitExceeded(fields) {
    return emit("rate_limit_exceeded", SEVERITY.WARN, fields);
  },

  methodNotAllowed(fields) {
    return emit("method_not_allowed", SEVERITY.WARN, fields);
  },

  invalidJson(fields) {
    return emit("invalid_json", SEVERITY.WARN, fields);
  },

  s3UploadFailed(fields) {
    return emit("s3_upload_failed", SEVERITY.ERROR, fields);
  },

  s3EvidenceArchived(fields) {
    return emit("s3_evidence_archived", SEVERITY.INFO, fields);
  },

  lambdaError(fields) {
    return emit("lambda_error", SEVERITY.ERROR, fields);
  },
};

module.exports = { auditLog, emit, SEVERITY };
