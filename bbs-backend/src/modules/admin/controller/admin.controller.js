import {
  BookingDetailResponseDto,
  BookingResponseDto,
} from "../../booking/dto/booking.response.dto.js";
import { AdminService } from "../service/admin.service.js";
import { AppError } from "../../../utils/AppError.js";
import { getIO } from "../../../config/socket.js";

export class AdminController {
  constructor() {
    this.adminService = new AdminService();
  }

  uploadSignature = async (req, res, next) => {
    // 1. Check if Multer caught the file
    if (!req.file) {
      throw new AppError("Please upload a signature image file.", 400);
    }

    const adminId = req.user.id;

    // 2. Pass the ID and the file to the Service
    const signatureUrl = await this.adminService.uploadAdminSignature(
      adminId,
      req.file,
    );

    // 3. Send the response back to the frontend
    res.status(200).json({
      status: "success",
      message: "Admin signature uploaded successfully.",
      data: {
        signatureUrl: signatureUrl,
      },
    });
  };

  approveBooking = async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      const adminUserId = req.user.id; // Extracted from JWT token

      const { advanceAmountRequested, revisedTotalAmount } = req.body;

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
        revisedTotalAmount,
      );

      try {
        const io = getIO();
        io.to(`user_${updatedBooking.userId}`).emit("booking_status_updated", {
          message:
            "Your booking has been approved! Please proceed to pay the advance amount.",
          bookingId: updatedBooking.id,
          status: updatedBooking.status,
        });
      } catch (err) {
        console.error("Socket emit failed (Admin Approval):", err.message);
      }

      return res.status(200).json({
        success: true,
        message:
          "Booking approved successfully. Waiting for user to pay the advance.",
        data: {
          status: updatedBooking.status,
          advanceAmountRequested: updatedBooking.advanceAmountRequested,
          calculatedAmount: updatedBooking.calculatedAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getAllBookings = async (req, res, next) => {
    try {
      // Extract any filters from the URL query string
      const queryFilters = {
        status: req.query.status,
      };

      const bookings = await this.adminService.getAllBookings(queryFilters);

      const formattedBookings = bookings.map(
        (booking) => new BookingResponseDto(booking),
      );

      return res.status(200).json({
        success: true,
        message: "Bookings fetched successfully",
        results: bookings.length,
        data: formattedBookings,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyByClerk = async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      const clerkUserId = req.user.id; // Extracted from JWT token

      const updatedBooking = await this.adminService.verifyBookingByClerk(
        bookingId,
        clerkUserId,
      );

      try {
        const io = getIO();

        // 1. Notify the User on their dashboard
        io.to(`user_${updatedBooking.userId}`).emit("booking_status_updated", {
          message:
            "Your booking has been verified by the clerk and is awaiting final Admin approval.",
          bookingId: updatedBooking.id,
          status: updatedBooking.status,
        });

        // 2. Notify the Admin Dashboard to refresh instantly
        io.to("admin-notifications").emit("booking_status_updated", {
          message: `Booking #${updatedBooking.id} has been verified by a clerk and requires Admin approval.`,
          bookingId: updatedBooking.id,
          status: updatedBooking.status,
        });
      } catch (err) {
        console.error("Socket emit failed (Clerk Verification):", err.message);
      }

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

  getTaxSettings = async (req, res, next) => {
    try {
      const settings = await this.adminService.getTaxSettings();
      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  };

  updateTaxSettings = async (req, res, next) => {
    try {
      const { cgstPercentage, sgstPercentage } = req.body;

      const updatedSettings = await this.adminService.updateTaxSettings(
        cgstPercentage,
        sgstPercentage,
      );

      return res.status(200).json({
        success: true,
        message: "Tax settings updated successfully.",
        data: updatedSettings,
      });
    } catch (error) {
      next(error);
    }
  };
}
