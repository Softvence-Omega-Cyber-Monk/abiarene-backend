import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'System Admin',
      status: 'ACTIVE',
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { id: 'tenant-demo-1' },
    update: {},
    create: {
      id: 'tenant-demo-1',
      name: 'Demo Bistro',
      industry: 'restaurant',
      subscriptionFee: 129.0,
      status: 'ACTIVE',
      lastSync: new Date(),
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name_tenantId: { name: 'Manager', tenantId: tenant.id } },
    update: { isActive: true },
    create: { name: 'Manager', tenantId: tenant.id, isActive: true },
  });

  const serverRole = await prisma.role.upsert({
    where: { name_tenantId: { name: 'Server', tenantId: tenant.id } },
    update: { isActive: true },
    create: { name: 'Server', tenantId: tenant.id, isActive: true },
  });

  await prisma.user.upsert({
    where: { id: 'user-manager-1' },
    update: { email: 'alice.manager@example.com' },
    create: {
      id: 'user-manager-1',
      name: 'Alice Manager',
      email: 'alice.manager@example.com',
      pin: '1111',
      roleId: managerRole.id,
      tenantId: tenant.id,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { id: 'user-server-1' },
    update: { email: 'bob.server@example.com' },
    create: {
      id: 'user-server-1',
      name: 'Bob Server',
      email: 'bob.server@example.com',
      pin: '2222',
      roleId: serverRole.id,
      tenantId: tenant.id,
      status: 'ACTIVE',
    },
  });

  const product = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: 'Margherita Pizza',
      sku: `SKU-${Date.now()}`,
      price: 12.5,
      stock: 50,
    },
  });

  const menu = await prisma.menu.create({
    data: { tenantId: tenant.id, name: 'Main Menu' },
  });

  await prisma.menuItem.create({
    data: {
      menuId: menu.id,
      productId: product.id,
      priceOverride: 13.5,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
