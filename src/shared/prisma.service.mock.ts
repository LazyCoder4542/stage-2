import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '~gen/prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
class TestPrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    super({ adapter });
  }
}

export const PrismaServiceMock = {
  provide: PrismaService,
  useClass: TestPrismaService,
};
