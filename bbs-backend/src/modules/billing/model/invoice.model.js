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
        bookingId: {
          type: DataTypes.UUID,
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
    Invoice.belongsTo(models.User, { foreignKey: "generatedBy", as: "clerk" });
    Invoice.belongsTo(models.User, { foreignKey: "approvedBy", as: "admin" });
  }
}
