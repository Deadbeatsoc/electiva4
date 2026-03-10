import { prisma } from '../../config/database';
import { BUSINESS_CONSTANTS } from '../../config/constants';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import type { CreateLoanInput, RenewLoanInput } from './loans.validation';

const FIXED_INTEREST_RATE = 20;

interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LoanListResult {
  data: Array<{
    id: string;
    loanNumber: string;
    status: string;
    principalAmount: unknown;
    interestRate: unknown;
    totalAmount: unknown;
    paidAmount: unknown;
    remainingAmount: unknown;
    createdAt: Date;
    disbursedAt: Date;
    client: {
      id: string;
      name: string;
      cedula: string;
      phone: string;
    };
  }>;
  pagination: PaginationResult;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function generateLoanNumber() {
  const ts = Date.now().toString().slice(-8);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `LN-${ts}-${suffix}`;
}

function buildLoanMath(amount: number) {
  const principalAmount = roundMoney(amount);
  const totalAmount = roundMoney(principalAmount * (1 + FIXED_INTEREST_RATE / 100));
  const installmentAmount = roundMoney(
    totalAmount / BUSINESS_CONSTANTS.DEFAULT_INSTALLMENTS
  );
  return {
    principalAmount,
    interestRate: FIXED_INTEREST_RATE,
    totalAmount,
    installmentAmount,
    totalInstallments: BUSINESS_CONSTANTS.DEFAULT_INSTALLMENTS,
  };
}

function buildInstallments(loanId: string, totalAmount: number, totalInstallments: number) {
  const installmentAmount = roundMoney(totalAmount / totalInstallments);
  let accumulated = 0;

  return Array.from({ length: totalInstallments }, (_, index) => {
    const number = index + 1;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + number);

    const amount =
      number === totalInstallments
        ? roundMoney(totalAmount - accumulated)
        : installmentAmount;

    accumulated = roundMoney(accumulated + amount);

    return {
      loanId,
      number,
      amount,
      dueDate,
      status: 'PENDING' as const,
    };
  });
}

async function validateCollectorClientOwnership(collectorId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, createdById: collectorId, isActive: true },
    select: { id: true, name: true, createdById: true },
  });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  return client;
}

export async function findAllForCollector(
  collectorId: string,
  query: { page?: string; limit?: string; search?: string; status?: string }
): Promise<LoanListResult> {
  const { skip, take, page, limit } = getPaginationParams(query);
  const search = query.search?.trim();

  const where: Record<string, unknown> = {
    collectorId,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (search) {
    where.client = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { cedula: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where,
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
        client: {
          select: {
            id: true,
            name: true,
            cedula: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.loan.count({ where }),
  ]);

  return {
    data: loans,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function createForClient(
  collectorId: string,
  clientId: string,
  payload: CreateLoanInput
) {
  await validateCollectorClientOwnership(collectorId, clientId);

  const activeLoan = await prisma.loan.findFirst({
    where: {
      clientId,
      collectorId,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (activeLoan) {
    throw new BadRequestError(
      'This client already has an active loan. Complete it before creating a new one.'
    );
  }

  const math = buildLoanMath(payload.amount);
  const expectedEndDate = new Date();
  expectedEndDate.setDate(expectedEndDate.getDate() + math.totalInstallments);

  const createdLoan = await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        loanNumber: generateLoanNumber(),
        clientId,
        collectorId,
        principalAmount: math.principalAmount,
        interestRate: math.interestRate,
        totalAmount: math.totalAmount,
        installmentAmount: math.installmentAmount,
        totalInstallments: math.totalInstallments,
        paidInstallments: 0,
        paidAmount: 0,
        remainingAmount: math.totalAmount,
        overdueDays: 0,
        moraAmount: 0,
        status: 'ACTIVE',
        disbursedAt: new Date(),
        expectedEndDate,
      },
      select: {
        id: true,
        loanNumber: true,
        status: true,
        principalAmount: true,
        interestRate: true,
        totalAmount: true,
        paidAmount: true,
        remainingAmount: true,
        installmentAmount: true,
        totalInstallments: true,
        createdAt: true,
        disbursedAt: true,
      },
    });

    const installments = buildInstallments(
      loan.id,
      Number(loan.totalAmount),
      loan.totalInstallments
    );

    await tx.installment.createMany({
      data: installments,
    });

    await tx.client.update({
      where: { id: clientId },
      data: { lastContactAt: new Date() },
    });

    return loan;
  });

  return createdLoan;
}

export async function renewLoan(
  collectorId: string,
  loanId: string,
  payload: RenewLoanInput
) {
  const previousLoan = await prisma.loan.findFirst({
    where: {
      id: loanId,
      collectorId,
    },
    select: {
      id: true,
      clientId: true,
      status: true,
      remainingAmount: true,
    },
  });

  if (!previousLoan) {
    throw new NotFoundError('Loan not found');
  }

  if (
    previousLoan.status !== 'COMPLETED' ||
    Number(previousLoan.remainingAmount) > 0
  ) {
    throw new BadRequestError(
      'Only completed loans can be renewed'
    );
  }

  const activeLoan = await prisma.loan.findFirst({
    where: {
      clientId: previousLoan.clientId,
      collectorId,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (activeLoan) {
    throw new BadRequestError(
      'Client already has an active loan and cannot be renewed yet'
    );
  }

  const math = buildLoanMath(payload.amount);
  const expectedEndDate = new Date();
  expectedEndDate.setDate(expectedEndDate.getDate() + math.totalInstallments);

  const result = await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: previousLoan.id },
      data: { status: 'RENEWED' },
    });

    const newLoan = await tx.loan.create({
      data: {
        loanNumber: generateLoanNumber(),
        clientId: previousLoan.clientId,
        collectorId,
        renewedFromLoanId: previousLoan.id,
        principalAmount: math.principalAmount,
        interestRate: math.interestRate,
        totalAmount: math.totalAmount,
        installmentAmount: math.installmentAmount,
        totalInstallments: math.totalInstallments,
        paidInstallments: 0,
        paidAmount: 0,
        remainingAmount: math.totalAmount,
        overdueDays: 0,
        moraAmount: 0,
        status: 'ACTIVE',
        disbursedAt: new Date(),
        expectedEndDate,
      },
      select: {
        id: true,
        loanNumber: true,
        status: true,
        principalAmount: true,
        interestRate: true,
        totalAmount: true,
        paidAmount: true,
        remainingAmount: true,
        installmentAmount: true,
        totalInstallments: true,
        createdAt: true,
        disbursedAt: true,
        renewedFromLoanId: true,
      },
    });

    const installments = buildInstallments(
      newLoan.id,
      Number(newLoan.totalAmount),
      newLoan.totalInstallments
    );

    await tx.installment.createMany({
      data: installments,
    });

    await tx.client.update({
      where: { id: previousLoan.clientId },
      data: { lastContactAt: new Date() },
    });

    return newLoan;
  });

  return result;
}
