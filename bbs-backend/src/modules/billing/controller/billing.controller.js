// src/modules/billing/controller/billing.controller.js
import { BillingService } from "../service/billing.service.js";

export class BillingController {
  constructor() {
    this.billingService = new BillingService();
  }

  /**
   * MAKER: Clerk drafts the invoice for a booking
   */
  generateDraftInvoice = async (req, res) => {
    const dto = req.body;
    dto.bookingId = req.params.bookingId;

    // Assuming your `protectRoute` middleware attaches the logged-in user to `req.user`
    const clerkId = req.user.id;

    const draftInvoice = await this.billingService.generateDraftInvoice(
      dto,
      clerkId,
    );

    return res.status(201).json({
      success: true,
      message:
        "Draft invoice generated successfully and is pending Admin approval.",
      data: draftInvoice,
    });
  };

  getInvoice = async (req, res) => {
    const { bookingId } = req.params;
    const invoice = await this.billingService.getInvoiceByBookingId(bookingId);

    return res.status(200).json({
      success: true,
      data: invoice,
    });
  };

  /**
   * CHECKER: Admin approves or rejects the drafted invoice
   */
  processAdminApproval = async (req, res) => {
    const { invoiceId } = req.params;
    const dto = req.body;
    const adminId = req.user.id;

    const result = await this.billingService.processAdminApproval(
      invoiceId,
      dto,
      adminId,
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.settlementReport || result.invoice,
    });
  };
}
