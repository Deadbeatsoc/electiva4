import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'users.create',
  'users.read',
  'users.update',
  'users.delete',
  'roles.create',
  'roles.read',
  'roles.update',
  'clients.create',
  'clients.read',
  'clients.update',
  'clients.delete',
  'loans.create',
  'loans.read',
  'loans.update',
  'loans.cancel',
  'payments.create',
  'payments.read',
  'expenses.create',
  'expenses.read',
  'cashRegister.open',
  'cashRegister.close',
  'cashRegister.read',
  'mora.config',
  'rate.config',
  'reports.read',
  'reports.export',
  'dashboard.read',
  'audit.read',
];

const ADMIN_PERMISSIONS = PERMISSIONS;

const AUXILIAR_PERMISSIONS = [
  'users.read',
  'roles.read',
  'clients.read',
  'loans.read',
  'payments.read',
  'expenses.read',
  'cashRegister.read',
  'reports.read',
  'reports.export',
  'dashboard.read',
  'audit.read',
];

const COBRADOR_PERMISSIONS = [
  'clients.create',
  'clients.read',
  'clients.update',
  'loans.create',
  'loans.read',
  'loans.update',
  'payments.create',
  'payments.read',
  'expenses.create',
  'expenses.read',
  'cashRegister.open',
  'cashRegister.close',
  'cashRegister.read',
  'dashboard.read',
];

async function main() {
  console.log('Seeding database...');

  const permissionRecords: Record<string, string> = {};

  for (const permName of PERMISSIONS) {
    const [module, action] = permName.split('.');
    const permission = await prisma.permission.upsert({
      where: { name: permName },
      update: { module, action },
      create: { name: permName, module, action },
    });
    permissionRecords[permName] = permission.id;
  }

  console.log(`Upserted ${PERMISSIONS.length} permissions.`);

  const roles: { name: string; description: string; permissions: string[] }[] = [
    {
      name: 'admin',
      description: 'Administrador del sistema con acceso total',
      permissions: ADMIN_PERMISSIONS,
    },
    {
      name: 'auxiliar',
      description: 'Auxiliar con acceso a dashboards y reportes',
      permissions: AUXILIAR_PERMISSIONS,
    },
    {
      name: 'cobrador',
      description: 'Cobrador con acceso a clientes, prestamos, pagos y caja',
      permissions: COBRADOR_PERMISSIONS,
    },
  ];

  for (const roleDef of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: { name: roleDef.name, description: roleDef.description },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const rolePermissionData = roleDef.permissions.map((permName) => ({
      roleId: role.id,
      permissionId: permissionRecords[permName],
    }));

    await prisma.rolePermission.createMany({ data: rolePermissionData });

    console.log(
      `Role "${roleDef.name}" upserted with ${roleDef.permissions.length} permissions.`
    );
  }

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });

  if (!adminRole) {
    throw new Error('Admin role not found after seeding.');
  }

  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@cobros.local' },
    update: {
      name: 'Administrador',
      phone: '3000000000',
      roleId: adminRole.id,
    },
    create: {
      email: 'admin@cobros.local',
      password: hashedPassword,
      name: 'Administrador',
      phone: '3000000000',
      cedula: '0000000000',
      roleId: adminRole.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  console.log('Default admin user upserted (admin@cobros.local).');
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
