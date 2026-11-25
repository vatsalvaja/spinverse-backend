/** Envelope returned by every successful endpoint. */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

/** Envelope returned by every failed request. */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  /** Field-level details (e.g. validation messages), when available. */
  errors?: string[];
  timestamp: string;
  path: string;
}
