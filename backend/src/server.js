const crypto = require("crypto");
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const multer = require("multer");
const env = require("./config/env");
const prisma = require("./config/prisma");
const {
  publicUserSelect,
  requireAuth,
  requireRole,
  serializeUser,
  signAccessToken,
} = require("./middleware/auth");
const { extractPrescriptionData } = require("./services/prescriptionExtractionService");
const { analyzePrescriptionImage } = require("./services/prescriptionAnalysisService");
const patientRoutes = require("./routes/patient");

const app = express();
const PORT = env.PORT;
const allowedFrontendOrigins = [
  env.FRONTEND_URL,
  "http://127.0.0.1:5173",
];
const REVIEW_ROLES = ["pharmacist", "doctor", "admin"];
const uploadDirectory = path.join(__dirname, "..", "uploads", "prescriptions");
const allowedImageTypes = new Map([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = allowedImageTypes.get(file.mimetype);

    if (!allowedExtensions || !allowedExtensions.has(extension)) {
      return callback(new Error("Only JPG, JPEG, and PNG images are allowed"));
    }

    callback(null, true);
  },
});

function hasValidImageSignature(file) {
  const isJpeg = file.mimetype === "image/jpeg"
    && file.buffer.length >= 3
    && file.buffer[0] === 0xff
    && file.buffer[1] === 0xd8
    && file.buffer[2] === 0xff;
  const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
  const isPng = file.mimetype === "image/png"
    && file.buffer.length >= pngSignature.length
    && file.buffer.subarray(0, pngSignature.length).equals(pngSignature);

  return isJpeg || isPng;
}

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));
app.use(cors({ origin: allowedFrontendOrigins }));
app.use(express.json());

app.get("/api/health", (request, response) => {
  response.json({ status: "ok", service: "MediTrace backend" });
});

app.post("/api/auth/login", async (request, response) => {
  const body = request.body || {};
  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return response.status(400).json({
      status: "error",
      message: "Email and password are required.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...publicUserSelect, passwordHash: true },
    });
    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash).catch(() => false)
      : false;

    if (!user || !user.isActive || !passwordMatches) {
      return response.status(401).json({
        status: "error",
        message: "Incorrect email or password.",
      });
    }

    const token = signAccessToken(user);
    response.json({
      status: "ok",
      token,
      expiresIn: env.JWT_EXPIRES_IN,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Login failed:", error.message);
    response.status(500).json({ status: "error", message: "Could not sign in. Please try again." });
  }
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ status: "ok", user: request.user });
});

app.use("/api/patient", requireAuth, requireRole("patient"), patientRoutes);

app.get("/api/db-test", requireAuth, requireRole("admin"), async (request, response) => {
  try {
    const result = await prisma.$queryRaw`SELECT current_database() AS database_name, NOW() AS server_time`;

    response.json({
      status: "ok",
      message: "PostgreSQL connection successful",
      database: result[0].database_name,
      serverTime: result[0].server_time,
    });
  } catch (error) {
    console.error("Database test failed:", error.message);
    response.status(500).json({
      status: "error",
      message: "Could not connect to PostgreSQL",
    });
  }
});

app.post("/api/prescriptions/extract", requireAuth, requireRole(...REVIEW_ROLES), (request, response) => {
  try {
    const extraction = extractPrescriptionData(request.body.ocrText);
    response.json({ status: "ok", ...extraction });
  } catch (error) {
    response.status(400).json({ status: "error", message: error.message });
  }
});

app.post("/api/prescriptions/analyze", requireAuth, requireRole(...REVIEW_ROLES), (request, response, next) => {
  upload.single("prescriptionImage")(request, response, async (uploadError) => {
    if (uploadError) {
      return next(uploadError);
    }

    if (!request.file || !hasValidImageSignature(request.file)) {
      return response.status(400).json({
        success: false,
        message: "A valid JPG, JPEG, or PNG image is required",
      });
    }

    const prescriptionId = request.body.prescriptionId
      ? Number(request.body.prescriptionId)
      : null;
    const extension = path.extname(request.file.originalname).toLowerCase();
    const fileName = `${crypto.randomUUID()}${extension}`;
    const relativePath = `/uploads/prescriptions/${fileName}`;
    const absolutePath = path.join(uploadDirectory, fileName);

    try {
      if (prescriptionId !== null
        && (!Number.isSafeInteger(prescriptionId) || prescriptionId <= 0)) {
        return response.status(400).json({ success: false, message: "Invalid prescription ID" });
      }

      if (prescriptionId !== null) {
        const prescription = await prisma.prescription.findUnique({
          where: { prescriptionId: BigInt(prescriptionId) },
          select: { prescriptionId: true },
        });

        if (!prescription) {
          return response.status(404).json({ success: false, message: "Prescription not found" });
        }
      }

      await fs.promises.mkdir(uploadDirectory, { recursive: true });
      await fs.promises.writeFile(absolutePath, request.file.buffer, { flag: "wx" });

      try {
        const analysis = await analyzePrescriptionImage(request.file.buffer);

        if (prescriptionId !== null) {
          await prisma.prescription.update({
            where: { prescriptionId: BigInt(prescriptionId) },
            data: { imagePath: relativePath },
          });
        }

        response.status(201).json({
          success: true,
          ocrText: analysis.ocrText,
          prescription: analysis.data,
          warnings: analysis.warnings,
          missingFields: analysis.missingFields,
          confidence: analysis.confidence,
          imagePath: relativePath,
        });
      } catch (processingError) {
        await fs.promises.unlink(absolutePath).catch(() => {});
        throw processingError;
      }
    } catch (error) {
      console.error("Prescription analysis failed:", error.message);
      response.status(500).json({
        success: false,
        message: "Could not analyze prescription image",
      });
    }
  });
});

app.post("/api/prescriptions/:prescriptionId/image", requireAuth, requireRole(...REVIEW_ROLES), (request, response, next) => {
  upload.single("prescriptionImage")(request, response, async (uploadError) => {
    if (uploadError) {
      return next(uploadError);
    }

    const prescriptionId = Number(request.params.prescriptionId);

    if (!Number.isSafeInteger(prescriptionId) || prescriptionId <= 0) {
      return response.status(400).json({ status: "error", message: "Invalid prescription ID" });
    }

    if (!request.file || !hasValidImageSignature(request.file)) {
      return response.status(400).json({
        status: "error",
        message: "A valid JPG, JPEG, or PNG image is required",
      });
    }

    const extension = path.extname(request.file.originalname).toLowerCase();
    const fileName = `${crypto.randomUUID()}${extension}`;
    const relativePath = `/uploads/prescriptions/${fileName}`;
    const absolutePath = path.join(uploadDirectory, fileName);

    try {
      const prescription = await prisma.prescription.findUnique({
        where: { prescriptionId: BigInt(prescriptionId) },
        select: { prescriptionId: true },
      });

      if (!prescription) {
        return response.status(404).json({ status: "error", message: "Prescription not found" });
      }

      const analysis = await analyzePrescriptionImage(request.file.buffer);

      await fs.promises.mkdir(uploadDirectory, { recursive: true });
      await fs.promises.writeFile(absolutePath, request.file.buffer, { flag: "wx" });

      try {
        await prisma.prescription.update({
          where: { prescriptionId: BigInt(prescriptionId) },
          data: { imagePath: relativePath },
        });
      } catch (databaseError) {
        await fs.promises.unlink(absolutePath).catch(() => {});
        throw databaseError;
      }

      response.status(201).json({
        status: "ok",
        prescriptionId,
        imagePath: relativePath,
        extractedText: analysis.ocrText,
        ...analysis,
      });
    } catch (error) {
      console.error("Prescription image upload or OCR failed:", error.message);
      response.status(500).json({
        status: "error",
        message: "Could not process prescription image",
      });
    }
  });
});

app.use((error, request, response, next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return response.status(413).json({ status: "error", message: "Image must be 5 MB or smaller" });
  }

  if (error) {
    return response.status(400).json({ status: "error", message: error.message });
  }

  next();
});

env.validate();

app.listen(PORT, () => {
  console.log(`MediTrace backend running on http://localhost:${PORT}`);
});
