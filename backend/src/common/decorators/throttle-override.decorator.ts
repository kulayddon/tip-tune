import { SetMetadata } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

/**
 * Custom throttle decorator with named presets for common rate limit scenarios
 */

// Enhanced throttle configuration presets with route-type specificity
export const THROTTLE_PRESETS = {
  // Auth endpoints - very strict to prevent brute force
  AUTH_CHALLENGE: { limit: 5, ttl: 60000 }, // 5 requests per minute
  AUTH_VERIFY: { limit: 10, ttl: 60000 }, // 10 requests per minute
  AUTH_REFRESH: { limit: 20, ttl: 60000 }, // 20 requests per minute

  // High-risk write operations - strict limits
  TIP_SUBMISSION: { limit: 20, ttl: 60000 }, // 20 requests per minute (reduced from 30)
  FILE_UPLOAD: { limit: 3, ttl: 60000 }, // 3 requests per minute (reduced from 5)
  TRACK_CREATION: { limit: 5, ttl: 60000 }, // 5 requests per minute
  USER_CREATION: { limit: 10, ttl: 60000 }, // 10 requests per minute

  // Moderate-risk write operations
  COMMENT_CREATE: { limit: 30, ttl: 60000 }, // 30 requests per minute
  USER_UPDATE: { limit: 50, ttl: 60000 }, // 50 requests per minute
  TRACK_UPDATE: { limit: 30, ttl: 60000 }, // 30 requests per minute

  // Public read operations - more lenient
  PUBLIC_READ: { limit: 200, ttl: 60000 }, // 200 requests per minute
  SEARCH: { limit: 150, ttl: 60000 }, // 150 requests per minute (increased from 100)
  TRACK_STREAM: { limit: 300, ttl: 60000 }, // 300 requests per minute for streaming

  // Authenticated user operations - balanced
  AUTHENTICATED_READ: { limit: 400, ttl: 60000 }, // 400 requests per minute
  AUTHENTICATED_WRITE: { limit: 100, ttl: 60000 }, // 100 requests per minute

  // Admin operations - moderate limits
  ADMIN_READ: { limit: 500, ttl: 60000 }, // 500 requests per minute
  ADMIN_WRITE: { limit: 200, ttl: 60000 }, // 200 requests per minute

  // Legacy presets for backward compatibility
  PUBLIC: { limit: 60, ttl: 60000 }, // 60 requests per minute
  AUTHENTICATED: { limit: 300, ttl: 60000 }, // 300 requests per minute
  AUTH_ENDPOINTS: { limit: 10, ttl: 60000 }, // 10 requests per minute
  FILE_UPLOAD_LEGACY: { limit: 5, ttl: 60000 }, // 5 requests per minute
  STRICT: { limit: 5, ttl: 60000 }, // 5 requests per minute
  RELAXED: { limit: 1000, ttl: 60000 }, // 1000 requests per minute
} as const;

/**
 * Route type classification for rate limiting
 */
export enum RouteType {
  AUTH = "auth",
  HIGH_RISK_WRITE = "high_risk_write",
  MODERATE_WRITE = "moderate_write",
  PUBLIC_READ = "public_read",
  AUTHENTICATED_READ = "authenticated_read",
  AUTHENTICATED_WRITE = "authenticated_write",
  ADMIN_READ = "admin_read",
  ADMIN_WRITE = "admin_write",
}

/**
 * Route type metadata key
 */
export const ROUTE_TYPE_METADATA = "route:type";

/**
 * Apply route type classification for automatic rate limiting
 * This decorator works with the enhanced guard to apply appropriate limits
 *
 * @example
 * @RouteType(RouteType.HIGH_RISK_WRITE)
 * async createTip() { ... }
 */
export function RouteTypeDecorator(routeType: RouteType): MethodDecorator {
  return SetMetadata(ROUTE_TYPE_METADATA, routeType);
}

/**
 * Apply throttle override with preset configuration
 *
 * @example
 * @ThrottleOverride('AUTH_ENDPOINTS')
 * async login() { ... }
 *
 * @example
 * @ThrottleOverride('FILE_UPLOAD')
 * async uploadFile() { ... }
 */
export function ThrottleOverride(
  preset: keyof typeof THROTTLE_PRESETS,
): MethodDecorator {
  const config = THROTTLE_PRESETS[preset];
  return Throttle({ default: config });
}

/**
 * Apply custom throttle configuration
 *
 * @example
 * @CustomThrottle(50, 60000) // 50 requests per minute
 * async customEndpoint() { ... }
 */
export function CustomThrottle(limit: number, ttl: number): MethodDecorator {
  return Throttle({ default: { limit, ttl } });
}

/**
 * Skip throttling for specific endpoint
 *
 * @example
 * @SkipThrottle()
 * async healthCheck() { ... }
 */
export function SkipThrottle(): MethodDecorator {
  return Throttle({ default: { limit: 0, ttl: 0 } });
}

/**
 * Apply different throttle limits based on authentication status
 * This is a marker decorator - actual implementation in guard
 */
export const THROTTLE_AUTH_AWARE = "throttle:auth-aware";
export function ThrottleAuthAware(): MethodDecorator {
  return SetMetadata(THROTTLE_AUTH_AWARE, true);
}

/**
 * Get throttle preset by route type
 */
export function getThrottlePresetByRouteType(routeType: RouteType): {
  limit: number;
  ttl: number;
} {
  switch (routeType) {
    case RouteType.AUTH:
      return THROTTLE_PRESETS.AUTH_VERIFY;
    case RouteType.HIGH_RISK_WRITE:
      return THROTTLE_PRESETS.TIP_SUBMISSION;
    case RouteType.MODERATE_WRITE:
      return THROTTLE_PRESETS.COMMENT_CREATE;
    case RouteType.PUBLIC_READ:
      return THROTTLE_PRESETS.PUBLIC_READ;
    case RouteType.AUTHENTICATED_READ:
      return THROTTLE_PRESETS.AUTHENTICATED_READ;
    case RouteType.AUTHENTICATED_WRITE:
      return THROTTLE_PRESETS.AUTHENTICATED_WRITE;
    case RouteType.ADMIN_READ:
      return THROTTLE_PRESETS.ADMIN_READ;
    case RouteType.ADMIN_WRITE:
      return THROTTLE_PRESETS.ADMIN_WRITE;
    default:
      return THROTTLE_PRESETS.PUBLIC;
  }
}
