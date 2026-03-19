// src/modules/billing/model/invoice.model.js
import { Model, DataTypes } from "sequelize";

export default class Invoice extends Model {
  static initModel(sequelize) {
    Invoice.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        invoiceNumber: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false, // e.g., 'INV-2026-0001'
        },
        bookingId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        userId: {
          type: DataTypes.UUID, // The customer being billed
          allowNull: false,
        },
        generatedBy: {
          type: DataTypes.UUID, // The Clerk who generated it
          allowNull: false,
        },
        approvedBy: {
          type: DataTypes.UUID, // The Admin who approves it
          allowNull: true,
        },

        // --- Customer Snapshot (Immutable for historical invoice accuracy) ---
        customerName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        customerEmail: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        customerPhone: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        billingAddress: {
          type: DataTypes.TEXT,
          allowNull: true,
        },

        // --- Dates ---
        invoiceDate: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        dueDate: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        // --- Base Pricing & Taxes ---
        baseAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        additionalItems: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        totalAdditionalAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        cgstAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        sgstAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        discountAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        totalAmount: {
          // Grand total including base + taxes - discount
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },

        // --- Post-Event Settlement Charges ---
        electricityUnitsConsumed: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        electricityCharges: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        cleaningCharges: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        generatorCharges: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        damagesAndPenalties: {
          type: DataTypes.JSON, // Store array of penalties: [{ reason: "Broken Chair", amount: 500 }]
          allowNull: true,
        },
        totalDeductions: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        securityDepositHeld: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        finalRefundAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },
        additionalBalanceDue: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0,
        },

        // --- Statuses ---
        paymentStatus: {
          type: DataTypes.ENUM(
            "PENDING",
            "PAID",
            "PARTIALLY_PAID",
            "CANCELLED",
            "REFUNDED",
          ),
          defaultValue: "PENDING",
        },
        approvalStatus: {
          type: DataTypes.ENUM(
            "PENDING_ADMIN_APPROVAL",
            "APPROVED",
            "REJECTED",
          ),
          defaultValue: "PENDING_ADMIN_APPROVAL",
        },
        adminRemarks: {
          type: DataTypes.TEXT, // If admin rejects, they can leave a note here
          allowNull: true,
        },
        adminSignatureUrl: {
          type: DataTypes.STRING,
          allowNull: true, // Attached automatically during the approval process
        },
        invoicePdfUrl: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "Invoice",
        tableName: "invoices",
        timestamps: true,
      },
    );
  }

  static associate(models) {
    Invoice.belongsTo(models.Booking, {
      foreignKey: "bookingId",
      as: "booking",
    });
    // Added association to easily fetch the billed customer
    Invoice.belongsTo(models.User, {
      foreignKey: "userId",
      as: "customer",
    });
    Invoice.belongsTo(models.User, {
      foreignKey: "generatedBy",
      as: "clerk",
    });
    Invoice.belongsTo(models.User, {
      foreignKey: "approvedBy",
      as: "admin",
    });
  }
}
