// src/modules/admin/service/admin.auth.service.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserService } from "../../user/service/user.service.js";
import { AppError } from "../../../utils/AppError.js";

export class AdminAuthService {
  constructor() {
    this.userService = new UserService();
  }

  async loginAdmin(mobile, plainTextPassword) {
    const user = await this.userService.findByMobile(mobile);

    // Strictly restrict to ADMIN role
    if (!user || user.role !== "ADMIN") {
      throw new AppError(
        "Invalid credentials or you do not have Admin access.",
        401,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      plainTextPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) throw new AppError("Invalid credentials.", 401);

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      },
    );

    return {
      user: { id: user.id, fullName: user.fullName, role: user.role },
      adminAccessToken: token, // Specifically named for Admin
    };
  }

  async loginClerk(mobile, plainTextPassword) {
    const user = await this.userService.findByMobile(mobile);

    // Strictly restrict to CLERK role
    if (!user || user.role !== "CLERK") {
      throw new AppError(
        "Invalid credentials or you do not have Clerk access.",
        401,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      plainTextPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) throw new AppError("Invalid credentials.", 401);

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      },
    );

    return {
      user: { id: user.id, fullName: user.fullName, role: user.role },
      clerkAccessToken: token, // Specifically named for Clerk
    };
  }

  async createClerk(data) {
    const existingMobileUser = await this.userService.findByMobile(data.mobile);
    if (existingMobileUser)
      throw new AppError(
        "An account with this mobile number already exists.",
        400,
      );

    if (data.email) {
      const existingEmailUser = await this.userService.findByEmail(data.email);
      if (existingEmailUser)
        throw new AppError("An account with this email already exists.", 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newClerk = await this.userService.createUser({
      fullName: data.fullName,
      mobile: data.mobile,
      email: data.email,
      passwordHash: hashedPassword,
      role: "CLERK",
    });

    return {
      id: newClerk.id,
      fullName: newClerk.fullName,
      role: newClerk.role,
    };
  }
}
