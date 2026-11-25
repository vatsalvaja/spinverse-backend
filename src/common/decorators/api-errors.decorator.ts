import { HttpStatus, applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../dto/api-response.dto';

const DESCRIPTIONS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Validation failed',
  [HttpStatus.NOT_FOUND]: 'Resource not found',
  [HttpStatus.CONFLICT]: 'Conflicts with existing data',
  [HttpStatus.FORBIDDEN]: 'Action not allowed',
};

/** Documents error responses using the standard error envelope: `@ApiErrors(400, 404)`. */
export const ApiErrors = (...statuses: HttpStatus[]): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status] ?? 'Error',
        type: ApiErrorResponseDto,
      }),
    ),
  ) as MethodDecorator & ClassDecorator;
