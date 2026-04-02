import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { AppError } from "../utils/AppError.js";

const uploadTmpDir =
  process.env.UPLOAD_TMP_DIR || path.join(os.tmpdir(), "bbs-uploads");
fs.mkdirSync(uploadTmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadTmpDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "");
    const safeExtension = extension || "";
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`;
    cb(null, uniqueName);
  },
});
const MB = 1024 * 1024;

const commonMemoryLimits = {
  // Limit request complexity even when files are written to disk.
  files: 5,
  fields: 20,
  parts: 25,
  fieldSize: 64 * 1024,
};

// Only accept images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image! Please upload only images.", 400), false);
  }
};

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    ...commonMemoryLimits,
    fileSize: 2 * MB, // 2MB per image
  },
});

const pdfFileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(
      new AppError("Not a PDF! Please upload only PDF documents.", 400),
      false,
    );
  }
};

// 👈 NEW: Middleware export for PDF uploads
export const uploadPdf = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: {
    ...commonMemoryLimits,
    files: 1,
    fileSize: 5 * MB, // 5MB per PDF
  },
});
