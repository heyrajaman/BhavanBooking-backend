import { Sequelize } from "sequelize";
import dotenv from "dotenv";

import User from "../modules/user/model/user.model.js";
import Booking from "../modules/booking/model/booking.model.js";
import Facility from "../modules/facility/model/facility.model.js";

// Load environment variables (ensure this happens before using process.env)
dotenv.config({ quiet: true });

const enableSqlLogging = process.env.SEQUELIZE_LOG_SQL === "true";

// Initialize the Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: enableSqlLogging ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

// Initialize Sequelize model definitions
User.initModel(sequelize);
Booking.initModel(sequelize);
Facility.initModel(sequelize);

const models = {
  User,
  Booking,
  Facility,
};

// 3. Execute the associations (Foreign Keys & Relationships)
if (User.associate) User.associate(models);
if (Booking.associate) Booking.associate(models);
if (Facility.associate) Facility.associate(models);

export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("📦 Database connection established successfully.");

    // In development, you might use { alter: true } to sync models automatically.
    // In production, NEVER use sync(). Always use Sequelize Migrations.
    if (process.env.NODE_ENV === "development") {
      await sequelize.sync();
      console.log("🔄 Database models synchronized.");
    }
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
    process.exit(1); // Stop the Node process if the DB is down
  }
};

export default sequelize;
