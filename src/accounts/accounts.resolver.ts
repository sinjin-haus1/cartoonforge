import {
  Resolver,
  Query,
  Mutation,
  Args,
  Subscription,
  ID,
} from '@nestjs/graphql';
import { Account, Platform } from './account.entity';
import { AccountsService } from './accounts.service';
import { UseGuards } from '@nestjs/common';

@Resolver(() => Account)
export class AccountsResolver {
  constructor(private readonly accountsService: AccountsService) {}

  @Query(() => [Account])
  async accounts(
    @Args('userId', { nullable: true }) userId?: string,
  ): Promise<Account[]> {
    return this.accountsService.findAll(userId);
  }

  @Query(() => Account)
  async account(@Args('id', { type: () => ID }) id: string): Promise<Account> {
    return this.accountsService.findOne(id);
  }

  @Mutation(() => Account)
  async createAccount(@Args('input') input: CreateAccountInput): Promise<Account> {
    return this.accountsService.create(input);
  }

  @Mutation(() => Account)
  async updateAccount(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAccountInput,
  ): Promise<Account> {
    return this.accountsService.update(id, input);
  }

  @Mutation(() => Boolean)
  async deleteAccount(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.accountsService.remove(id);
  }
}

@ArgsType()
class CreateAccountInput {
  @Field()
  userId: string;

  @Field(() => Platform)
  platform: Platform;

  @Field()
  accessToken: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field({ nullable: true })
  expiresAt?: Date;
}

@ArgsType()
class UpdateAccountInput {
  @Field({ nullable: true })
  accessToken?: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field({ nullable: true })
  expiresAt?: Date;
}
