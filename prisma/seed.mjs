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

  const roles = await Promise.all(
    ['manager', 'server', 'kitchen', 'cashier'].map((name) =>
      prisma.role.upsert({
        where: { name_tenantId: { name, tenantId: tenant.id } },
        update: { isActive: true },
        create: { name, tenantId: tenant.id, isActive: true },
      }),
    ),
  );

  const managerRole = roles.find((role) => role.name === 'manager');
  const serverRole = roles.find((role) => role.name === 'server');

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

  const table = await prisma.table.upsert({
    where: { id: 'table-demo-1' },
    update: {},
    create: {
      id: 'table-demo-1',
      tenantId: tenant.id,
      tableNumber: 1,
      seatCount: 4,
      status: 'AVAILABLE',
    },
  });

  const item = await prisma.menuItem.upsert({
    where: { id: 'item-demo-1' },
    update: {
      image: null,
      name: product.name,
      category: 'Pizza',
      description: 'Classic pizza item for demo table assignment',
      price: 13.5,
      isActive: true,
    },
    create: {
      id: 'item-demo-1',
      tenantId: tenant.id,
      image: null,
      name: product.name,
      category: 'Pizza',
      description: 'Classic pizza item for demo table assignment',
      price: 13.5,
      isActive: true,
    },
  });

  await prisma.tableMenuItem.upsert({
    where: { id: 'table-item-demo-1' },
    update: {
      tableId: table.id,
      menuItemId: item.id,
    },
    create: {
      id: 'table-item-demo-1',
      tableId: table.id,
      menuItemId: item.id,
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
