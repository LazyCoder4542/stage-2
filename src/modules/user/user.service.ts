import { Injectable } from '@nestjs/common';
import { Prisma, User } from '~gen/prisma/client';
import { PrismaService } from 'src/shared/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  async findById(id: string): Promise<User | null> {
    return this.user({ id });
  }

  async findOrCreateByGithubId(data: {
    github_id: string;
    username: string;
    email: string;
    avatar_url?: string;
  }): Promise<User> {
    return this.prisma.user.upsert({
      where: { github_id: data.github_id },
      update: { last_login_at: new Date(), avatar_url: data.avatar_url },
      create: {
        github_id: data.github_id,
        username: data.username,
        email: data.email,
        avatar_url: data.avatar_url,
      },
    });
  }

  async updateRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { refresh_token_hash: hash },
    });
  }

  private async user(
    userWhereUniqueInput: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: userWhereUniqueInput,
    });
  }
  private async users(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return await this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }
  private async createProfile(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }
  private async deleteProfile(
    userWhereUniqueInput: Prisma.UserWhereUniqueInput,
  ): Promise<User> {
    return this.prisma.user.delete({
      where: userWhereUniqueInput,
    });
  }
}
