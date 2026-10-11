const { extractText } = require("./ocrService");
const { extractPrescriptionData } = require("./prescriptionExtractionService");

async function analyzePrescriptionImage(imageBuffer) {
  const ocrText = await extractText(imageBuffer);
  const extraction = extractPrescriptionData(ocrText);

  return {
    ocrText,
    ...extraction,
  };
}

module.exports = { analyzePrescriptionImage };