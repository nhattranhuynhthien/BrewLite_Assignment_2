const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const sampleProductId = '10000000-0000-4000-8000-000000000001';
const hiddenProductId = 'a2000000-0000-4000-8000-000000000001';
const hiddenProductName = 'BrewLite Postman fixture (hidden product)';

async function main() {
  await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: sampleProductId },
      select: { categoryId: true, basePrice: true },
    });
    if (!product) {
      throw new Error('Run the catalog seed before seeding Postman fixtures.');
    }

    const existingProduct = await tx.product.findUnique({
      where: { id: hiddenProductId },
    });
    if (existingProduct && existingProduct.name !== hiddenProductName) {
      throw new Error(`Product ${hiddenProductId} is not a Postman fixture.`);
    }

    await tx.product.upsert({
      where: { id: hiddenProductId },
      update: { isAvailable: false },
      create: {
        id: hiddenProductId,
        name: hiddenProductName,
        categoryId: product.categoryId,
        basePrice: product.basePrice,
        stockQuantity: 10,
        isAvailable: false,
      },
    });
  });
  console.log('BrewLite Postman catalog fixture is ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
