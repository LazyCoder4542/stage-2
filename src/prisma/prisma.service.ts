// src/prisma/prisma.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '~gen/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';

const createExtendedClient = (
  primary: PrismaClient,
  replicas: PrismaClient[],
) => primary.$extends(readReplicas({ replicas }));

export type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly client: ExtendedPrismaClient;

  // Keep references to the underlying clients so we can disconnect them cleanly.
  private readonly primaryClient: PrismaClient;
  private readonly replicaClients: PrismaClient[];

  constructor(private readonly config: ConfigService) {
    const primaryUrl = this.config.getOrThrow<string>('DATABASE_URL');
    const replicaUrl = this.config.getOrThrow<string>('DATABASE_URL_REPLICA1');

    this.primaryClient = new PrismaClient({
      adapter: new PrismaPg({ connectionString: primaryUrl }),
    });

    const replica = new PrismaClient({
      adapter: new PrismaPg({ connectionString: replicaUrl }),
    });
    this.replicaClients = [replica];

    this.client = createExtendedClient(this.primaryClient, this.replicaClients);
  }

  async onModuleInit() {
    await this.primaryClient.$connect();
    await Promise.all(this.replicaClients.map((r) => r.$connect()));
    this.logger.log('Prisma connected (primary + replicas)');
  }

  async onModuleDestroy() {
    await this.primaryClient.$disconnect();
    await Promise.all(this.replicaClients.map((r) => r.$disconnect()));
  }
}
