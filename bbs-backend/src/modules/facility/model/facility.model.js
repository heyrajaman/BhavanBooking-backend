import { Model, DataTypes } from "sequelize";

export default class Facility extends Model {
  static initModel(sequelize) {
    Facility.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        images: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: [],
        },
        facilityType: {
          // Added 'PACKAGE' and 'ITEM' to cover the Complete Bhavan and Mattress/Extra Bed
          type: DataTypes.ENUM(
            "COMPLEX",
            "HALL",
            "ROOM",
            "LAWN",
            "PACKAGE",
            "ITEM",
          ),
          allowNull: false,
          defaultValue: "HALL",
        },
        parentFacilityId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: "facilities",
            key: "id",
          },
        },
        pricingType: {
          // Determines how the backend calculates the bill
          type: DataTypes.ENUM("TIERED", "SLOT", "HOURLY", "FIXED", "PER_ITEM"),
          allowNull: false,
          defaultValue: "FIXED",
        },
        baseRate: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
        pricingDetails: {
          type: DataTypes.JSON,
          allowNull: true,
          // Example: { "1_day": 130000, "2_days": 230000, "3_days": 310000 }
        },
        securityDeposit: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.0, // ₹25,000 for big packages, ₹0 for mattresses
        },
        maxCapacity: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        inventoryCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
      },
      {
        sequelize,
        modelName: "Facility",
        tableName: "facilities",
        timestamps: true,
      },
    );
  }

  static associate(models) {
    // Self-referencing association for hierarchy
    Facility.belongsTo(models.Facility, {
      as: "parentFacility",
      foreignKey: "parentFacilityId",
    });
    Facility.hasMany(models.Facility, {
      as: "childFacilities",
      foreignKey: "parentFacilityId",
    });

    // Many-to-Many with Booking
    Facility.hasMany(models.Booking, {
      foreignKey: "facilityId",
      as: "bookings",
    });
  }
}
