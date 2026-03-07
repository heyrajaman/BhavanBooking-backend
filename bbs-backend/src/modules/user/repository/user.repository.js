import User from "../model/user.model.js";

export class UserRepository {
  async findByMobile(mobile) {
    return await User.findOne({ where: { mobile } });
  }

  async createUser(userData) {
    return await User.create(userData);
  }
}
