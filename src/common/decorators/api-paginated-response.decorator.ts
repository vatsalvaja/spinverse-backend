import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponseDto } from '../dto/api-response.dto';
import { PaginationMetaDto } from '../dto/pagination-meta.dto';

/** Documents a list endpoint as `data: { items: Model[], meta }` inside the success envelope. */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description = 'Paginated list',
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto, PaginationMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              data: {
                type: 'object',
                properties: {
                  items: { type: 'array', items: { $ref: getSchemaPath(model) } },
                  meta: { $ref: getSchemaPath(PaginationMetaDto) },
                },
              },
            },
          },
        ],
      },
    }),
  ) as MethodDecorator;
