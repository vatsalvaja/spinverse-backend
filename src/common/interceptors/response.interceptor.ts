import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { DEFAULT_SUCCESS_MESSAGE, RESPONSE_MESSAGE_KEY } from '../constants/api.constants';
import { ApiSuccessResponse } from '../interfaces/api-response.interface';
import { buildSuccessResponse } from '../utils/response.util';

/** Wraps every controller return value in the standard success envelope. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_SUCCESS_MESSAGE;

    return next.handle().pipe(
      map((data) =>
        buildSuccessResponse({
          data,
          message,
          statusCode: response.statusCode,
          path: request.originalUrl,
        }),
      ),
    );
  }
}
