import { ServiceStatus } from '../constants/health.constants';

export interface HealthStatus {
  status: ServiceStatus.Ok;
  environment: string;
  uptimeSeconds: number;
  checks: {
    database: ServiceStatus.Up;
  };
}
