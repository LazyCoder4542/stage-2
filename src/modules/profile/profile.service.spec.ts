import { HttpModule } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { ProfileService } from './profile.service';
import { PrismaServiceMock } from 'src/shared/prisma.service.mock';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        ProfileService,
        PrismaServiceMock,
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), clear: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue(60) } },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
