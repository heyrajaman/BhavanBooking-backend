// bbs-backend/src/modules/user/service/auth.service.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRepository } from "../repository/user.repository.js";
import { AppError } from "../../../utils/AppError.js";
import User from "../model/user.model.js";

export class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  async registerUser(data) {
    // 1. Check if user already exists by mobile
    const existingMobileUser = await this.userRepository.findByMobile(
      data.mobile,
    );
    if (existingMobileUser) {
      throw new AppError("A user with this mobile number already exists.", 400);
    }

    // Check if email is provided and already exists
    if (data.email) {
      const existingEmailUser = await this.userRepository.findByEmail(
        data.email,
      );
      if (existingEmailUser) {
        throw new AppError("A user with this email already exists.", 400);
      }
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Create the user, explicitly enforcing the 'USER' role
    const newUser = await this.userRepository.createUser({
      fullName: data.fullName,
      mobile: data.mobile,
      email: data.email,
      passwordHash: hashedPassword,
      role: "USER",
    });

    return {
      id: newUser.id,
      fullName: newUser.fullName,
      role: newUser.role,
    };
  }

  async loginUser(mobile, plainTextPassword) {
    // 1. Find the user by mobile number
    const user = await this.userRepository.findByMobile(mobile);
    if (!user) {
      throw new AppError("Invalid mobile number or password.", 401);
    }

    // 2. Restrict this login portal to ONLY 'USER' roles
    if (user.role !== "USER") {
      throw new AppError(
        "Access denied. Please use the correct login portal.",
        403,
      );
    }

    // 3. Verify the password
    const isPasswordValid = await bcrypt.compare(
      plainTextPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new AppError("Invalid mobile number or password.", 401);
    }

    // 4. Generate the specific User JWT
    const payload = {
      id: user.id,
      role: user.role,
    };

    const userAccessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
      },
      userAccessToken, // Distinct token name for the User portal
    };
  }

  async getProfile(userId) {
    const user = await User.findByPk(userId, {
      // Security: Never send the password hash back to the frontend
      attributes: { exclude: ["passwordHash"] },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  /**
   * Handle the password change logic securely
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // 1. Verify the old password provided by the user
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Incorrect old password. Please try again.", 401);
    }

    // 2. Hash the new password before saving
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    await user.save();

    return true; // Simple success boolean
  }
}
