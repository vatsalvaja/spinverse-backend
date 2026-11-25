import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { DEFAULT_ERROR_MESSAGE, VALIDATION_ERROR_MESSAGE } from '../constants/api.constants';
import { buildErrorResponse } from '../utils/response.util';

interface NormalisedError {
  statusCode: number;
  message: string;
  errors?: string[];
}

/** Converts every thrown error into the standard error envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const error = this.normalise(exception);

    if (error.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${error.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response
      .status(error.statusCode)
      .json(buildErrorResponse({ ...error, path: request.originalUrl }));
  }

  private normalise(exception: unknown): NormalisedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }
    // Never leak internal error details to clients.
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: DEFAULT_ERROR_MESSAGE };
  }

  private fromHttpException(exception: HttpException): NormalisedError {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { statusCode, message: body };
    }

    const { message } = body as { message?: string | string[] };
    // ValidationPipe reports an array of field messages.
    if (Array.isArray(message)) {
      return { statusCode, message: VALIDATION_ERROR_MESSAGE, errors: message };
    }
    return { statusCode, message: message ?? exception.message };
  }

  private fromPrismaError(error: Prisma.PrismaClientKnownRequestError): NormalisedError {
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with these values already exists',
        };
      case 'P2025':
        return { statusCode: HttpStatus.NOT_FOUND, message: 'Record not found' };
      default:
        return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: DEFAULT_ERROR_MESSAGE };
    }
  }
}
