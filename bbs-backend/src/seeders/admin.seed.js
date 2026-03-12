// src/seeders/admin.seed.js
import bcrypt from "bcrypt";
import User from "../modules/user/model/user.model.js";
import sequelize from "../config/database.js";

const seedAdmin = async () => {
  try {
    // Connect to the database
    await sequelize.authenticate();
    console.log("Database connected for seeding...");

    // Check if an admin already exists to avoid duplicates
    const existingAdmin = await User.findOne({ where: { role: "ADMIN" } });
    if (existingAdmin) {
      console.log("An Admin already exists. Skipping seed.");
      process.exit(0);
    }

    // Create a password that passes your DTO regex (8-16 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
    const plainTextPassword = "SuperAdmin@123";
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    // Create the admin user
    await User.create({
      fullName: "System Admin",
      mobile: "9999999999",
      email: "admin@bhavanbooking.com",
      passwordHash: hashedPassword,
      role: "ADMIN",
    });

    console.log("✅ Admin seeded successfully!");
    console.log("📱 Mobile: 9999999999");
    console.log("🔑 Password: SuperAdmin@123");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
