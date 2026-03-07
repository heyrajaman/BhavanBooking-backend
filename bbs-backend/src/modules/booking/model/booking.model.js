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
        bookingReference: {
          type: DataTypes.STRING(20),
          allowNull: false,
          unique: true,
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        eventType: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        startDatetime: {
          type: DataTypes.DATE,
          allowNull: false, // Standard 10:00 AM [cite: 77, 144]
        },
        endDatetime: {
          type: DataTypes.DATE,
          allowNull: false, // Standard 8:00 AM next day [cite: 77, 144]
        },
        status: {
          type: DataTypes.ENUM(
            "INQUIRY",
            "HOLD",
            "CONFIRMED",
            "CHECKED_IN",
            "CHECKED_OUT",
            "CANCELLED",
          ),
          defaultValue: "INQUIRY",
          allowNull: false,
        },
        guestCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        isVegetarianOnly: {
          type: DataTypes.BOOLEAN,
          defaultValue: true, // Enforcing BR-01
        },
        isDjProhibited: {
          type: DataTypes.BOOLEAN,
          defaultValue: true, // Enforcing BR-22 [cite: 125, 144]
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
    Booking.belongsTo(models.User, { foreignKey: "userId", as: "user" });

    // Many-to-Many with Facility
    Booking.belongsToMany(models.Facility, {
      through: models.BookingFacility,
      foreignKey: "bookingId",
      as: "facilities",
    });

    // One-to-One with Invoice (Billing Module)
    Booking.hasOne(models.Invoice, { foreignKey: "bookingId", as: "invoice" });
  }
}
