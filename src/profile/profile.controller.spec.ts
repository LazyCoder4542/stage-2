import { HttpModule } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { PrismaServiceMock } from 'src/shared/prisma.service.mock';

describe('ProfileController', () => {
  let controller: ProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [ProfileController],
      providers: [ProfileService, PrismaServiceMock],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
