import { ApiErrorResponse, ApiSuccessResponse } from '../interfaces/api-response.interface';

export function buildSuccessResponse<T>(params: {
  data: T;
  message: string;
  statusCode: number;
  path: string;
}): ApiSuccessResponse<T> {
  return {
    success: true,
    statusCode: params.statusCode,
    message: params.message,
    data: params.data,
    timestamp: new Date().toISOString(),
    path: params.path,
  };
}

export function buildErrorResponse(params: {
  message: string;
  statusCode: number;
  path: string;
  errors?: string[];
}): ApiErrorResponse {
  return {
    success: false,
    statusCode: params.statusCode,
    message: params.message,
    ...(params.errors?.length ? { errors: params.errors } : {}),
    timestamp: new Date().toISOString(),
    path: params.path,
  };
}
