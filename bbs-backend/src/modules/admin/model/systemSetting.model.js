// src/modules/admin/model/systemSetting.model.js
import { Model, DataTypes } from "sequelize";

export default class SystemSetting extends Model {
  static initModel(sequelize) {
    SystemSetting.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        cgstPercentage: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 2.5, // Default 2.5%
        },
        sgstPercentage: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 2.5, // Default 2.5%
        },
      },
      {
        sequelize,
        modelName: "SystemSetting",
        tableName: "system_settings",
        timestamps: true,
      },
    );
  }
}
