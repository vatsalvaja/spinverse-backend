import { Module } from '@nestjs/common';
import { DemoWalletModule } from '../demo-wallet/demo-wallet.module';
import { PasswordService } from '../auth/password.service';
import { AdminUsersController } from './admin-users.controller';
import { HierarchyService } from './hierarchy.service';
import { MasterClientsController } from './master-clients.controller';
import { SuperAdminMastersController } from './super-admin-masters.controller';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [DemoWalletModule],
  controllers: [UsersController, AdminUsersController, SuperAdminMastersController, MasterClientsController],
  // PasswordService is stateless; the hierarchy service needs it to hash the passwords it sets for masters and clients.
  providers: [UsersService, UsersRepository, HierarchyService, PasswordService],
  exports: [UsersService],
})
export class UsersModule {}
