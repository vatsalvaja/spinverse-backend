import { HttpStatus, Type, applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiResponseDto } from '../dto/api-response.dto';

/** Documents an endpoint as returning the success envelope wrapping `model`. */
export const ApiSuccessResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description = 'Successful response',
  status: HttpStatus.OK | HttpStatus.CREATED = HttpStatus.OK,
): MethodDecorator => {
  const respond = status === HttpStatus.CREATED ? ApiCreatedResponse : ApiOkResponse;
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    respond({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          { properties: { data: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  ) as MethodDecorator;
};
