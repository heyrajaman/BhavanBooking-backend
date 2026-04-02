// src/modules/facility/service/facility.service.js
import { FacilityRepository } from "../repository/facility.repository.js";
import { BookingAccessService } from "../../booking/service/booking.access.service.js";
import sharp from "sharp";
import minioClient from "../../../config/minio.js";
import redisConnection, {
  cacheTtl,
  deleteKeysByPattern,
  getJsonCache,
  setJsonCache,
} from "../../../config/redis.js";
import { cleanupUploadedTempFile } from "../../../utils/minioUpload.js";

const FACILITIES_BASE_CACHE_KEY = "facilities:all";
const FACILITIES_AVAILABILITY_PREFIX = "facilities:availability";

const buildAvailabilityCacheKey = (startDate, endDate) =>
  `${FACILITIES_AVAILABILITY_PREFIX}:${encodeURIComponent(startDate)}:${encodeURIComponent(endDate)}`;

export class FacilityService {
  constructor() {
    this.facilityRepository = new FacilityRepository();
    this.bookingService = new BookingAccessService();
  }

  async _invalidateFacilitiesCache() {
    await redisConnection.del(FACILITIES_BASE_CACHE_KEY);
    await deleteKeysByPattern(`${FACILITIES_AVAILABILITY_PREFIX}:*`);
  }

  /**
   * Create a new facility (Package or Custom)
   */
  async createFacility(facilityData, imageFiles = []) {
    // 1. Process and upload images to MinIO if they exist
    if (imageFiles && imageFiles.length > 0) {
      const bucketName = process.env.MINIO_BUCKET_NAME;
      const minioEndpoint = process.env.MINIO_ENDPOINT;
      const minioPort = process.env.MINIO_PORT || 9000;
      const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";

      const uploadedUrls = [];

      for (const file of imageFiles) {
        try {
          const compressedBuffer = await sharp(file.path || file.buffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

          const fileName = `seed-images/newfac-${Date.now()}-${Math.round(Math.random() * 1000)}.jpg`;

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
        } finally {
          await cleanupUploadedTempFile(file);
        }
      }

      // Attach the URLs to the database payload
      facilityData.images = uploadedUrls;
    } else {
      facilityData.images = [];
    }

    // 2. Save the facility data (with image URLs) to the database
    const newFacility = await this.facilityRepository.create(facilityData);

    await this._invalidateFacilitiesCache();

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

    const updatedFacility = await this.facilityRepository.update(
      facilityId,
      updateData,
    );

    await this._invalidateFacilitiesCache();

    return updatedFacility;
  }

  async getAllFacilities(startDate, endDate) {
    const hasDateRange = Boolean(startDate && endDate);
    const availabilityCacheKey = hasDateRange
      ? buildAvailabilityCacheKey(startDate, endDate)
      : null;

    if (availabilityCacheKey) {
      const cachedAvailability = await getJsonCache(availabilityCacheKey);
      if (cachedAvailability) {
        return cachedAvailability;
      }
    }

    let facilitiesDb;

    const cachedFacilities = await getJsonCache(FACILITIES_BASE_CACHE_KEY);

    if (cachedFacilities) {
      facilitiesDb = cachedFacilities;
    } else {
      // Cache MISS: Fetch all facilities from DB
      facilitiesDb = await this.facilityRepository.findAll();

      const plainFacilities = facilitiesDb.map((f) =>
        f.toJSON ? f.toJSON() : f,
      );
      await setJsonCache(
        FACILITIES_BASE_CACHE_KEY,
        plainFacilities,
        cacheTtl.facilitiesDefaultSeconds,
      );

      facilitiesDb = plainFacilities;
    }

    // Convert Sequelize models to standard JSON objects so we can add new properties
    const facilities = facilitiesDb.map((f) => (f.toJSON ? f.toJSON() : f));

    // 2. If dates are provided, filter availability!
    if (hasDateRange) {
      const overlaps = await this.bookingService.findOverlappingBookings(
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

    if (availabilityCacheKey) {
      await setJsonCache(
        availabilityCacheKey,
        facilities,
        cacheTtl.facilitiesAvailabilitySeconds,
      );
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
        try {
          const compressedBuffer = await sharp(file.path || file.buffer)
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
        } finally {
          await cleanupUploadedTempFile(file);
        }
      }

      updateData.images = [...(updateData.images || []), ...uploadedUrls];
    }

    const updatedFacility = await this.facilityRepository.update(
      facilityId,
      updateData,
    );

    await this._invalidateFacilitiesCache();

    return updatedFacility;
  }

  async deleteFacility(facilityId) {
    const facility = await this.facilityRepository.findById(facilityId);

    if (!facility) {
      throw new Error("Facility not found.");
    }

    const deleted = await this.facilityRepository.delete(facilityId);

    await this._invalidateFacilitiesCache();

    return deleted;
  }

  async findById(facilityId) {
    return await this.facilityRepository.findById(facilityId);
  }

  async findAll(filters = {}) {
    return await this.facilityRepository.findAll(filters);
  }
}
