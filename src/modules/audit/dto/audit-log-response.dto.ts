import { ApiProperty } from '@nestjs/swagger';

class AuditActorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class AuditLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'The administrator who acted' })
  actorId: string;

  @ApiProperty({ type: AuditActorDto })
  actor: AuditActorDto;

  @ApiProperty({ example: 'USER_DEACTIVATED' })
  action: string;

  @ApiProperty({ example: 'USER' })
  resourceType: string;

  @ApiProperty({ type: String, nullable: true })
  resourceId: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Route parameters, the sanitised body, a result summary and any error' })
  details: Record<string, unknown>;

  @ApiProperty({ description: 'false for a refused or failed attempt' })
  success: boolean;

  @ApiProperty({ type: String, nullable: true })
  ipAddress: string | null;

  @ApiProperty()
  createdAt: Date;
}
