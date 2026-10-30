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
const metrics = require("./metrics");
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
const pharmacistRoutes = require("./routes/pharmacist");

const app = express();
const PORT = env.PORT;

function createRateLimiter({ limit, windowMs, message }) {
  const windows = new Map();
  const middleware = (request, response, next) => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || "unknown";
    let entry = windows.get(key);
    if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
    if (windows.size > 1000) {
      for (const [knownKey, knownEntry] of windows) {
        if (knownEntry.resetAt <= now) windows.delete(knownKey);
      }
    }
    if (entry.count >= limit) {
      response.set("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return response.status(429).json({ status: "error", message });
    }
    entry.count += 1;
    windows.set(key, entry);
    response.set("RateLimit-Limit", String(limit));
    response.set("RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    next();
  };
  middleware.clear = (request) => windows.delete(request.ip || request.socket.remoteAddress || "unknown");
  return middleware;
}

const loginRateLimit = createRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000,
  message: "Too many sign-in attempts. Wait 15 minutes and try again.",
});
const registrationRateLimit = createRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  message: "Too many account creation attempts. Try again later.",
});
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

function registrationText(value, fieldName, maximumLength) {
  if (typeof value !== "string") throw new Error(`${fieldName} is required.`);
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${fieldName} is required.`);
  if (cleaned.length > maximumLength) {
    throw new Error(`${fieldName} must be ${maximumLength} characters or fewer.`);
  }
  return cleaned;
}

function registrationOptionalText(value, fieldName, maximumLength) {
  if (value === undefined || value === null || value === "") return null;
  return registrationText(value, fieldName, maximumLength);
}

function registrationDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date of birth must use YYYY-MM-DD format.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getTime() > Date.now()) {
    throw new Error("Date of birth is not valid.");
  }
  return date;
}

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

function ocrConfidenceScore(analysis) {
  if (analysis?.confidence?.overall === "high") return 90;
  if (analysis?.confidence?.overall === "medium") return 75;
  return 50;
}

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));
app.use(cors({ origin: allowedFrontendOrigins }));
app.use(metrics.requestMetrics);
app.use(express.json());
app.use("/api/auth", (request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});

app.get("/metrics", (request, response) => {
  response.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  response.send(metrics.renderMetrics());
});

app.get("/api/health", (request, response) => {
  response.json({ status: "ok", service: "MediTrace backend" });
});

app.post("/api/auth/login", loginRateLimit, async (request, response) => {
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
    loginRateLimit.clear(request);
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

app.post("/api/auth/register", registrationRateLimit, async (request, response) => {
  try {
    const body = request.body || {};
    const email = registrationText(body.email, "Email", 320).toLowerCase();
    const firstName = registrationText(body.firstName, "First name", 100);
    const lastName = registrationText(body.lastName, "Last name", 100);
    const phone = registrationOptionalText(body.phone, "Phone number", 30);
    const dateOfBirth = registrationDate(body.dateOfBirth);
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return response.status(400).json({ status: "error", message: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 128) {
      return response.status(400).json({ status: "error", message: "Password must be between 8 and 128 characters." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: { email, passwordHash, role: "patient", firstName, lastName, phone, dateOfBirth },
        select: publicUserSelect,
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: created.userId,
          action: "INSERT",
          entityType: "app_users",
          entityId: created.userId,
          eventData: { source: "self_registration", role: "patient" },
        },
      });
      return created;
    });

    const token = signAccessToken(user);
    response.status(201).json({
      status: "ok",
      message: "Patient account created.",
      token,
      expiresIn: env.JWT_EXPIRES_IN,
      user: serializeUser(user),
    });
  } catch (error) {
    if (error.code === "P2002") {
      return response.status(409).json({ status: "error", message: "An account with that email already exists." });
    }
    if (error.message && !error.code) {
      return response.status(400).json({ status: "error", message: error.message });
    }
    console.error("Registration failed:", error);
    return response.status(500).json({ status: "error", message: "Could not create your account. Please try again." });
  }
});

app.post("/api/auth/pharmacist-applications", registrationRateLimit, async (request, response) => {
  try {
    const body = request.body || {};
    const email = registrationText(body.email, "Email", 320).toLowerCase();
    const firstName = registrationText(body.firstName, "First name", 100);
    const lastName = registrationText(body.lastName, "Last name", 100);
    const phone = registrationOptionalText(body.phone, "Phone number", 30);
    const pharmacistLicenseNumber = registrationText(body.licenseNumber, "Pharmacist license number", 100);
    const pharmacistOrganization = registrationText(body.organization, "Organization or pharmacy", 200);
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return response.status(400).json({ status: "error", message: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 128) {
      return response.status(400).json({ status: "error", message: "Password must be between 8 and 128 characters." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (transaction) => {
      const applicant = await transaction.user.create({
        data: {
          email,
          passwordHash,
          role: "pharmacist",
          firstName,
          lastName,
          phone,
          pharmacistLicenseNumber,
          pharmacistOrganization,
          pharmacistApplicationStatus: "pending",
          isActive: false,
        },
        select: { userId: true },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: applicant.userId,
          action: "INSERT",
          entityType: "app_users",
          entityId: applicant.userId,
          eventData: { source: "pharmacist_access_application", status: "pending" },
        },
      });
    });

    response.status(202).json({
      status: "pending",
      message: "Your pharmacist access request was submitted. An administrator must review your license before you can sign in.",
    });
  } catch (error) {
    if (error.code === "P2002") {
      return response.status(409).json({ status: "error", message: "An account, application, or license with those details already exists." });
    }
    if (error.message && !error.code) {
      return response.status(400).json({ status: "error", message: error.message });
    }
    console.error("Pharmacist access application failed:", error);
    return response.status(500).json({ status: "error", message: "Could not submit your application. Please try again." });
  }
});

app.get("/api/admin/pharmacist-applications", requireAuth, requireRole("admin"), async (request, response) => {
  try {
    const applications = await prisma.user.findMany({
      where: { role: "pharmacist", pharmacistApplicationStatus: "pending", isActive: false },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        pharmacistLicenseNumber: true,
        pharmacistOrganization: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    response.json({ status: "ok", applications: applications.map((application) => ({
      ...application,
      userId: application.userId.toString(),
    })) });
  } catch (error) {
    console.error("Pharmacist application list failed:", error.message);
    response.status(500).json({ status: "error", message: "Could not load pharmacist access requests." });
  }
});

app.post("/api/admin/pharmacist-applications/:userId/decision", requireAuth, requireRole("admin"), async (request, response) => {
  const userId = Number(request.params.userId);
  const decision = request.body?.decision;
  if (!Number.isSafeInteger(userId) || userId < 1 || !["approve", "reject"].includes(decision)) {
    return response.status(400).json({ status: "error", message: "Choose a valid application and decision." });
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const applicant = await transaction.user.findUnique({
        where: { userId: BigInt(userId) },
        select: { userId: true, role: true, pharmacistApplicationStatus: true },
      });
      if (!applicant || applicant.role !== "pharmacist" || applicant.pharmacistApplicationStatus !== "pending") {
        const error = new Error("This pharmacist access request is no longer pending.");
        error.statusCode = 409;
        throw error;
      }

      await transaction.user.update({
        where: { userId: applicant.userId },
        data: {
          isActive: decision === "approve",
          pharmacistApplicationStatus: decision === "approve" ? "approved" : "rejected",
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: BigInt(request.user.id),
          action: "UPDATE",
          entityType: "app_users",
          entityId: applicant.userId,
          eventData: { source: "pharmacist_access_review", decision },
        },
      });
    });

    response.json({ status: "ok", message: decision === "approve" ? "Pharmacist access approved." : "Pharmacist access request rejected." });
  } catch (error) {
    if (error.statusCode) return response.status(error.statusCode).json({ status: "error", message: error.message });
    console.error("Pharmacist application decision failed:", error.message);
    response.status(500).json({ status: "error", message: "Could not update this pharmacist access request." });
  }
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ status: "ok", user: request.user });
});

app.use("/api/patient", requireAuth, requireRole("patient"), patientRoutes);
app.use("/api/pharmacist", requireAuth, requireRole("pharmacist", "admin"), pharmacistRoutes);

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
          await prisma.$transaction([
            prisma.prescription.update({
              where: { prescriptionId: BigInt(prescriptionId) },
              data: { imagePath: relativePath },
            }),
            prisma.ocrResult.create({
              data: {
                prescriptionId: BigInt(prescriptionId),
                extractedText: analysis.ocrText,
                confidence: ocrConfidenceScore(analysis),
                engineName: "Tesseract",
              },
            }),
          ]);
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
        await prisma.$transaction([
          prisma.prescription.update({
            where: { prescriptionId: BigInt(prescriptionId) },
            data: { imagePath: relativePath },
          }),
          prisma.ocrResult.create({
            data: {
              prescriptionId: BigInt(prescriptionId),
              extractedText: analysis.ocrText,
              confidence: ocrConfidenceScore(analysis),
              engineName: "Tesseract",
            },
          }),
        ]);
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
