// src/modules/admin/controller/admin.auth.controller.js
import { AdminAuthService } from "../service/admin.auth.service.js";

export class AdminAuthController {
  constructor() {
    this.adminAuthService = new AdminAuthService();
  }

  adminLogin = async (req, res, next) => {
    const { mobile, password } = req.body;
    const result = await this.adminAuthService.loginAdmin(mobile, password);

    const { adminAccessToken, user } = result;

    res.cookie("jwt", adminAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: { user },
    });
  };

  clerkLogin = async (req, res, next) => {
    const { mobile, password } = req.body;
    const result = await this.adminAuthService.loginClerk(mobile, password);

    const { clerkAccessToken, user } = result;

    res.cookie("jwt", clerkAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Clerk login successful",
      data: { user },
    });
  };

  logoutAdmin = async (req, res, next) => {
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
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
