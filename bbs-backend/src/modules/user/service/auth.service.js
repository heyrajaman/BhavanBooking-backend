import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRepository } from "../repository/user.repository.js";
import { AppError } from "../../../utils/AppError.js";

export class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  async register(data) {
    // 1. Check if user already exists
    const existingUser = await this.userRepository.findByMobile(data.mobile);
    if (existingUser) {
      throw new AppError("A user with this mobile number already exists.", 400);
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Create the user
    const newUser = await this.userRepository.createUser({
      fullName: data.fullName,
      mobile: data.mobile,
      email: data.email,
      passwordHash: hashedPassword,
      role: data.role || "GUEST", // Default to GUEST if no role is provided
    });

    // We do not return the password hash to the controller!
    return {
      id: newUser.id,
      fullName: newUser.fullName,
      role: newUser.role,
    };
  }

  /**
   * Authenticates a user and returns a JWT.
   */
  async login(mobile, plainTextPassword) {
    // 1. Find the user by mobile number
    const user = await this.userRepository.findByMobile(mobile);
    if (!user) {
      throw new AppError("Invalid credentials.", 401);
    }

    // 2. Verify the password
    const isPasswordValid = await bcrypt.compare(
      plainTextPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials.", 401);
    }

    // 3. Generate the JWT (The VIP Wristband)
    // We embed the user ID and role directly into the token payload
    const payload = {
      id: user.id,
      role: user.role, // 'ADMIN', 'CLERK', or 'GUEST'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
      },
      token,
    };
  }
}
