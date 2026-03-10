import bcrypt from 'bcrypt';
import { prisma } from '../../config/database';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../utils/errors';
import { getPaginationParams, buildPaginationMeta } from '../../utils/pagination';

const ALLOWED_MANAGED_ROLE_NAMES = ['auxiliar', 'cobrador'];

interface UsersPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FindAllUsersResult {
  data: Array<{
    id: string;
    email: string;
    name: string;
    phone: string;
    cedula: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    roleId: string;
    role: {
      id: string;
      name: string;
      description: string | null;
    };
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: UsersPaginationMeta;
}

const userSelectWithoutPassword = {
  id: true,
  email: true,
  name: true,
  phone: true,
  cedula: true,
  isActive: true,
  mustChangePassword: true,
  roleId: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

async function assertManagedRole(roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true },
  });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  if (!ALLOWED_MANAGED_ROLE_NAMES.includes(role.name.toLowerCase())) {
    throw new BadRequestError('Users can only be created as auxiliar or cobrador');
  }
}

export async function findAll(
  query: { page?: string; limit?: string; search?: string }
): Promise<FindAllUsersResult> {
  const { skip, take, page, limit } = getPaginationParams(query);
  const search = query.search?.trim();
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { cedula: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelectWithoutPassword,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  const pagination = buildPaginationMeta(total, page, limit);
  return { data: users, pagination };
}

export async function findById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelectWithoutPassword,
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

export async function create(data: {
  email: string;
  password: string;
  name: string;
  phone: string;
  roleId: string;
  cedula?: string;
}) {
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();
  const phone = data.phone.trim();
  const cedula = data.cedula?.trim() || null;

  await assertManagedRole(data.roleId);

  const existingEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingEmail) {
    throw new ConflictError('A user with this email already exists');
  }

  if (cedula) {
    const existingCedula = await prisma.user.findFirst({
      where: { cedula },
      select: { id: true },
    });
    if (existingCedula) {
      throw new ConflictError('A user with this cedula already exists');
    }
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      phone,
      cedula,
      roleId: data.roleId,
      isActive: true,
      mustChangePassword: true,
    },
    select: userSelectWithoutPassword,
  });
}

export async function update(
  id: string,
  data: {
    email?: string;
    name?: string;
    phone?: string;
    cedula?: string;
    roleId?: string;
    isActive?: boolean;
  }
) {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      cedula: true,
      phone: true,
      roleId: true,
    },
  });

  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  const updateData: {
    email?: string;
    name?: string;
    phone?: string;
    cedula?: string | null;
    roleId?: string;
    isActive?: boolean;
  } = {};

  if (typeof data.email === 'string') {
    const normalizedEmail = data.email.trim().toLowerCase();
    if (normalizedEmail !== existingUser.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingEmail) {
        throw new ConflictError('A user with this email already exists');
      }
    }
    updateData.email = normalizedEmail;
  }

  if (typeof data.name === 'string') {
    updateData.name = data.name.trim();
  }

  if (typeof data.phone === 'string') {
    updateData.phone = data.phone.trim();
  }

  if (typeof data.cedula === 'string') {
    const normalizedCedula = data.cedula.trim();
    if (normalizedCedula && normalizedCedula !== existingUser.cedula) {
      const existingCedula = await prisma.user.findFirst({
        where: { cedula: normalizedCedula },
        select: { id: true },
      });
      if (existingCedula) {
        throw new ConflictError('A user with this cedula already exists');
      }
    }
    updateData.cedula = normalizedCedula || null;
  }

  if (typeof data.roleId === 'string') {
    await assertManagedRole(data.roleId);
    updateData.roleId = data.roleId;
  }

  if (typeof data.isActive === 'boolean') {
    updateData.isActive = data.isActive;
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: userSelectWithoutPassword,
  });
}

export async function toggleActive(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: userSelectWithoutPassword,
  });
}
