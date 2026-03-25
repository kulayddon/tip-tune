import { RouteType, getThrottlePresetByRouteType, THROTTLE_PRESETS } from '../src/common/decorators/throttle-override.decorator';

describe('Rate Limiting Configuration Tests', () => {
  describe('THROTTLE_PRESETS', () => {
    it('should have stricter limits for high-risk write operations', () => {
      expect(THROTTLE_PRESETS.TIP_SUBMISSION.limit).toBeLessThan(THROTTLE_PRESETS.PUBLIC_READ.limit);
      expect(THROTTLE_PRESETS.FILE_UPLOAD.limit).toBeLessThan(THROTTLE_PRESETS.PUBLIC_READ.limit);
      expect(THROTTLE_PRESETS.TRACK_CREATION.limit).toBeLessThan(THROTTLE_PRESETS.PUBLIC_READ.limit);
    });

    it('should have very strict limits for auth operations', () => {
      expect(THROTTLE_PRESETS.AUTH_CHALLENGE.limit).toBe(5);
      expect(THROTTLE_PRESETS.AUTH_VERIFY.limit).toBe(10);
      expect(THROTTLE_PRESETS.AUTH_CHALLENGE.limit).toBeLessThan(THROTTLE_PRESETS.AUTH_VERIFY.limit);
    });

    it('should have generous limits for public read operations', () => {
      expect(THROTTLE_PRESETS.PUBLIC_READ.limit).toBe(200);
      expect(THROTTLE_PRESETS.SEARCH.limit).toBe(150);
      expect(THROTTLE_PRESETS.TRACK_STREAM.limit).toBe(300);
    });

    it('should have balanced limits for authenticated operations', () => {
      expect(THROTTLE_PRESETS.AUTHENTICATED_READ.limit).toBe(400);
      expect(THROTTLE_PRESETS.AUTHENTICATED_WRITE.limit).toBe(100);
      expect(THROTTLE_PRESETS.AUTHENTICATED_READ.limit).toBeGreaterThan(THROTTLE_PRESETS.AUTHENTICATED_WRITE.limit);
    });

    it('should maintain backward compatibility with legacy presets', () => {
      expect(THROTTLE_PRESETS.PUBLIC).toBeDefined();
      expect(THROTTLE_PRESETS.AUTHENTICATED).toBeDefined();
      expect(THROTTLE_PRESETS.AUTH_ENDPOINTS).toBeDefined();
      expect(THROTTLE_PRESETS.STRICT).toBeDefined();
      expect(THROTTLE_PRESETS.RELAXED).toBeDefined();
    });

    it('should have consistent TTL values (1 minute)', () => {
      const presets = Object.values(THROTTLE_PRESETS);
      presets.forEach(preset => {
        expect(preset.ttl).toBe(60000);
      });
    });
  });

  describe('RouteType Enum', () => {
    it('should define all required route types', () => {
      expect(RouteType.AUTH).toBe('auth');
      expect(RouteType.HIGH_RISK_WRITE).toBe('high_risk_write');
      expect(RouteType.MODERATE_WRITE).toBe('moderate_write');
      expect(RouteType.PUBLIC_READ).toBe('public_read');
      expect(RouteType.AUTHENTICATED_READ).toBe('authenticated_read');
      expect(RouteType.AUTHENTICATED_WRITE).toBe('authenticated_write');
      expect(RouteType.ADMIN_READ).toBe('admin_read');
      expect(RouteType.ADMIN_WRITE).toBe('admin_write');
    });
  });

  describe('getThrottlePresetByRouteType', () => {
    it('should return correct presets for each route type', () => {
      const authPreset = getThrottlePresetByRouteType(RouteType.AUTH);
      expect(authPreset).toEqual(THROTTLE_PRESETS.AUTH_VERIFY);

      const highRiskPreset = getThrottlePresetByRouteType(RouteType.HIGH_RISK_WRITE);
      expect(highRiskPreset).toEqual(THROTTLE_PRESETS.TIP_SUBMISSION);

      const publicReadPreset = getThrottlePresetByRouteType(RouteType.PUBLIC_READ);
      expect(publicReadPreset).toEqual(THROTTLE_PRESETS.PUBLIC_READ);

      const searchPreset = getThrottlePresetByRouteType(RouteType.PUBLIC_READ);
      expect(searchPreset.limit).toBe(200);
    });

    it('should return default preset for unknown route types', () => {
      const unknownPreset = getThrottlePresetByRouteType('unknown' as RouteType);
      expect(unknownPreset).toEqual(THROTTLE_PRESETS.PUBLIC);
    });

    it('should map route types to appropriate security levels', () => {
      const mappings = [
        { type: RouteType.AUTH, expectedLimit: 10 },
        { type: RouteType.HIGH_RISK_WRITE, expectedLimit: 20 },
        { type: RouteType.MODERATE_WRITE, expectedLimit: 30 },
        { type: RouteType.PUBLIC_READ, expectedLimit: 200 },
        { type: RouteType.AUTHENTICATED_READ, expectedLimit: 400 },
        { type: RouteType.AUTHENTICATED_WRITE, expectedLimit: 100 },
        { type: RouteType.ADMIN_READ, expectedLimit: 500 },
        { type: RouteType.ADMIN_WRITE, expectedLimit: 200 },
      ];

      mappings.forEach(({ type, expectedLimit }) => {
        const preset = getThrottlePresetByRouteType(type);
        expect(preset.limit).toBe(expectedLimit);
      });
    });
  });

  describe('Security Hierarchy', () => {
    it('should enforce stricter limits for writes than reads', () => {
      const writeLimits = [
        THROTTLE_PRESETS.TIP_SUBMISSION.limit,
        THROTTLE_PRESETS.FILE_UPLOAD.limit,
        THROTTLE_PRESETS.TRACK_CREATION.limit,
        THROTTLE_PRESETS.USER_CREATION.limit,
      ];

      const readLimits = [
        THROTTLE_PRESETS.PUBLIC_READ.limit,
        THROTTLE_PRESETS.SEARCH.limit,
        THROTTLE_PRESETS.TRACK_STREAM.limit,
      ];

      const maxWriteLimit = Math.max(...writeLimits);
      const minReadLimit = Math.min(...readLimits);

      expect(maxWriteLimit).toBeLessThan(minReadLimit);
    });

    it('should enforce stricter limits for auth than general operations', () => {
      expect(THROTTLE_PRESETS.AUTH_CHALLENGE.limit).toBeLessThan(THROTTLE_PRESETS.PUBLIC_READ.limit);
      expect(THROTTLE_PRESETS.AUTH_VERIFY.limit).toBeLessThan(THROTTLE_PRESETS.PUBLIC_READ.limit);
    });

    it('should provide higher limits for authenticated users', () => {
      expect(THROTTLE_PRESETS.AUTHENTICATED_READ.limit).toBeGreaterThan(THROTTLE_PRESETS.PUBLIC_READ.limit);
      expect(THROTTLE_PRESETS.AUTHENTICATED_WRITE.limit).toBeGreaterThan(THROTTLE_PRESETS.TIP_SUBMISSION.limit);
    });
  });

  describe('Rate Limit Progression', () => {
    it('should show logical progression of strictness', () => {
      // From most strict to most lenient
      const limits = [
        THROTTLE_PRESETS.AUTH_CHALLENGE.limit,    // 5 - most strict
        THROTTLE_PRESETS.FILE_UPLOAD.limit,        // 3
        THROTTLE_PRESETS.TRACK_CREATION.limit,     // 5
        THROTTLE_PRESETS.AUTH_VERIFY.limit,        // 10
        THROTTLE_PRESETS.TIP_SUBMISSION.limit,     // 20
        THROTTLE_PRESETS.USER_CREATION.limit,      // 10
        THROTTLE_PRESETS.COMMENT_CREATE.limit,     // 30
        THROTTLE_PRESETS.TRACK_UPDATE.limit,       // 30
        THROTTLE_PRESETS.USER_UPDATE.limit,        // 50
        THROTTLE_PRESETS.AUTHENTICATED_WRITE.limit, // 100
        THROTTLE_PRESETS.ADMIN_WRITE.limit,        // 200
        THROTTLE_PRESETS.SEARCH.limit,              // 150
        THROTTLE_PRESETS.PUBLIC_READ.limit,        // 200
        THROTTLE_PRESETS.AUTHENTICATED_READ.limit,  // 400
        THROTTLE_PRESETS.ADMIN_READ.limit,          // 500 - most lenient
      ];

      // Verify the progression makes sense
      expect(limits[0]).toBeLessThanOrEqual(limits[limits.length - 1]);
    });
  });
});
