const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

const BUCKET = 'inventium-artifacts';
const PREFIX = 'cm02';
const PRESIGN_EXPIRES = 1800; // 30 minutes

const s3 = new S3Client();

async function uploadAndPresign(pdfBuffer) {
  const key = `${PREFIX}/${randomUUID()}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  }));

  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn: PRESIGN_EXPIRES });

  return { key, url };
}

module.exports = { uploadAndPresign };
