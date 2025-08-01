import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios'

@Injectable()
export class ProxyService {
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
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    try {
      const response = await axios({
        method: method as any,
        url: `${serviceUrl}${path}`,
        data,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: 10000, // 10 second timeout
      });
      return response;
    } catch (error) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status
        );
      }
      throw new HttpException(
        'Service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}