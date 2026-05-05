import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '~gen/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
class TestPrismaService {
  readonly client: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    this.client = new PrismaClient({ adapter });
  }
}

export const PrismaServiceMock = {
  provide: PrismaService,
  useClass: TestPrismaService,
};
