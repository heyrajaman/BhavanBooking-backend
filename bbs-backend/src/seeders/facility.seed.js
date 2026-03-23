// src/seeders/facility.seed.js
import Facility from "../modules/facility/model/facility.model.js";
import sequelize from "../config/database.js";
import { uploadSeedImageToMinio } from "../utils/minioUpload.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Helper to handle __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the absolute path to your new uploads folder
const SEED_IMAGES_DIR = path.join(__dirname, "../uploads/seed-images");

const facilityData = [
  // ==========================================
  // 1. ATOMIC / INDIVIDUAL FACILITIES (Checkboxes)
  // ==========================================
  {
    name: "Big Hall",
    description: "Spacious main hall for large gatherings.",
    facilityType: "HALL",
    pricingType: "FIXED",
    baseRate: 25000.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 10000.0,
    imageFiles: ["big_hall_1.jpeg", "big_hall_2.jpeg"],
  },
  {
    name: "Dining Hall",
    description: "Dedicated dining area for food arrangements.",
    facilityType: "HALL",
    pricingType: "FIXED",
    baseRate: 15000.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 5000.0,
    imageFiles: ["dining_hall_1.jpeg"],
  },
  {
    name: "Mini Hall (Capacity 75)",
    description:
      "Evening slot (6:00 PM – 11:00 PM). Extra hours billed at ₹3000/hr.",
    facilityType: "HALL",
    pricingType: "HOURLY",
    baseRate: 12000.0,
    pricingDetails: { base_hours: 5, extra_hour_rate: 3000, is_atomic: true },
    securityDeposit: 25000.0,
    imageFiles: ["mini_hall_1.jpeg", "mini_hall_2.jpeg"],
  },
  {
    name: "Stage",
    description: "Elevated stage setup for performances or main events.",
    facilityType: "ITEM",
    pricingType: "FIXED",
    baseRate: 5000.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 0.0,
    imageFiles: ["mini_hall_1.jpeg", "mini_hall_2.jpeg"],
  },
  {
    name: "Kitchen",
    description: "Commercial kitchen access for catering preparations.",
    facilityType: "ITEM",
    pricingType: "FIXED",
    baseRate: 8000.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 5000.0,
    imageFiles: ["mini_hall_1.jpeg", "mini_hall_2.jpeg"],
  },
  {
    name: "Lawn",
    description: "Open outdoor lawn space.",
    facilityType: "LAWN",
    pricingType: "FIXED",
    baseRate: 15000.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 5000.0,
    imageFiles: ["lawn_image_1.jpeg"],
  },
  {
    name: "Parking",
    description: "Dedicated parking space access.",
    facilityType: "ITEM",
    pricingType: "FIXED",
    baseRate: 3000.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 0.0,
    imageFiles: ["lawn_image_1.jpeg"],
  },
  {
    name: "Day Room (4 Bedded)",
    description: "10:00 AM – Next Day 8:00 AM. 4 Bedded room.",
    facilityType: "ROOM",
    pricingType: "FIXED",
    baseRate: 2500.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 0.0,
    imageFiles: ["four_bedroom_1.jpeg", "four_bedroom_2.jpeg"],
  },
  {
    name: "Day Room (Double Bed)",
    description: "10:00 AM – Next Day 8:00 AM. Double Bed room.",
    facilityType: "ROOM",
    pricingType: "FIXED",
    baseRate: 1800.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 0.0,
    imageFiles: ["double_bedroom_1.jpeg"],
  },
  {
    name: "Extra Mattress",
    description: "Extra mattress per piece",
    facilityType: "ITEM",
    pricingType: "PER_ITEM",
    baseRate: 600.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 0.0,
    imageFiles: ["four_bedroom_1.jpeg", "four_bedroom_2.jpeg"],
  },
  {
    name: "Dormitory (15 persons)",
    description: "Single dormitory accommodating up to 15 persons.",
    facilityType: "ROOM",
    pricingType: "FIXED",
    baseRate: 8000.0,
    pricingDetails: { is_atomic: true },
    securityDeposit: 0.0,
    imageFiles: ["four_bedroom_1.jpeg", "four_bedroom_2.jpeg"],
  },

  // ==========================================
  // 2. PACKAGES (Mapped to Atomic Facilities to prevent double-booking)
  // ==========================================
  {
    name: "Complete Maharashtra Bhavan",
    description: "Hall, Dining Hall, Stage, Kitchen, Lawn, 12-rooms",
    facilityType: "COMPLEX",
    pricingType: "TIERED",
    baseRate: 130000.0,
    pricingDetails: {
      "1_day": 130000,
      "2_days": 230000,
      "3_days": 310000,
      included_facilities: [
        "Big Hall",
        "Dining Hall",
        "Stage",
        "Kitchen",
        "Lawn",
        "Parking",
        "Standard Room",
        "Day Room (4 Bedded)",
        "Day Room (Double Bed)",
      ],
    },
    securityDeposit: 25000.0,
    imageFiles: [
      "main_bhavan.jpeg",
      "big_hall_1.jpeg",
      "big_hall_2.jpeg",
      "dining_hall_1.jpeg",
      "double_bedroom_1.jpeg",
      "lawn_image_1.jpeg",
      "four_bedroom_1.jpeg",
      "four_bedroom_2.jpeg",
    ],
  },
  {
    name: "Main Hall + Stage + 2 Rooms + Dining Hall + Kitchen + Parking (Full Day)",
    description: "Full day access to the main event spaces.",
    facilityType: "PACKAGE",
    pricingType: "FIXED",
    baseRate: 60000.0,
    pricingDetails: {
      included_facilities: [
        "Big Hall",
        "Stage",
        "Standard Room",
        "Dining Hall",
        "Kitchen",
        "Parking",
      ],
    },
    securityDeposit: 25000.0,
    imageFiles: [
      "big_hall_1.jpeg",
      "big_hall_2.jpeg",
      "mini_hall_1.jpeg",
      "dining_hall_1.jpeg",
      "double_bedroom_1.jpeg",
    ],
  },
  {
    name: "Main Hall + Stage + 2 Rooms (6 hours)",
    description: "For meetings / social / cultural events. Maximum 6 hours.",
    facilityType: "PACKAGE",
    pricingType: "SLOT",
    baseRate: 35000.0,
    pricingDetails: {
      duration_hours: 6,
      included_facilities: ["Big Hall", "Stage", "Standard Room"],
    },
    securityDeposit: 25000.0,
    imageFiles: [
      "big_hall_1.jpeg",
      "big_hall_2.jpeg",
      "four_bedroom_1.jpeg",
      "mini_hall_1.jpeg",
      "four_bedroom_2.jpeg",
    ],
  },
  {
    name: "Dining Hall + Kitchen + Parking (for 75 persons)",
    description: `Half Day (8:00 AM – 4:00 PM OR 4:00 PM – 11:00 PM) or Full Day.
      Half day = ₹25000 
      Full day = ₹40000`,
    facilityType: "PACKAGE",
    pricingType: "SLOT",
    baseRate: 25000.0,
    pricingDetails: {
      half_day: 25000,
      full_day: 40000,
      included_facilities: ["Dining Hall", "Kitchen", "Parking"],
    },
    securityDeposit: 25000.0,
    imageFiles: ["dining_hall_1.jpeg"],
  },
  {
    name: "Lawn + Kitchen + Parking",
    description: "Outdoor event space.",
    facilityType: "PACKAGE",
    pricingType: "FIXED",
    baseRate: 40000.0,
    pricingDetails: {
      included_facilities: ["Lawn", "Kitchen", "Parking"],
    },
    securityDeposit: 25000.0,
    imageFiles: ["lawn_image_1.jpeg"],
  },
  {
    name: "2 Dormitories",
    description: "Two dormitories acting as one large hall.",
    facilityType: "PACKAGE",
    pricingType: "FIXED",
    baseRate: 18000.0,
    pricingDetails: {
      included_facilities: ["Dormitory (15 persons)"],
    },
    securityDeposit: 0.0,
    imageFiles: ["four_bedroom_1.jpeg", "four_bedroom_2.jpeg"],
  },
];

const seedFacilities = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log("Database connected & synced for Facility seeding...");

    await Facility.destroy({ where: {} });

    for (let facility of facilityData) {
      const uploadedUrls = [];

      if (facility.imageFiles && facility.imageFiles.length > 0) {
        for (let fileName of facility.imageFiles) {
          // Construct the full path to the file in uploads/seed-images
          const localPath = path.join(SEED_IMAGES_DIR, fileName);

          if (fs.existsSync(localPath)) {
            const uniqueName = `${facility.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}${path.extname(fileName)}`;
            const url = await uploadSeedImageToMinio(localPath, uniqueName);
            uploadedUrls.push(url);
          } else {
            console.warn(`⚠️ File not found: ${localPath}`);
          }
        }
      }

      facility.images = uploadedUrls;
      delete facility.imageFiles;
    }

    await Facility.bulkCreate(facilityData);

    console.log(
      "✅ All updated Booking Packages & Facilities seeded successfully!",
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding facilities:", error);
    process.exit(1);
  }
};

seedFacilities();
