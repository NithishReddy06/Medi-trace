const { createWorker } = require("tesseract.js");

let workerPromise;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng");
  }

  return workerPromise;
}

async function extractText(imageBuffer) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("OCR requires a non-empty image buffer");
  }

  const worker = await getWorker();
  const result = await worker.recognize(imageBuffer);

  return result.data.text.trim();
}

async function shutdown() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = undefined;
  }
}

module.exports = { extractText, shutdown };