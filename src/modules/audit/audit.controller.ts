import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Role } from '../../common/enums/role.enum';
import { Auth } from '../auth/decorators/auth.decorator';
import { AuditService } from './audit.service';
import { AUDIT_API_TAG, AUDIT_MESSAGES, AUDIT_ROUTE } from './constants/audit.constants';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import type { AuditLogView } from './interfaces/audit.interface';

/**
 * Read-only access to the administrator audit log. The log can be read here and written only by the server
 * itself: there is no endpoint to edit or delete an entry.
 */
@ApiTags(AUDIT_API_TAG)
@Controller(AUDIT_ROUTE)
@Auth(Role.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ResponseMessage(AUDIT_MESSAGES.LISTED)
  @ApiOperation({
    summary: 'Administrator activity log (newest first)',
    description: 'Filter by administrator, action, resource, success/failure and date range.',
  })
  @ApiPaginatedResponse(AuditLogResponseDto, 'Paginated audit entries')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: ListAuditLogsQueryDto): Promise<PaginatedResult<AuditLogView>> {
    return this.auditService.list(query);
  }

  @Get(':id')
  @ResponseMessage(AUDIT_MESSAGES.FETCHED)
  @ApiOperation({ summary: 'One audit entry' })
  @ApiSuccessResponse(AuditLogResponseDto, 'The entry')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<AuditLogView> {
    return this.auditService.get(id);
  }
}
