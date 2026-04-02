import { AppError } from "../../../utils/AppError.js";

export class BookingAvailabilityService {
  constructor({ bookingRepository, facilityService }) {
    this.bookingRepository = bookingRepository;
    this.facilityService = facilityService;
  }

  async getUnavailableDates(facilityId) {
    const targetFacility = await this.facilityService.findById(facilityId);
    if (!targetFacility) throw new AppError("Facility not found.", 404);

    const allUpcomingBookings =
      await this.bookingRepository.findAllUpcomingActiveBookings();

    const blockedDates = [];

    allUpcomingBookings.forEach((booking) => {
      let isConflict = false;

      if (booking.customDetails && booking.customDetails.length > 0) {
        const hasTarget = booking.customDetails.some(
          (item) => item.name === targetFacility.name,
        );

        const targetInclusions =
          targetFacility.pricingDetails?.included_facilities || [];
        const blocksPackage = targetInclusions.some((inc) =>
          booking.customDetails.some((item) => item.name === inc),
        );

        if (
          (hasTarget || blocksPackage) &&
          targetFacility.facilityType !== "ROOM"
        ) {
          isConflict = true;
        }
      }

      if (booking.facility) {
        if (booking.facility.id === targetFacility.id) isConflict = true;

        const bookedInclusions =
          booking.facility.pricingDetails?.included_facilities || [];
        if (bookedInclusions.includes(targetFacility.name)) isConflict = true;

        const targetInclusions =
          targetFacility.pricingDetails?.included_facilities || [];
        if (targetInclusions.includes(booking.facility.name)) isConflict = true;

        const sharedComponents = targetInclusions.filter((inc) =>
          bookedInclusions.includes(inc),
        );
        if (sharedComponents.length > 0) isConflict = true;

        if (isConflict && targetFacility.facilityType === "ROOM") {
          isConflict = false;
        }
      }

      if (isConflict) {
        blockedDates.push({
          start: booking.startTime,
          end: booking.endTime,
          status: booking.status,
        });
      }
    });

    return blockedDates;
  }
}
