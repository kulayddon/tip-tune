import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tip Metadata Validation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const validTipBase = {
    artistId: '550e8400-e29b-41d4-a716-446655440001',
    stellarTxHash: 'c6e0b3e5c8a4f2d1b9a7e6f3c5d8a2b1c4e7f0a9b3d6e9f2c5a8b1e4f7a0c3d6',
  };

  it('should accept valid metadata', () => {
    return request(app.getHttpServer())
      .post('/api/v1/tips')
      .set('x-user-id', '550e8400-e29b-41d4-a716-446655440099')
      .send({
        ...validTipBase,
        metadata: {
          source: 'mobile_app',
          campaign: 'summer_sale',
          platform: 'ios',
          os: 'iOS 16.5',
          version: '1.2.3',
        },
      })
      .expect((res) => {
        // We expect either 201 or 400 (if artist/tx doesn't exist in DB)
        // But for VALIDATION testing, we care if it passes the PIPE.
        // If it passes the pipe, it reaches the service which might throw 400 for 'Artist not found'.
        // If it fails the pipe, it returns 400 with 'Bad Request' and specific errors.
        if (res.status === 400 && res.body.message === 'Artist not found') {
            return; // Passed validation pipe!
        }
        if (res.status === 201) return;
        throw new Error(`Expected success or 'Artist not found', but got ${res.status}: ${JSON.stringify(res.body)}`);
      });
  });

  it('should fail if metadata field has invalid type', () => {
    return request(app.getHttpServer())
      .post('/api/v1/tips')
      .set('x-user-id', '550e8400-e29b-41d4-a716-446655440099')
      .send({
        ...validTipBase,
        metadata: {
          source: 123, // Should be string
        },
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('metadata.source must be a string');
      });
  });

  it('should fail if metadata field exceeds MaxLength', () => {
    return request(app.getHttpServer())
      .post('/api/v1/tips')
      .set('x-user-id', '550e8400-e29b-41d4-a716-446655440099')
      .send({
        ...validTipBase,
        metadata: {
          source: 'a'.repeat(51), // Max is 50
        },
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('metadata.source must be shorter than or equal to 50 characters');
      });
  });

  it('should fail if metadata contains unknown fields (forbidNonWhitelisted)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/tips')
      .set('x-user-id', '550e8400-e29b-41d4-a716-446655440099')
      .send({
        ...validTipBase,
        metadata: {
          unknownField: 'value',
        },
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('property unknownField should not exist');
      });
  });

  it('should fail if metadata is not an object', () => {
    return request(app.getHttpServer())
      .post('/api/v1/tips')
      .set('x-user-id', '550e8400-e29b-41d4-a716-446655440099')
      .send({
        ...validTipBase,
        metadata: 'not-an-object',
      })
      .expect(400);
  });
});
