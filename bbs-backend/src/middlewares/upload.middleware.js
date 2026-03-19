import multer from "multer";
import { AppError } from "../utils/AppError.js";

// Use memory storage to keep the file in a Buffer
const storage = multer.memoryStorage();

// Only accept images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image! Please upload only images.", 400), false);
  }
};

export const uploadImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 5MB limit
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
  storage: storage, // We reuse your existing memoryStorage()
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit should be plenty for an invoice PDF
  },
});
