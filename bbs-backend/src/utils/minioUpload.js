// File: src/utils/minioUpload.js
import fs from "fs";
import path from "path";
import { promisify } from "util";
import minioClient from "../config/minio.js";
import "../config/env.js";
import { AppError } from "./AppError.js";

const env = process.env;
const statAsync = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);

const getMulterFilePayload = async (file) => {
  if (!file) {
    throw new AppError("File is required for upload.", 400);
  }

  if (file.path) {
    const stats = await statAsync(file.path);
    return {
      payload: fs.createReadStream(file.path),
      size: file.size || stats.size,
    };
  }

  if (file.buffer) {
    return {
      payload: file.buffer,
      size: file.size || file.buffer.length,
    };
  }

  throw new AppError("Uploaded file has no readable data.", 400);
};

export const cleanupUploadedTempFile = async (file) => {
  if (!file || !file.path) return;

  try {
    await unlinkAsync(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`⚠️ Failed to remove temp upload file ${file.path}`);
    }
  }
};

export const uploadMulterFileToMinio = async ({
  file,
  objectName,
  bucketName = env.MINIO_BUCKET_NAME,
  cleanup = false,
}) => {
  if (!objectName) {
    throw new AppError("objectName is required for MinIO upload.", 500);
  }

  const { payload, size } = await getMulterFilePayload(file);
  const contentType = file.mimetype || "application/octet-stream";

  try {
    await minioClient.putObject(bucketName, objectName, payload, size, {
      "Content-Type": contentType,
    });

    const protocol = env.MINIO_USE_SSL === "true" ? "https" : "http";
    const port = env.MINIO_PORT ? `:${env.MINIO_PORT}` : "";
    const url = `${protocol}://${env.MINIO_ENDPOINT}${port}/${bucketName}/${objectName}`;

    return { objectName, url };
  } finally {
    if (cleanup) {
      await cleanupUploadedTempFile(file);
    }
  }
};

const sanitizeObjectSuffix = (fileName = "") =>
  path.basename(fileName).replace(/\s+/g, "_");

export async function uploadSeedImageToMinio(localFilePath, fileName) {
  // Use the new bucket from your environment variables
  const bucketName = env.MINIO_BUCKET_NAME;

  const objectName = `seed-images/${sanitizeObjectSuffix(fileName)}`;

  try {
    // 1. Check if the bucket exists
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      // Create bucket
      await minioClient.makeBucket(bucketName, "us-east-1");

      // Set bucket policy to public read
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Action: ["s3:GetObject"],
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Resource: [`arn:aws:s3:::${bucketName}/seed-images/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    }

    // 2. Upload the file to MinIO
    const metaData = {
      "Content-Type": "image/jpeg",
    };
    await minioClient.fPutObject(
      bucketName,
      objectName,
      localFilePath,
      metaData,
    );
    // 3. Construct the URL using your env variables
    const imageUrl = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/${bucketName}/${objectName}`;

    return imageUrl;
  } catch (error) {
    console.error(`Error uploading ${fileName} to MinIO:`, error);
    throw error;
  }
}
