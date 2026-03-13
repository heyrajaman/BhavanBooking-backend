import { DataTypes } from "sequelize";
import sequelize from "../../../config/database.js";

const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    performedBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    previousState: {
      type: DataTypes.JSON, // Stores the booking before approval
      allowNull: true,
    },
    newState: {
      type: DataTypes.JSON, // Stores the booking after approval
      allowNull: true,
    },
  },
  {
    tableName: "audit_logs",
    timestamps: true,
  },
);

export default AuditLog;
