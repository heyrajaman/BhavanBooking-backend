// src/modules/admin/controller/admin.auth.controller.js
import { AdminAuthService } from "../service/admin.auth.service.js";
import {
  sendLoginSuccess,
  sendLogoutSuccess,
} from "../../../utils/authUtils.js";

export class AdminAuthController {
  constructor() {
    this.adminAuthService = new AdminAuthService();
  }

  adminLogin = async (req, res, next) => {
    const { mobile, password } = req.body;
    const result = await this.adminAuthService.loginAdmin(mobile, password);

    const { adminAccessToken, user } = result;

    return sendLoginSuccess(res, {
      token: adminAccessToken,
      user,
      message: "Admin login successful",
    });
  };

  clerkLogin = async (req, res, next) => {
    const { mobile, password } = req.body;
    const result = await this.adminAuthService.loginClerk(mobile, password);

    const { clerkAccessToken, user } = result;

    return sendLoginSuccess(res, {
      token: clerkAccessToken,
      user,
      message: "Clerk login successful",
    });
  };

  logoutAdmin = async (req, res, next) => {
    return sendLogoutSuccess(res);
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
