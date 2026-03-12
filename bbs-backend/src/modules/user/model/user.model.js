// bbs-backend/src/modules/user/model/user.model.js
import { Model, DataTypes } from "sequelize";

export default class User extends Model {
  static initModel(sequelize) {
    User.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        fullName: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        mobile: {
          type: DataTypes.STRING(15),
          allowNull: false,
          unique: true,
        },
        email: {
          type: DataTypes.STRING(100),
          allowNull: true,
          unique: true,
        },
        passwordHash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        role: {
          type: DataTypes.ENUM("ADMIN", "CLERK", "USER"),
          allowNull: false,
          defaultValue: "USER",
        },
        aadhaarNumber: {
          type: DataTypes.STRING(12),
          allowNull: true, // Optional during user signup, can be filled later
        },
        address: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "User",
        tableName: "users",
        timestamps: true,
      },
    );
  }

  static associate(models) {
    // A User can have many Bookings
    User.hasMany(models.Booking, { foreignKey: "userId", as: "bookings" });
  }
}
