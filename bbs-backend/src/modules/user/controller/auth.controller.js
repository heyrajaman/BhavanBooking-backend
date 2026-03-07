import { AuthService } from "../service/auth.service.js";

export class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  register = async (req, res, next) => {
    // In a strict flow, you would validate this with a DTO first
    const userData = req.body;

    const newUser = await this.authService.register(userData);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser,
    });
  };

  login = async (req, res, next) => {
    const { mobile, password } = req.body;

    // Pass the raw data to the service
    const result = await this.authService.login(mobile, password);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  };
}
