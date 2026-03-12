// bbs-backend/src/modules/user/dto/user.auth.dto.js

const mobileRegex = /^[0-9]{10}$/;

// 8-16 chars, at least one uppercase, one lowercase, one number, one special character.
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class UserRegisterDto {
  constructor(data) {
    this.fullName = data?.fullName;
    this.mobile = data?.mobile;
    this.password = data?.password;

    const rawEmail = data?.email;
    this.email = rawEmail === "" ? null : (rawEmail ?? null);
  }

  isValid() {
    if (!this.fullName || !this.mobile || !this.password) {
      throw new Error("Full name, mobile, and password are required.");
    }

    if (typeof this.fullName !== "string" || this.fullName.trim().length < 3) {
      throw new Error("Full name must be at least 3 characters long.");
    }

    if (!mobileRegex.test(this.mobile)) {
      throw new Error("Mobile number must be exactly 10 digits.");
    }

    if (!passwordRegex.test(this.password)) {
      throw new Error(
        "Password must be 8-16 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      );
    }

    if (this.email !== null && this.email !== undefined) {
      if (typeof this.email !== "string" || !emailRegex.test(this.email)) {
        throw new Error(
          "Please provide a valid email address format (e.g., example@domain.com).",
        );
      }
    }

    return true;
  }
}

export class UserLoginDto {
  constructor(data) {
    this.mobile = data?.mobile;
    this.password = data?.password;
  }

  isValid() {
    if (!this.mobile || !this.password) {
      throw new Error("Mobile and password are required.");
    }

    if (!mobileRegex.test(this.mobile)) {
      throw new Error("Mobile number must be exactly 10 digits.");
    }

    return true;
  }
}
