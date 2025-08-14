import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly services: Record<string, string>;

  constructor(private configService: ConfigService) {
    this.services = {
      auth: this.configService.get('AUTH_SERVICE_URL', 'http://localhost:3001'),
      chat: this.configService.get('CHAT_SERVICE_URL', 'http://localhost:3002'),
      websocket: this.configService.get('WEBSOCKET_SERVICE_URL', 'http://localhost:3003'),
    };
  }

  async forwardRequest(
    service: string,
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<AxiosResponse> {
    const serviceUrl = this.services[service];
    if (!serviceUrl) {
      throw new HttpException(
        `Service '${service}' not found`,
        HttpStatus.NOT_FOUND
      );
    }

    const requestUrl = `${serviceUrl}${path}`;
    this.logger.log(`Forwarding ${method} request to: ${requestUrl}`);

    try {
      const response = await axios({
        method: method as any,
        url: requestUrl,
        data,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: 10000, // 10 second timeout
      });

      this.logger.log(
        `Request to ${service} successful: ${response.status}`
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Request to ${service} failed:`,
        error.response?.data || error.message
      );

      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status
        );
      }

      /// Service unavailable
      throw new HttpException(
        `${service} service is currently unavailable`,
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /// Circuit breaker pattern - simple implementation
  private serviceHealth = new Map<string, { failures: number; lastFailure: Date | null }>();

  async forwardRequestWithCircuitBreaker(
    service: string,
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<AxiosResponse> {
    const health = this.serviceHealth.get(service) || { failures: 0, lastFailure: null };

    // Circuit breaker: if service has failed 3 times in last 5 minutes, do not try to forward the request
    if (health.failures >= 3 && health.lastFailure) {
      const timeSinceLastFailure = Date.now() - health.lastFailure.getTime();
      if (timeSinceLastFailure < 5 * 60 * 1000) { // 5 minutes
        throw new HttpException(
          `${service} Service is currently unavailable (circuit breaker open)`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    }

    try {
      const response = await this.forwardRequest(service, method, path, data, headers);
      
      // Reset failure count on successful request
      this.serviceHealth.set(service, { failures: 0, lastFailure: null });
      
      return response;
    } catch (error) {
      // Increment failure count
      health.failures++;
      health.lastFailure = new Date();
      this.serviceHealth.set(service, health);
      
      throw error;
    }
  }
}