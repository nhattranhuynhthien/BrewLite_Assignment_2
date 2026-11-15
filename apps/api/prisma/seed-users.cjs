const { hash } = require('bcryptjs');

async function seedDemoUsers(db) {
  const allowDemoSeed =
    process.env.SEED_DEMO_USERS === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.SEED_DEMO_USERS !== 'false');

  if (!allowDemoSeed) {
    return;
  }

  const customerPasswordHash = await hash('BrewLite123!', 10);
  const staffPasswordHash = await hash('BrewLiteStaff123!', 10);

  await db.user.upsert({
    where: { email: 'customer@brewlite.local' },
    update: { fullName: 'Khách hàng BrewLite', role: 'CUSTOMER' },
    create: {
      email: 'customer@brewlite.local',
      passwordHash: customerPasswordHash,
      fullName: 'Khách hàng BrewLite',
      role: 'CUSTOMER',
    },
  });

  await db.user.upsert({
    where: { email: 'staff@brewlite.local' },
    update: { fullName: 'Nhân viên quầy BrewLite', role: 'STAFF' },
    create: {
      email: 'staff@brewlite.local',
      passwordHash: staffPasswordHash,
      fullName: 'Nhân viên quầy BrewLite',
      role: 'STAFF',
    },
  });
}

module.exports = { seedDemoUsers };

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  seedDemoUsers(prisma)
    .then(() => {
      console.log('Seeded demo users cleanly.');
    })
    .finally(() => prisma.$disconnect());
}
