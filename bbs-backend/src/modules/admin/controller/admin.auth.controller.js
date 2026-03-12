// src/modules/admin/controller/admin.auth.controller.js
import { AdminAuthService } from "../service/admin.auth.service.js";

export class AdminAuthController {
  constructor() {
    this.adminAuthService = new AdminAuthService();
  }

  adminLogin = async (req, res, next) => {
    const { mobile, password } = req.body;
    const result = await this.adminAuthService.loginAdmin(mobile, password);

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: result, // Returns adminAccessToken
    });
  };

  clerkLogin = async (req, res, next) => {
    const { mobile, password } = req.body;
    const result = await this.adminAuthService.loginClerk(mobile, password);

    return res.status(200).json({
      success: true,
      message: "Clerk login successful",
      data: result, // Returns clerkAccessToken
    });
  };

  createClerk = async (req, res, next) => {
    const clerkData = req.body;
    const newClerk = await this.adminAuthService.createClerk(clerkData);

    return res.status(201).json({
      success: true,
      message: "Clerk account created successfully",
      data: newClerk,
    });
  };
}
