import sharp from "sharp";
import minioClient from "../../../config/minio.js";
import { AppError } from "../../../utils/AppError.js";
import { cleanupUploadedTempFile } from "../../../utils/minioUpload.js";

export class BookingDocumentService {
  constructor({ bookingRepository }) {
    this.bookingRepository = bookingRepository;
  }

  async uploadAadhaarImages(
    bookingId,
    userId,
    frontFile,
    backFile,
    isAdmin = false,
  ) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (!isAdmin && booking.userId !== userId) {
      throw new AppError(
        "You do not have permission to upload documents for this booking.",
        403,
      );
    }

    const invalidStates = [
      "CANCELLED",
      "REJECTED",
      "CHECKED_IN",
      "CHECKED_OUT",
    ];
    if (invalidStates.includes(booking.status)) {
      throw new AppError(
        `Cannot upload documents. Booking is currently ${booking.status}.`,
        400,
      );
    }

    const bucketName = process.env.MINIO_BUCKET_NAME;

    const processAndUpload = async (file, side) => {
      if (!file || (!file.path && !file.buffer)) {
        throw new AppError(`${side} image payload is missing or invalid.`, 400);
      }

      try {
        const compressedBuffer = await sharp(file.path || file.buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        const fileName = `aadhaar/${booking.id}-${side}-${Date.now()}.jpg`;

        await minioClient.putObject(
          bucketName,
          fileName,
          compressedBuffer,
          compressedBuffer.length,
          { "Content-Type": "image/jpeg" },
        );

        const protocol =
          process.env.MINIO_USE_SSL === "true" ? "https" : "http";
        const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : "";

        return `${protocol}://${process.env.MINIO_ENDPOINT}${port}/${bucketName}/${fileName}`;
      } catch (sharpError) {
        console.error(`Sharp/Minio Error (${side}):`, sharpError);
        throw new AppError(
          `Failed to process ${side} image: ${sharpError.message}`,
          500,
        );
      } finally {
        await cleanupUploadedTempFile(file);
      }
    };

    const [frontUrl, backUrl] = await Promise.all([
      processAndUpload(frontFile, "front"),
      processAndUpload(backFile, "back"),
    ]);

    booking.aadharFrontImageUrl = frontUrl;
    booking.aadharBackImageUrl = backUrl;
    await booking.save();

    return {
      aadharFrontImageUrl: booking.aadharFrontImageUrl,
      aadharBackImageUrl: booking.aadharBackImageUrl,
    };
  }
}
