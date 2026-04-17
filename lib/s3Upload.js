const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { randomUUID, createHash } = require("crypto");

const BUCKET = process.env.S3_BUCKET || "inventium-artifacts";
const PRESIGN_EXPIRES = 1800; // 30 minutes

const EVIDENCE_PREFIXES = {
  pdf: "cm02/pdfs",
  sbom: "cm02/evidence/sboms",
  scan: "cm02/evidence/scans",
  provenance: "cm02/evidence/provenance",
  oscal: "cm02/evidence/oscal",
  log: "cm02/evidence/logs",
};

const s3 = new S3Client();

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("base64");
}

async function uploadEvidence(buffer, artifactType, extension, contentType) {
  const prefix = EVIDENCE_PREFIXES[artifactType] || "cm02/evidence/other";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `${prefix}/${timestamp}-${randomUUID()}.${extension}`;
  const checksum = sha256(buffer);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ChecksumSHA256: checksum,
      Metadata: {
        "artifact-type": artifactType,
        "sha256-digest": checksum,
        "upload-timestamp": new Date().toISOString(),
      },
    }),
  );

  return { key, checksum };
}

async function uploadAndPresign(pdfBuffer) {
  const { key, checksum } = await uploadEvidence(
    pdfBuffer,
    "pdf",
    "pdf",
    "application/pdf",
  );

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
    { expiresIn: PRESIGN_EXPIRES },
  );

  return { key, url, checksum };
}

module.exports = { uploadAndPresign, uploadEvidence, EVIDENCE_PREFIXES };
