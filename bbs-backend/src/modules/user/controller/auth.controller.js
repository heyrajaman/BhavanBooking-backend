// bbs-backend/src/modules/user/controller/auth.controller.js
import { AuthService } from "../service/auth.service.js";

export class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  registerUser = async (req, res, next) => {
    // The DTO validation middleware will ensure req.body is already clean before hitting this point
    const userData = req.body;

    const newUser = await this.authService.registerUser(userData);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser,
    });
  };

  loginUser = async (req, res, next) => {
    const { mobile, password } = req.body;

    const result = await this.authService.loginUser(mobile, password);
    const { userAccessToken, user } = result;

    res.cookie("jwt", userAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "User login successful",
      data: { user },
    });
  };

  logoutUser = async (req, res, next) => {
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  };

  getMyProfile = async (req, res, next) => {
    const profile = await this.authService.getProfile(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: {
        user: profile,
      },
    });
  };

  updateMyPassword = async (req, res, next) => {
    const { oldPassword, newPassword } = req.body;

    await this.authService.changePassword(
      req.user.id,
      oldPassword,
      newPassword,
    );

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  };
}
