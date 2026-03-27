// src/modules/facility/service/facility.service.js
import { FacilityRepository } from "../repository/facility.repository.js";
import { BookingRepository } from "../../booking/repository/booking.repository.js";
import sharp from "sharp";
import minioClient from "../../../config/minio.js";
import { AppError } from "../../../utils/AppError.js";
export class FacilityService {
  constructor() {
    this.facilityRepository = new FacilityRepository();
    this.bookingRepository = new BookingRepository();
  }

  /**
   * Create a new facility (Package or Custom)
   */
  async createFacility(facilityData, files) {
    const imageUrls = [];

    // 1. Process and upload images if the user provided any
    if (files && files.length > 0) {
      const bucketName = process.env.MINIO_BUCKET_NAME;
      const minioEndpoint = process.env.MINIO_ENDPOINT;

      for (const file of files) {
        if (!file.buffer) continue;

        try {
          // Compress the image using Sharp
          const compressedBuffer = await sharp(file.buffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

          // Generate a unique filename
          const fileName = `facilities/fac-${Date.now()}-${Math.round(Math.random() * 1000)}.jpg`;

          // Upload to Minio
          await minioClient.putObject(
            bucketName,
            fileName,
            compressedBuffer,
            compressedBuffer.length,
            { "Content-Type": "image/jpeg" },
          );

          // Construct the public URL and push to our array
          const fileUrl = `${minioEndpoint}/${bucketName}/${fileName}`;
          imageUrls.push(fileUrl);
        } catch (error) {
          console.error("Facility Image Upload Error:", error);
          throw new AppError(
            "Failed to process and upload facility images.",
            500,
          );
        }
      }
    }

    // 2. Attach the generated URLs to the facility data payload
    // Your facility model expects 'images' to be a JSON array of strings
    facilityData.images = imageUrls;

    // 3. Save everything to the database using your repository
    const newFacility = await this.facilityRepository.create(facilityData);

    return newFacility;
  }
  /**
   * Update an existing facility's pricing
   */
  async updateFacilityPricing(facilityId, newBaseRate, newSecurityDeposit) {
    const facility = await this.facilityRepository.findById(facilityId);

    if (!facility) {
      // Assuming you have AppError imported in this file
      throw new Error("Facility not found.");
    }

    const updateData = {};
    if (newBaseRate !== undefined) updateData.baseRate = newBaseRate;
    if (newSecurityDeposit !== undefined)
      updateData.securityDeposit = newSecurityDeposit;

    return await this.facilityRepository.update(facilityId, updateData);
  }

  async getAllFacilities(startDate, endDate) {
    // 1. Fetch all facilities from DB
    const facilitiesDb = await this.facilityRepository.findAll();

    // Convert Sequelize models to standard JSON objects so we can add new properties
    const facilities = facilitiesDb.map((f) => (f.toJSON ? f.toJSON() : f));

    // 2. If dates are provided, filter availability!
    if (startDate && endDate) {
      const overlaps = await this.bookingRepository.findOverlappingBookings(
        startDate,
        endDate,
      );
      let unavailableNames = new Set();

      // Build a set of everything that is booked (Main packages + Custom Items + Sub-components)
      overlaps.forEach((booking) => {
        if (booking.customDetails) {
          booking.customDetails.forEach((item) =>
            unavailableNames.add(item.name),
          );
        }
        if (booking.facility) {
          unavailableNames.add(booking.facility.name);
          if (booking.facility.pricingDetails?.included_facilities) {
            booking.facility.pricingDetails.included_facilities.forEach((inc) =>
              unavailableNames.add(inc),
            );
          }
        }
      });

      // Mark each facility as available or not
      facilities.forEach((fac) => {
        fac.isAvailableForDates = true;

        // Condition A: The facility itself is directly booked
        if (unavailableNames.has(fac.name)) {
          // Allow multiple rooms to still show, but block Halls/Lawns/Packages
          if (fac.facilityType !== "ROOM") {
            fac.isAvailableForDates = false;
          }
        }

        // Condition B: It's a Package, and one of its sub-items (like Kitchen) is booked
        if (fac.pricingDetails?.included_facilities) {
          const hasBlockedInclusion =
            fac.pricingDetails.included_facilities.some((inc) =>
              unavailableNames.has(inc),
            );
          if (hasBlockedInclusion) {
            fac.isAvailableForDates = false;
          }
        }
      });
    } else {
      // If no dates searched, everything defaults to available for UI purposes
      facilities.forEach((fac) => (fac.isAvailableForDates = true));
    }

    return facilities;
  }

  async updateFacility(facilityId, updateData, newImageFiles = []) {
    const facility = await this.facilityRepository.findById(facilityId);

    if (!facility) {
      throw new Error("Facility not found.");
    }

    if (newImageFiles && newImageFiles.length > 0) {
      const bucketName = process.env.MINIO_BUCKET_NAME;
      const minioEndpoint = process.env.MINIO_ENDPOINT;

      const minioPort = process.env.MINIO_PORT || 9000;
      const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";

      const uploadedUrls = [];

      for (const file of newImageFiles) {
        const compressedBuffer = await sharp(file.buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        const fileName = `seed-images/${facilityId}-${Date.now()}-${Math.round(Math.random() * 1000)}.jpg`;

        await minioClient.putObject(
          bucketName,
          fileName,
          compressedBuffer,
          compressedBuffer.length,
          { "Content-Type": "image/jpeg" },
        );

        uploadedUrls.push(
          `${protocol}://${minioEndpoint}:${minioPort}/${bucketName}/${fileName}`,
        );
      }

      updateData.images = [...(updateData.images || []), ...uploadedUrls];
    }

    return await this.facilityRepository.update(facilityId, updateData);
  }

  async deleteFacility(facilityId) {
    const facility = await this.facilityRepository.findById(facilityId);

    if (!facility) {
      throw new Error("Facility not found.");
    }

    return await this.facilityRepository.delete(facilityId);
  }
}
