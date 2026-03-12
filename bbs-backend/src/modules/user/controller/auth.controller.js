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

    return res.status(200).json({
      success: true,
      message: "User login successful",
      data: result, // This object now contains the specific userAccessToken
    });
  };
}
