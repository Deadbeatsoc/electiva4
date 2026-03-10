import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { UnauthorizedError, NotFoundError } from '../../utils/errors';

interface TokenPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface UserWithRole {
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
    permissions: {
      permission: {
        id: string;
        name: string;
        module: string;
        action: string;
      };
    }[];
  };
}

const userAuthInclude = {
  role: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
} as const;

function sanitizeUser(user: UserWithRole & { password?: string }) {
  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function generateTokens(user: UserWithRole): TokenPair {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
  };

  const accessToken = jwt.sign(payload, config.jwt.accessSecret as jwt.Secret, {
    expiresIn: config.jwt.accessExpiry as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(
    { userId: user.id },
    config.jwt.refreshSecret as jwt.Secret,
    { expiresIn: config.jwt.refreshExpiry as jwt.SignOptions['expiresIn'] }
  );

  return { accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: userAuthInclude,
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokens = generateTokens(user);

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
}

export async function refreshToken(token: string) {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret) as {
      userId: string;
    };

    const user = await prisma.user.findFirst({
      where: { id: decoded.userId, isActive: true },
      include: userAuthInclude,
    });

    if (!user) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const tokens = generateTokens(user);

    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    throw error;
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.password);

  if (!isCurrentValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });

  return { message: 'Password changed successfully' };
}

export async function resetPassword(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      mustChangePassword: true,
    },
  });

  return { message: 'Password reset successfully' };
}

export async function me(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    include: userAuthInclude,
  });

  if (!user) {
    throw new UnauthorizedError('User not found or inactive');
  }

  return sanitizeUser(user);
}
