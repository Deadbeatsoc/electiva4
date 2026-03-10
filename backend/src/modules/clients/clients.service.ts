import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import type { CreateClientInput } from './clients.validation';

interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ClientListItem {
  id: string;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  notes: string | null;
  isActive: boolean;
  lastContactAt: Date;
  createdAt: Date;
  updatedAt: Date;
  loans: Array<{
    id: string;
    loanNumber: string;
    status: string;
    totalAmount: unknown;
    paidAmount: unknown;
    remainingAmount: unknown;
    createdAt: Date;
  }>;
  hasActiveLoan: boolean;
  activeLoan: {
    id: string;
    loanNumber: string;
    status: string;
    totalAmount: unknown;
    paidAmount: unknown;
    remainingAmount: unknown;
    createdAt: Date;
  } | null;
}

interface ClientListResult {
  data: ClientListItem[];
  pagination: PaginationResult;
}

export async function findAllForCollector(
  collectorId: string,
  query: { page?: string; limit?: string; search?: string }
): Promise<ClientListResult> {
  const { skip, take, page, limit } = getPaginationParams(query);
  const search = query.search?.trim();

  const where: Record<string, unknown> = {
    createdById: collectorId,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { cedula: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        cedula: true,
        phone: true,
        address: true,
        notes: true,
        isActive: true,
        lastContactAt: true,
        createdAt: true,
        updatedAt: true,
        loans: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            loanNumber: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            remainingAmount: true,
            createdAt: true,
          },
          take: 1,
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.count({ where }),
  ]);

  const data = clients.map((client) => ({
    ...client,
    hasActiveLoan: client.loans.length > 0,
    activeLoan: client.loans[0] ?? null,
  }));

  return {
    data,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function createForCollector(collectorId: string, payload: CreateClientInput) {
  const cedula = payload.cedula.trim();

  const existing = await prisma.client.findUnique({
    where: { cedula },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError('A client with this cedula already exists');
  }

  const now = new Date();

  return prisma.client.create({
    data: {
      createdById: collectorId,
      name: payload.name.trim(),
      cedula,
      phone: payload.phone.trim(),
      address: payload.address.trim(),
      notes: payload.notes?.trim() || null,
      lastContactAt: now,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      cedula: true,
      phone: true,
      address: true,
      notes: true,
      isActive: true,
      lastContactAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function findDetailForCollector(collectorId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      createdById: collectorId,
    },
    select: {
      id: true,
      name: true,
      cedula: true,
      phone: true,
      address: true,
      notes: true,
      isActive: true,
      lastContactAt: true,
      createdAt: true,
      updatedAt: true,
      loans: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          loanNumber: true,
          status: true,
          principalAmount: true,
          interestRate: true,
          totalAmount: true,
          paidAmount: true,
          remainingAmount: true,
          createdAt: true,
          disbursedAt: true,
        },
      },
    },
  });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  const paymentHistory = await prisma.payment.findMany({
    where: {
      collectorId,
      loan: {
        clientId,
      },
    },
    select: {
      id: true,
      amount: true,
      moraAmount: true,
      isLate: true,
      paymentTimestamp: true,
      createdAt: true,
      loan: {
        select: {
          id: true,
          loanNumber: true,
          status: true,
        },
      },
      installment: {
        select: {
          id: true,
          number: true,
        },
      },
    },
    orderBy: { paymentTimestamp: 'desc' },
  });

  const activeLoan =
    client.loans.find((loan) => loan.status === 'ACTIVE') ?? null;
  const latestLoan = client.loans[0] ?? null;
  const currentLoan = activeLoan ?? latestLoan;

  return {
    ...client,
    currentLoan,
    hasActiveLoan: !!activeLoan,
    loans: client.loans,
    paymentHistory,
  };
}

export async function touchClientLastContact(clientId: string, date = new Date()) {
  await prisma.client.update({
    where: { id: clientId },
    data: { lastContactAt: date },
  });
}
