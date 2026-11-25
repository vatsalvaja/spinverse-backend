import { ApiProperty } from '@nestjs/swagger';

export class GameCategoryResponseDto {
  @ApiProperty({ example: '0b6d1c1e-5c1f-4d5b-9f55-1c6f3c0a8a11' })
  id: string;

  @ApiProperty({ example: 'Hold & Respin' })
  name: string;

  @ApiProperty({ example: 'hold-respin' })
  slug: string;

  @ApiProperty({ type: String, nullable: true, example: 'Lock orbs and respin for bigger prizes' })
  description: string | null;

  @ApiProperty({ example: 2 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
