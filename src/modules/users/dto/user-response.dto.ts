import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum';

export class UserResponseDto {
  @ApiProperty({ example: '0b6d1c1e-5c1f-4d5b-9f55-1c6f3c0a8a11' })
  id: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ nullable: true, example: null, description: 'For a CLIENT: the id of the MASTER that owns the account. Null for every other role.' })
  parentId: string | null;

  @ApiProperty({ nullable: true, example: null, description: 'Set only for deleted accounts (which are never listed)' })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
