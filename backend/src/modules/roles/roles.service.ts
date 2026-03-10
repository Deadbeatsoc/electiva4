import { prisma } from '../../config/database';
import { NotFoundError, ConflictError } from '../../utils/errors';

export async function findAll() {
  const roles = await prisma.role.findMany({
    include: {
      _count: {
        select: { permissions: true, users: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return roles;
}

export async function findById(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
      _count: {
        select: { users: true },
      },
    },
  });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  return role;
}

export async function create(data: { name: string; description?: string }) {
  const existing = await prisma.role.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new ConflictError('A role with this name already exists');
  }

  const role = await prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
    },
  });

  return role;
}

export async function update(
  id: string,
  data: { name?: string; description?: string }
) {
  const existingRole = await prisma.role.findUnique({ where: { id } });

  if (!existingRole) {
    throw new NotFoundError('Role not found');
  }

  // Check name uniqueness if changed
  if (data.name && data.name !== existingRole.name) {
    const existingName = await prisma.role.findUnique({
      where: { name: data.name },
    });
    if (existingName) {
      throw new ConflictError('A role with this name already exists');
    }
  }

  const role = await prisma.role.update({
    where: { id },
    data,
  });

  return role;
}

export async function assignPermissions(
  roleId: string,
  permissionIds: string[]
) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  // Delete existing role-permission associations
  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  // Create new role-permission associations
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    });
  }

  // Return updated role with permissions
  const updatedRole = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  return updatedRole;
}

export async function getAllPermissions() {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });

  return permissions;
}
