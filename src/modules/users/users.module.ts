import { Module } from '@nestjs/common';
import { DemoWalletModule } from '../demo-wallet/demo-wallet.module';
import { AdminUsersController } from './admin-users.controller';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [DemoWalletModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
