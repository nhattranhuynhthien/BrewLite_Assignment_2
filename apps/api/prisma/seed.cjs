const { PrismaClient } = require('@prisma/client');
const { seedDemoUsers } = require('./seed-users.cjs');

const db = new PrismaClient();

async function seedCatalog(client) {
  const coffee = await client.category.upsert({
    where: { name: 'Cà phê' },
    update: { displayOrder: 1 },
    create: { name: 'Cà phê', displayOrder: 1 },
  });
  const tea = await client.category.upsert({
    where: { name: 'Trà trái cây & Trà sữa' },
    update: { displayOrder: 2 },
    create: { name: 'Trà trái cây & Trà sữa', displayOrder: 2 },
  });

  const pearl = await client.topping.upsert({
    where: { name: 'Trân châu trắng' },
    update: { extraPrice: 6000, isAvailable: true },
    create: { name: 'Trân châu trắng', extraPrice: 6000, isAvailable: true },
  });
  const cheese = await client.topping.upsert({
    where: { name: 'Kem cheese' },
    update: { extraPrice: 10000, isAvailable: true },
    create: { name: 'Kem cheese', extraPrice: 10000, isAvailable: true },
  });
  const jelly = await client.topping.upsert({
    where: { name: 'Thạch cà phê' },
    update: { extraPrice: 7000, isAvailable: true },
    create: { name: 'Thạch cà phê', extraPrice: 7000, isAvailable: true },
  });

  const products = [
    [
      '10000000-0000-4000-8000-000000000001',
      'Cà phê sữa đá',
      30000,
      coffee.id,
      'Cà phê phin rang mộc pha sữa đặc thơm béo, đậm vị truyền thống.',
      [pearl.id, jelly.id],
    ],
    [
      '10000000-0000-4000-8000-000000000002',
      'Bạc xỉu',
      35000,
      coffee.id,
      'Sữa tươi thanh nhẹ hòa quyện lớp cà phê thơm dịu và kem sữa.',
      [pearl.id, cheese.id, jelly.id],
    ],
    [
      '10000000-0000-4000-8000-000000000003',
      'Americano đá',
      38000,
      coffee.id,
      'Espresso Arabica Cầu Đất pha loãng mát lạnh, hậu vị thanh ngọt.',
      [jelly.id],
    ],
    [
      '10000000-0000-4000-8000-000000000004',
      'Trà đào cam sả',
      42000,
      tea.id,
      'Trà ô long thanh mát kết hợp đào miếng giòn ngọt và hương sả.',
      [pearl.id],
    ],
    [
      '10000000-0000-4000-8000-000000000005',
      'Trà sữa ô long',
      45000,
      tea.id,
      'Trà ô long nướng đậm vị hòa sữa tươi, hợp thêm trân châu trắng.',
      [pearl.id, cheese.id],
    ],
    [
      '10000000-0000-4000-8000-000000000006',
      'Matcha Latte',
      49000,
      tea.id,
      'Bột matcha Uji đánh mịn cùng sữa tươi thanh ngọt, hợp kem cheese.',
      [pearl.id, cheese.id],
    ],
  ];

  for (const [id, name, basePrice, categoryId, description, toppingIds] of products) {
    await client.product.upsert({
      where: { id },
      update: { name, basePrice, categoryId, description, isAvailable: true },
      create: {
        id,
        name,
        basePrice,
        categoryId,
        description,
        stockQuantity: 100,
        isAvailable: true,
      },
    });

    for (const [sizeName, extraPrice] of [
      ['S', 0],
      ['M', 5000],
      ['L', 10000],
    ]) {
      await client.size.upsert({
        where: { productId_name: { productId: id, name: sizeName } },
        update: { extraPrice, isAvailable: true },
        create: { productId: id, name: sizeName, extraPrice, isAvailable: true },
      });
    }

    for (const toppingId of toppingIds) {
      await client.productTopping.upsert({
        where: { productId_toppingId: { productId: id, toppingId } },
        update: {},
        create: { productId: id, toppingId },
      });
    }
  }
}

async function main() {
  await seedCatalog(db);
  await seedDemoUsers(db);
  console.log('BrewLite database seeded cleanly.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
