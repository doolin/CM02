const { generatePdf } = require("./lib/cm02Pdf");
const { uploadAndPresign } = require("./lib/s3Upload");

exports.handler = async (event) => {
  const input = typeof event.body === "string" ? JSON.parse(event.body) : event;

  const pdfBuffer = await generatePdf({
    systemName: input.systemName,
    implementationStatus: input.implementationStatus,
    implementationNarrative: input.implementationNarrative,
    responsibleRole: input.responsibleRole,
    frequency: input.frequency,
    circumstances: input.circumstances,
  });

  const { url } = await uploadAndPresign(pdfBuffer);

  return {
    statusCode: 200,
    body: JSON.stringify({ pdf_url: url }),
  };
};
