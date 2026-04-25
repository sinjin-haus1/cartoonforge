import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from './account.entity';
import { AccountsService } from './accounts.service';
import { AccountsResolver } from './accounts.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Account.name, schema: AccountSchema }]),
  ],
  providers: [AccountsService, AccountsResolver],
  exports: [AccountsService],
})
export class AccountsModule {}
