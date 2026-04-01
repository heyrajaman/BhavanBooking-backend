import { UserRepository } from "../repository/user.repository.js";

export class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  async findById(id) {
    return await this.userRepository.findById(id);
  }

  async findByMobile(mobile) {
    return await this.userRepository.findByMobile(mobile);
  }

  async findByEmail(email) {
    return await this.userRepository.findByEmail(email);
  }

  async createUser(userData) {
    return await this.userRepository.createUser(userData);
  }
}
