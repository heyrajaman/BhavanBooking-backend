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
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        facilityType: {
          type: DataTypes.ENUM("COMPLEX", "HALL", "ROOM", "LAWN"),
          allowNull: false,
        },
        parentFacilityId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: "facilities",
            key: "id",
          },
        },
        baseRatePerDay: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
        maxCapacity: {
          type: DataTypes.INTEGER,
          allowNull: true, // e.g., 6 for rooms [cite: 116, 144]
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
    Facility.belongsToMany(models.Booking, {
      through: models.BookingFacility,
      foreignKey: "facilityId",
      as: "bookings",
    });
  }
}
