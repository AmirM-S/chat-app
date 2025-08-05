import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

export const RateLimitByIP = (maxRequests: number, windowMs: number) =>
  RateLimit({ maxRequests, windowMs });

export const RateLimitByUser = (maxRequests: number, windowMs: number) =>
  RateLimit({ maxRequests, windowMs });

export const RateLimitByEndpoint = (
  maxRequests: number,
  windowMs: number,
  options?: Partial<RateLimitOptions>
) => RateLimit({ maxRequests, windowMs, ...options }); 