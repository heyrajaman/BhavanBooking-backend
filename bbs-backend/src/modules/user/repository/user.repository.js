// bbs-backend/src/modules/user/repository/user.repository.js
import User from "../model/user.model.js";

export class UserRepository {
  async createUser(userData) {
    return await User.create(userData);
  }

  async findByMobile(mobile) {
    return await User.findOne({ where: { mobile } });
  }

  // NEW: Added method to find a user by their email
  async findByEmail(email) {
    return await User.findOne({ where: { email } });
  }

  async findById(id) {
    return await User.findByPk(id);
  }
}
