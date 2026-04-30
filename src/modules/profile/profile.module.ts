import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from 'src/shared/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [ProfileController],
  providers: [ProfileService, PrismaService],
})
export class ProfileModule {}
