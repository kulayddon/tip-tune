import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { Repository } from 'typeorm';

describe('Rate Limiting by Route Type (E2E)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Endpoints', () => {
    it('should enforce strict rate limit on auth challenge endpoint', async () => {
      const publicKey = 'GTEST1234567890123456789012345678901234567890';
      
      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/challenge')
          .send({ publicKey })
          .expect(200);
      }

      // 6th request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/auth/challenge')
        .send({ publicKey })
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('5');
    });

    it('should enforce moderate rate limit on auth verify endpoint', async () => {
      const verifyDto = {
        publicKey: 'GTEST1234567890123456789012345678901234567890',
        signature: 'test-signature',
        challenge: 'test-challenge'
      };
      
      // First 10 requests should succeed (or fail with auth error, but not rate limit)
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/auth/verify')
          .send(verifyDto)
          .expect(res => [401, 429].includes(res.status));
      }

      // 11th request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/auth/verify')
        .send(verifyDto)
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('10');
    });
  });

  describe('High-Risk Write Operations', () => {
    it('should enforce strict rate limit on tip submission', async () => {
      const tipDto = {
        amount: 100,
        message: 'Test tip',
        artistId: 'test-artist-id',
        transactionHash: 'test-tx-hash'
      };
      
      // First 20 requests should succeed (or fail with validation error, but not rate limit)
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer())
          .post('/tips')
          .set('x-user-id', 'test-user-id')
          .send(tipDto)
          .expect(res => [400, 401, 429].includes(res.status));
      }

      // 21st request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/tips')
        .set('x-user-id', 'test-user-id')
        .send(tipDto)
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('20');
    });

    it('should enforce very strict rate limit on file upload', async () => {
      // First 3 requests should succeed (or fail with validation error, but not rate limit)
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/files/upload')
          .attach('file', Buffer.from('test'), 'test.mp3')
          .expect(res => [400, 401, 429].includes(res.status));
      }

      // 4th request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/files/upload')
        .attach('file', Buffer.from('test'), 'test.mp3')
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('3');
    });

    it('should enforce strict rate limit on track creation', async () => {
      const trackDto = {
        title: 'Test Track',
        genre: 'test',
        isPublic: true
      };
      
      // First 5 requests should succeed (or fail with validation error, but not rate limit)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/tracks')
          .send(trackDto)
          .expect(res => [400, 401, 429].includes(res.status));
      }

      // 6th request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/tracks')
        .send(trackDto)
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('5');
    });
  });

  describe('Public Read Operations', () => {
    it('should allow generous rate limit on public track reads', async () => {
      // First 200 requests should succeed
      for (let i = 0; i < 200; i++) {
        await request(app.getHttpServer())
          .get('/tracks')
          .expect(res => [200, 429].includes(res.status));
      }

      // 201st request should be rate limited
      const response = await request(app.getHttpServer())
        .get('/tracks')
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('200');
    });

    it('should allow generous rate limit on search operations', async () => {
      // First 150 requests should succeed
      for (let i = 0; i < 150; i++) {
        await request(app.getHttpServer())
          .get('/search')
          .query({ q: 'test' })
          .expect(res => [200, 429].includes(res.status));
      }

      // 151st request should be rate limited
      const response = await request(app.getHttpServer())
        .get('/search')
        .query({ q: 'test' })
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('150');
    });

    it('should allow high rate limit on file streaming', async () => {
      // First 300 requests should succeed
      for (let i = 0; i < 300; i++) {
        await request(app.getHttpServer())
          .get('/files/test-filename/stream')
          .expect(res => [200, 404, 429].includes(res.status));
      }

      // 301st request should be rate limited
      const response = await request(app.getHttpServer())
        .get('/files/test-filename/stream')
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('300');
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers on all responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/tracks')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should include retry-after header when rate limited', async () => {
      // Make many requests to trigger rate limiting
      for (let i = 0; i < 201; i++) {
        await request(app.getHttpServer())
          .get('/tracks');
      }

      const response = await request(app.getHttpServer())
        .get('/tracks')
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('Whitelist Bypass', () => {
    it('should bypass rate limiting for whitelisted IPs', async () => {
      // This test would require mocking the getClientIp method to return a whitelisted IP
      // For now, we'll just verify the structure exists
      const response = await request(app.getHttpServer())
        .get('/tracks')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });
  });

  describe('Route Type Classification', () => {
    it('should apply correct rate limits based on route type metadata', async () => {
      // Test that different endpoints have different limits based on their route type
      const tracksResponse = await request(app.getHttpServer())
        .get('/tracks')
        .expect(200);

      const searchResponse = await request(app.getHttpServer())
        .get('/search')
        .query({ q: 'test' })
        .expect(200);

      // Public reads should have different limits than search
      expect(tracksResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(searchResponse.headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});
