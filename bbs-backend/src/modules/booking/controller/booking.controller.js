import { BookingService } from "../service/booking.service.js";

export class BookingController {
  constructor() {
    this.bookingService = new BookingService();
  }

  // Use arrow functions to auto-bind 'this', a common pattern in JS classes
  createBooking = async (req, res, next) => {
    try {
      // req.body is already validated by our DTO middleware at the router level
      const bookingDto = req.body;

      const result =
        await this.bookingService.createProvisionalBooking(bookingDto);

      // Return a standard 201 Created response
      return res.status(201).json({
        success: true,
        message:
          "Provisional booking created. Please pay 20% advance within 7 days to confirm.",
        data: {
          bookingReference: result.bookingReference,
          status: result.status,
        },
      });
    } catch (error) {
      // Pass the error to the global error handling middleware
      next(error);
    }
  };
}
