import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from './proxy/proxy.service';

@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private proxyService: ProxyService,
  ) {}

  getStatus() {
    return {
      service: 'api-gateway',
      status: 'running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV', 'development'),
    };
  }

  async checkServicesHealth() {
    const services = ['auth', 'chat', 'websocket'];
    const healthChecks = await Promise.allSettled(
      services.map(async (service) => {
        try {
          const response = await this.proxyService.forwardRequest(
            service,
            'GET',
            '/health'
          );
          return {
            service,
            status: 'healthy',
            response: response.data,
          };
        } catch (error) {
          return {
            service,
            status: 'unhealthy',
            error: error.message,
          };
        }
      })
    );

    return healthChecks.map((result, index) => ({
      service: services[index],
      ...(result.status === 'fulfilled' ? result.value : result.reason),
    }));
  }
}