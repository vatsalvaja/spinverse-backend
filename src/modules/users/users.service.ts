import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { NO_FIELDS_TO_UPDATE } from '../../common/constants/validation.constants';
import { SortOrder } from '../../common/enums/sort-order.enum';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { hasDefinedValues } from '../../common/utils/object.util';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { USER_ERRORS } from './constants/users.constants';
import { UserSortField } from './enums/user-sort-field.enum';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateUserData, SafeUser } from './interfaces/user.interface';
import { DemoWalletService } from '../demo-wallet/demo-wallet.service';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly walletService: DemoWalletService,
  ) {}

  // --- Used by authentication ------------------------------------------------

  findById(id: string): Promise<SafeUser | null> {
    return this.usersRepository.findById(id);
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailWithPassword(email);
  }

  /** Creates a user; throws 409 when the e-mail is already registered. */
  async create(data: CreateUserData): Promise<SafeUser> {
    if (await this.usersRepository.existsByEmail(data.email)) {
      throw new ConflictException(USER_ERRORS.EMAIL_TAKEN);
    }
    // A concurrent duplicate still hits the unique index; the global filter maps it to 409.
    const user = await this.usersRepository.create(data);

    // Every new account gets its demo wallet (and initial credits) right away. This is best-effort: if it fails the
    // account is still created and the wallet is created on first use.
    try {
      await this.walletService.ensureWallet(user.id);
    } catch (error) {
      this.logger.warn(`Could not create the demo wallet for user ${user.id}: ${error instanceof Error ? error.message : error}`);
    }
    return user;
  }

  // --- Used by administration views ------------------------------------------

  /** Labels (id, name, e-mail) for a set of user ids. */
  findSummaries(ids: string[]): Promise<{ id: string; name: string; email: string }[]> {
    return this.usersRepository.findSummaries([...new Set(ids)]);
  }

  getCounts() {
    return this.usersRepository.getCounts();
  }

  registrationsByDay(range: { from?: Date; to?: Date }) {
    return this.usersRepository.registrationsByDay(range);
  }

  /** The newest accounts. */
  async listRecent(limit: number): Promise<SafeUser[]> {
    const { items } = await this.usersRepository.findMany({
      filter: {},
      sort: { field: UserSortField.CreatedAt, order: SortOrder.Desc },
      skip: 0,
      take: limit,
    });
    return items;
  }

  // --- Own profile -----------------------------------------------------------

  getProfile(userId: string): Promise<SafeUser> {
    return this.getByIdOrFail(userId);
  }

  /** Users can only change their display name; role, email and status are admin-managed. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    await this.getByIdOrFail(userId);
    return this.usersRepository.update(userId, { name: dto.name });
  }

  // --- Administration --------------------------------------------------------

  async list(query: ListUsersQueryDto): Promise<PaginatedResult<SafeUser>> {
    const { items, total } = await this.usersRepository.findMany({
      filter: { search: query.search, role: query.role, isActive: query.isActive },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  getById(id: string): Promise<SafeUser> {
    return this.getByIdOrFail(id);
  }

  /**
   * Admin edit of another account. An admin can never change their own role, so a
   * role change always targets a different account and at least one admin remains.
   */
  async adminUpdate(actor: SafeUser, id: string, dto: AdminUpdateUserDto): Promise<SafeUser> {
    if (!hasDefinedValues(dto)) throw new BadRequestException(NO_FIELDS_TO_UPDATE);

    const target = await this.getByIdOrFail(id);

    if (dto.role !== undefined && dto.role !== target.role && actor.id === target.id) {
      throw new ForbiddenException(USER_ERRORS.CANNOT_CHANGE_OWN_ROLE);
    }
    if (dto.email !== undefined && dto.email !== target.email) {
      if (await this.usersRepository.existsByEmailExcluding(dto.email, id)) {
        throw new ConflictException(USER_ERRORS.EMAIL_TAKEN);
      }
    }

    return this.usersRepository.update(id, {
      name: dto.name,
      email: dto.email,
      role: dto.role,
    });
  }

  /** Activates or deactivates an account. Admins cannot deactivate themselves. */
  async setActive(actor: SafeUser, id: string, isActive: boolean): Promise<SafeUser> {
    const target = await this.getByIdOrFail(id);

    if (!isActive && actor.id === target.id) {
      throw new ForbiddenException(USER_ERRORS.CANNOT_DEACTIVATE_SELF);
    }
    if (target.isActive === isActive) return target;

    return this.usersRepository.update(id, { isActive });
  }

  private async getByIdOrFail(id: string): Promise<SafeUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(USER_ERRORS.NOT_FOUND);
    return user;
  }
}
