// src/modules/admin/dto/admin.auth.dto.js

export class AdminLoginDto {
  constructor(data) {
    this.mobile = data.mobile;
    this.password = data.password;
  }

  isValid() {
    if (!this.mobile || !this.password) {
      throw new Error("Mobile and password are required.");
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(this.mobile)) {
      throw new Error("Mobile number must be exactly 10 digits.");
    }

    return true;
  }
}

export class CreateClerkDto {
  constructor(data) {
    this.fullName = data.fullName;
    this.mobile = data.mobile;
    this.password = data.password;
    this.email = data.email;
  }

  isValid() {
    if (!this.fullName || !this.mobile || !this.password) {
      throw new Error("FullName, mobile, and password are required.");
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(this.mobile)) {
      throw new Error("Mobile number must be exactly 10 digits.");
    }

    // Enforces 8-16 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
    if (!passwordRegex.test(this.password)) {
      throw new Error(
        "Password must be 8-16 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      );
    }

    if (this.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        throw new Error("Please provide a valid email address.");
      }
    }

    return true;
  }
}
