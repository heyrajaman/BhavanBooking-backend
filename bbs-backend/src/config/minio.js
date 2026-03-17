import * as Minio from "minio";
import crypto from "crypto";
import { AppError } from "../utils/AppError.js";

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

const bucketName = process.env.MINIO_BUCKET_NAME;

// Helper function to ensure the bucket exists on server startup
export const initMinio = async () => {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, "ap-south-1"); // Change region if needed
      console.log(`🪣  MinIO Bucket '${bucketName}' created successfully.`);
    } else {
      console.log(`🪣  MinIO Bucket '${bucketName}' is ready.`);
    }
  } catch (error) {
    console.error("❌ MinIO Initialization Failed:", error);
  }
};

// Function to upload the Multer file buffer directly to MinIO
export const uploadFileToMinio = async (file) => {
  if (!file) return null;

  // Generate a unique filename to prevent overwrites
  const uniquePrefix = crypto.randomBytes(8).toString("hex");
  const fileName = `aadhar_${uniquePrefix}_${file.originalname.replace(/\s+/g, "_")}`;

  const metaData = {
    "Content-Type": file.mimetype,
  };

  try {
    // putObject takes: bucketName, objectName, stream/buffer, size, metaData
    await minioClient.putObject(
      bucketName,
      fileName,
      file.buffer,
      file.size,
      metaData,
    );

    // Return the file path (you can later construct a full URL or pre-signed URL to view it)
    return fileName;
  } catch (error) {
    console.error("MinIO Upload Error:", error);
    throw new AppError("Failed to upload Aadhar image to storage server.", 500);
  }
};

export default minioClient;
