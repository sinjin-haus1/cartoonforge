import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, Platform } from './account.entity';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectModel(Account.name) private accountModel: Model<Account>,
  ) {}

  async create(data: {
    userId: string;
    platform: Platform;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<Account> {
    const account = new this.accountModel(data);
    return account.save();
  }

  async findAll(userId?: string): Promise<Account[]> {
    const filter = userId ? { userId } : {};
    return this.accountModel.find(filter).exec();
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accountModel.findById(id).exec();
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return account;
  }

  async findByUserAndPlatform(
    userId: string,
    platform: Platform,
  ): Promise<Account | null> {
    return this.accountModel.findOne({ userId, platform }).exec();
  }

  async update(
    id: string,
    data: Partial<{
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    }>,
  ): Promise<Account> {
    const account = await this.accountModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return account;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.accountModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return true;
  }

  async isTokenExpired(account: Account): Promise<boolean> {
    if (!account.expiresAt) return false;
    return new Date() >= new Date(account.expiresAt);
  }
}
