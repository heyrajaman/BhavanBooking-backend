// src/modules/booking/model/booking.model.js
import { Model, DataTypes } from "sequelize";

export default class Booking extends Model {
  static initModel(sequelize) {
    Booking.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        facilityId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        customDetails: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        startTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        endTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        eventType: {
          type: DataTypes.STRING(100),
          allowNull: false, // e.g., "Marriage", "Meeting", "Cultural Event"
        },
        guestCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        status: {
          // The exact State Machine flow we designed
          type: DataTypes.ENUM(
            "PENDING_CLERK_REVIEW",
            "PENDING_ADMIN_APPROVAL",
            "PENDING_ADVANCE_PAYMENT",
            "AWAITING_CASH_PAYMENT",
            "CONFIRMED",
            "CHECKED_IN",
            "CHECKED_OUT",
            "REJECTED",
            "PENDING_CANCELLATION",
            "CANCELLED",
          ),
          allowNull: false,
          defaultValue: "PENDING_CLERK_REVIEW",
        },
        actualCheckInTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        aadharFrontImageUrl: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        aadharBackImageUrl: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        calculatedAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true, // The backend service will calculate this
        },
        securityDeposit: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true, // Extracted from the Facility package
        },
        advanceAmountRequested: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true, // The Clerk will fill this in when they push to PENDING_ADVANCE_PAYMENT
        },
        razorpayPaymentIds: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: [], // Initialize as an empty array
        },
        remainingAmountPaid: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: 0.0,
        },
        advancePaymentMode: {
          type: DataTypes.ENUM("ONLINE", "CASH", "QR"),
          defaultValue: "ONLINE",
        },
        advanceCollectedBy: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        checkInPaymentMode: {
          type: DataTypes.ENUM("ONLINE", "CASH", "QR"),
          allowNull: true,
        },
        cashCollectedBy: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        paymentStatus: {
          type: DataTypes.ENUM("PENDING", "PARTIAL", "COMPLETED", "REFUNDED"),
          defaultValue: "PENDING",
        },
        refundAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: 0.0,
        },
        cancelledAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        cancellationReason: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "Booking",
        tableName: "bookings",
        timestamps: true,
      },
    );
  }

  static associate(models) {
    // A Booking belongs to a User and a Facility
    Booking.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Booking.belongsTo(models.Facility, {
      foreignKey: "facilityId",
      as: "facility",
    });

    Booking.belongsTo(models.User, {
      foreignKey: "cashCollectedBy",
      as: "cashVerifier",
    });

    Booking.hasOne(models.Invoice, {
      foreignKey: "bookingId",
      as: "invoice",
    });
  }
}
