import { BookingRepository } from "../repository/booking.repository.js";

export class BookingAccessService {
  constructor() {
    this.bookingRepository = new BookingRepository();
  }

  async findById(bookingId) {
    return await this.bookingRepository.findById(bookingId);
  }

  async findAll(filters = {}) {
    return await this.bookingRepository.findAll(filters);
  }

  async findByIdWithDetails(bookingId) {
    return await this.bookingRepository.findByIdWithDetails(bookingId);
  }

  async findOverlappingBookings(startDate, endDate, excludeBookingId = null) {
    return await this.bookingRepository.findOverlappingBookings(
      startDate,
      endDate,
      excludeBookingId,
    );
  }

  async findAllUpcomingActiveBookings() {
    return await this.bookingRepository.findAllUpcomingActiveBookings();
  }
}
