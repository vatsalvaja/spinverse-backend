import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RollbackDto {
  @ApiProperty({ description: 'Id of a previously installed package version to switch back to' })
  @IsUUID()
  versionId: string;
}
