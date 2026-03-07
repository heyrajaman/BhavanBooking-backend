import { BillingService } from "../service/billing.service.js";
// Assuming we have a BookingService imported to handle the Check-in status change
import { BookingService } from "../../booking/service/booking.service.js";

export class BillingController {
  constructor() {
    this.billingService = new BillingService();
    this.bookingService = new BookingService();
  }

  /**
   * Handles the Guest Check-in Process
   */
  processCheckIn = async (req, res) => {
    // The DTO (CheckInRequestDto) has already validated that Aadhaar is provided
    // and guest count <= 6 for rooms.
    const checkInDto = req.body;
    const { bookingId } = req.params;

    // Delegate to service to update DB status to 'CHECKED_IN' and save Aadhaar info
    const updatedBooking = await this.bookingService.markAsCheckedIn(
      bookingId,
      checkInDto,
    );

    return res.status(200).json({
      success: true,
      message: "Guest successfully checked in.",
      data: updatedBooking,
    });
  };

  /**
   * Handles the Guest Check-out and Final Settlement Calculation
   */
  processCheckOut = async (req, res) => {
    // The CheckoutRequestDto from the previous step is now in req.body
    const checkoutDto = req.body;
    checkoutDto.bookingId = req.params.bookingId; // Attach ID from the URL

    // Run the complex FRS math we built in the Billing Service
    const settlementReport =
      await this.billingService.calculateFinalSettlement(checkoutDto);

    // After calculating, we update the booking status to 'CHECKED_OUT'
    await this.bookingService.markAsCheckedOut(checkoutDto.bookingId);

    return res.status(200).json({
      success: true,
      message: "Checkout complete. Final settlement calculated.",
      data: settlementReport,
    });
  };
}
