export class InvoiceCalculatorService {
  calculateDraftInvoiceSnapshot({ dto, booking, customer, taxSettings }) {
    const isDonation = dto.invoiceType === "DONATION";
    const invoiceType = dto.invoiceType || "GENERAL";

    const securityDeposit = parseFloat(booking.securityDeposit || 0);
    const baseAmount = parseFloat(booking.calculatedAmount || 0);
    const userId = customer.id;

    const customerName = isDonation ? dto.customerName : customer.fullName;
    const customerEmail = isDonation ? dto.customerEmail : customer.email;
    const customerPhone = isDonation ? dto.customerPhone : customer.mobile;
    const billingAddress = isDonation
      ? dto.billingAddress
      : dto.billingAddress || null;

    const discountAmount = parseFloat(dto.discountAmount || 0);
    const additionalItems = dto.additionalItems || [];
    const totalAdditionalAmount = additionalItems.reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0,
    );

    const electricityCharges = (dto.electricityUnitsConsumed || 0) * 14;
    const cleaningCharges = parseFloat(dto.cleaningCharges || 0);
    const generatorCharges = parseFloat(dto.generatorCharges || 0);

    let totalPenalties = 0;
    if (dto.damagesAndPenalties && dto.damagesAndPenalties.length > 0) {
      totalPenalties = dto.damagesAndPenalties.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0,
      );
    }

    const totalDeductions =
      electricityCharges + cleaningCharges + generatorCharges + totalPenalties;

    const taxableAmount = Math.max(
      0,
      baseAmount + totalAdditionalAmount + totalDeductions - discountAmount,
    );

    const cgstRate = parseFloat(taxSettings.cgstPercentage) / 100;
    const sgstRate = parseFloat(taxSettings.sgstPercentage) / 100;

    const cgstAmount = isDonation
      ? 0.0
      : parseFloat((taxableAmount * cgstRate).toFixed(2));
    const sgstAmount = isDonation
      ? 0.0
      : parseFloat((taxableAmount * sgstRate).toFixed(2));

    const totalAmount = taxableAmount + cgstAmount + sgstAmount;

    const totalPaidUpfront = baseAmount + securityDeposit;
    const netDifference = totalPaidUpfront - totalAmount;

    let finalRefundAmount = 0;
    let additionalBalanceDue = 0;

    if (netDifference > 0) {
      finalRefundAmount = parseFloat(netDifference.toFixed(2));
    } else if (netDifference < 0) {
      additionalBalanceDue = parseFloat(Math.abs(netDifference).toFixed(2));
    }

    const settlementMode = dto.settlementMode || "ONLINE";
    const dueDate = ["CASH", "QR"].includes(settlementMode)
      ? new Date()
      : dto.dueDate;

    return {
      invoiceType,
      settlementMode,
      userId,
      customerName,
      customerEmail,
      customerPhone,
      billingAddress,
      dueDate,
      baseAmount,
      additionalItems,
      totalAdditionalAmount,
      discountAmount,
      cgstAmount,
      sgstAmount,
      totalAmount,
      electricityUnitsConsumed: dto.electricityUnitsConsumed,
      electricityCharges,
      cleaningCharges,
      generatorCharges,
      damagesAndPenalties: dto.damagesAndPenalties,
      totalDeductions,
      securityDepositHeld: securityDeposit,
      finalRefundAmount,
      additionalBalanceDue,
    };
  }
}
