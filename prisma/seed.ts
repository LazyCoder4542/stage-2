import { PrismaPg } from '@prisma/adapter-pg';
import { AgeGroup, Gender, PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

import {profiles} from './seed_profiles.json';

async function main() {
  console.log('Seeding profiles...');

  for (const profile of profiles) {
    await prisma.profile.upsert({
      where: { name: profile.name },
      update: {},
      create: {
        ...profile,
        gender: Gender[profile.gender],
        age_group: AgeGroup[profile.age_group],
      },
    });
  }
  
  console.log(`Seeded ${profiles.length} profiles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
