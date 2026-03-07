import { PaymentService } from "../service/payment.service.js";

export class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

  createPaymentLink = async (req, res, next) => {
    try {
      // Assuming a DTO has already validated req.body
      const linkUrl = await this.paymentService.generatePaymentLink(req.body);

      return res.status(200).json({
        success: true,
        message: "Payment link generated successfully",
        paymentUrl: linkUrl,
      });
    } catch (error) {
      next(error);
    }
  };

  handleWebhook = async (req, res, next) => {
    try {
      const signature = req.headers["x-razorpay-signature"];

      // Note: For webhooks to work properly in Express, you often need to use
      // express.raw({ type: 'application/json' }) middleware for this specific route
      // so req.body is a raw Buffer/String, not a parsed JS object.
      const rawBody = req.body.toString();

      await this.paymentService.verifyWebhook(rawBody, signature);

      // Razorpay expects a 200 OK back very quickly, otherwise it will retry sending the webhook
      return res.status(200).send("Webhook verified successfully");
    } catch (error) {
      console.error("[WEBHOOK ERROR]:", error.message);
      // Return 400 so Razorpay knows something was wrong with the request
      return res.status(400).send("Webhook verification failed");
    }
  };
}
