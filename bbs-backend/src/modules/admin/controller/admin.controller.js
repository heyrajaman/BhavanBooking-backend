import { BookingDetailResponseDto } from "../../booking/dto/booking.response.dto.js";
import { AdminService } from "../service/admin.service.js";

export class AdminController {
  constructor() {
    this.adminService = new AdminService();
  }

  /**
   * Handles the request for an Admin to approve a booking and set the advance amount
   */
  approveBooking = async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      const adminUserId = req.user.id; // Extracted from JWT token

      // Grab the advance amount from the frontend request body
      const { advanceAmountRequested } = req.body;

      if (!advanceAmountRequested) {
        return res.status(400).json({
          success: false,
          message: "Please provide the advanceAmountRequested.",
        });
      }

      const updatedBooking = await this.adminService.approveBooking(
        bookingId,
        adminUserId,
        advanceAmountRequested,
      );

      return res.status(200).json({
        success: true,
        message:
          "Booking approved successfully. Waiting for user to pay the advance.",
        data: {
          status: updatedBooking.status,
          advanceAmountRequested: updatedBooking.advanceAmountRequested,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Fetch all bookings for the Clerk/Admin dashboard
   * Supports filtering via query parameters (e.g., ?status=PENDING)
   */
  getAllBookings = async (req, res, next) => {
    try {
      // Extract any filters from the URL query string
      const queryFilters = {
        status: req.query.status,
      };

      const bookings = await this.adminService.getAllBookings(queryFilters);

      // In a strict DTO architecture, you would map these raw 'bookings' to a ResponseDTO here
      // before sending them to the client to hide database-specific fields.
      return res.status(200).json({
        success: true,
        message: "Bookings fetched successfully",
        results: bookings.length,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handles the request for a Clerk to verify a PENDING booking
   */
  verifyByClerk = async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      const clerkUserId = req.user.id; // Extracted from JWT token

      const updatedBooking = await this.adminService.verifyBookingByClerk(
        bookingId,
        clerkUserId,
      );

      return res.status(200).json({
        success: true,
        message: "Booking successfully verified by Clerk.",
        data: { status: updatedBooking.status },
      });
    } catch (error) {
      next(error);
    }
  };

  getBookingDetails = async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      const bookingDetails =
        await this.adminService.getBookingDetails(bookingId);

      // Map the raw database result to our strict Admin DTO
      const responseData = new BookingDetailResponseDto(bookingDetails);

      return res.status(200).json({
        success: true,
        message: "Booking details fetched successfully",
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  };
}
