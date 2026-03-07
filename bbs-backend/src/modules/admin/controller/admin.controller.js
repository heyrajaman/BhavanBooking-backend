import { AdminService } from "../service/admin.service.js";

export class AdminController {
  constructor() {
    this.adminService = new AdminService();
  }

  approveBooking = async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      const adminUserId = req.user.id; // Extracted from JWT token via Auth Middleware

      const updatedBooking = await this.adminService.approveBooking(
        bookingId,
        adminUserId,
      );

      return res.status(200).json({
        success: true,
        message: "Booking successfully approved by Admin and logged.",
        data: { status: updatedBooking.status },
      });
    } catch (error) {
      next(error);
    }
  };
}
