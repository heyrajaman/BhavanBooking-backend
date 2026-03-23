// File: src/utils/minioUpload.js
import minioClient from "../config/minio.js";
import "../config/env.js";

const env = process.env;

export async function uploadSeedImageToMinio(localFilePath, fileName) {
  // Use the new bucket from your environment variables
  const bucketName = env.FACILITY_BUCKET_NAME || "facilities";

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
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    }

    // 2. Upload the file to MinIO
    const metaData = {
      "Content-Type": "image/jpeg",
    };
    await minioClient.fPutObject(bucketName, fileName, localFilePath, metaData);

    // 3. Construct the URL using your env variables
    const imageUrl = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/${bucketName}/${fileName}`;

    return imageUrl;
  } catch (error) {
    console.error(`Error uploading ${fileName} to MinIO:`, error);
    throw error;
  }
}
