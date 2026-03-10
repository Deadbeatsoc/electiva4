import { LoanStatus, ShiftStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError } from '../../utils/errors';
import {
  getBusinessDateKey,
  getBusinessDateKey as getDateKeyFromDate,
  getDateKeyDaysAgo,
  getDayRangeByKey,
} from '../collector/collector.shared';
import type {
  PortfolioStatusQuery,
  ReportDateRangeQuery,
} from './reports.validation';

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseReportPeriod(query: ReportDateRangeQuery) {
  const to = query.to || getBusinessDateKey();
  const from = query.from || getDateKeyDaysAgo(6);

  if (from > to) {
    throw new BadRequestError('from date must be less than or equal to to date');
  }

  const fromRange = getDayRangeByKey(from);
  const toRange = getDayRangeByKey(to);

  return {
    from,
    to,
    startUtc: fromRange.startUtc,
    endUtcExclusive: toRange.endUtc,
  };
}

async function getCollectors(collectorId?: string) {
  const collectors = await prisma.user.findMany({
    where: {
      ...(collectorId ? { id: collectorId } : {}),
      role: { name: { equals: 'cobrador', mode: 'insensitive' } },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  });

  if (collectorId && collectors.length === 0) {
    throw new BadRequestError('Collector not found');
  }

  return collectors;
}

export async function listCollectors() {
  return getCollectors();
}

export async function getCollectionSummary(query: ReportDateRangeQuery) {
  const period = parseReportPeriod(query);
  const collectors = await getCollectors(query.collectorId);
  const collectorIds = collectors.map((collector) => collector.id);

  const [paymentsByCollector, expensesByCollector] = collectorIds.length
    ? await Promise.all([
        prisma.payment.groupBy({
          by: ['collectorId'],
          where: {
            collectorId: { in: collectorIds },
            paymentTimestamp: {
              gte: period.startUtc,
              lt: period.endUtcExclusive,
            },
          },
          _sum: { amount: true },
        }),
        prisma.expense.groupBy({
          by: ['userId'],
          where: {
            userId: { in: collectorIds },
            createdAt: {
              gte: period.startUtc,
              lt: period.endUtcExclusive,
            },
          },
          _sum: { amount: true },
        }),
      ])
    : [[], []];

  const paymentMap = new Map<string, number>();
  for (const row of paymentsByCollector) {
    paymentMap.set(row.collectorId, toNumber(row._sum.amount));
  }

  const expenseMap = new Map<string, number>();
  for (const row of expensesByCollector) {
    expenseMap.set(row.userId, toNumber(row._sum.amount));
  }

  const rows = collectors.map((collector) => {
    const totalCollected = paymentMap.get(collector.id) || 0;
    const totalExpenses = expenseMap.get(collector.id) || 0;
    return {
      collectorId: collector.id,
      collectorName: collector.name,
      collectorPhone: collector.phone,
      isActiveCollector: collector.isActive,
      totalCollected,
      totalExpenses,
      net: totalCollected - totalExpenses,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalCollected += row.totalCollected;
      acc.totalExpenses += row.totalExpenses;
      acc.net += row.net;
      return acc;
    },
    { totalCollected: 0, totalExpenses: 0, net: 0 }
  );

  return {
    period: {
      from: period.from,
      to: period.to,
    },
    totals,
    rows,
  };
}

export async function getPortfolioStatus(query: PortfolioStatusQuery) {
  await getCollectors(query.collectorId);

  const loans = await prisma.loan.findMany({
    where: {
      status: LoanStatus.ACTIVE,
      ...(query.collectorId ? { collectorId: query.collectorId } : {}),
    },
    select: {
      id: true,
      loanNumber: true,
      principalAmount: true,
      totalAmount: true,
      paidAmount: true,
      remainingAmount: true,
      disbursedAt: true,
      expectedEndDate: true,
      client: {
        select: {
          id: true,
          name: true,
          cedula: true,
          phone: true,
        },
      },
      collector: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: { disbursedAt: 'desc' },
  });

  const rows = loans.map((loan) => ({
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    collectorId: loan.collector.id,
    collectorName: loan.collector.name,
    collectorPhone: loan.collector.phone,
    clientId: loan.client.id,
    clientName: loan.client.name,
    clientCedula: loan.client.cedula,
    clientPhone: loan.client.phone,
    principalAmount: toNumber(loan.principalAmount),
    totalAmount: toNumber(loan.totalAmount),
    paidAmount: toNumber(loan.paidAmount),
    remainingAmount: toNumber(loan.remainingAmount),
    disbursedAt: loan.disbursedAt.toISOString(),
    expectedEndDate: loan.expectedEndDate.toISOString(),
    status: 'ACTIVE',
  }));

  const totals = rows.reduce(
    (acc, row) => {
      acc.activeLoans += 1;
      acc.totalPrincipal += row.principalAmount;
      acc.totalPaid += row.paidAmount;
      acc.totalRemaining += row.remainingAmount;
      return acc;
    },
    {
      activeLoans: 0,
      totalPrincipal: 0,
      totalPaid: 0,
      totalRemaining: 0,
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    totals,
    rows,
  };
}

export async function getMovementHistory(query: ReportDateRangeQuery) {
  const period = parseReportPeriod(query);
  await getCollectors(query.collectorId);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        ...(query.collectorId ? { collectorId: query.collectorId } : {}),
        paymentTimestamp: {
          gte: period.startUtc,
          lt: period.endUtcExclusive,
        },
      },
      select: {
        id: true,
        amount: true,
        paymentTimestamp: true,
        collector: {
          select: {
            id: true,
            name: true,
          },
        },
        loan: {
          select: {
            id: true,
            loanNumber: true,
            client: {
              select: {
                id: true,
                name: true,
                cedula: true,
              },
            },
          },
        },
      },
      orderBy: { paymentTimestamp: 'desc' },
    }),
    prisma.expense.findMany({
      where: {
        ...(query.collectorId ? { userId: query.collectorId } : {}),
        createdAt: {
          gte: period.startUtc,
          lt: period.endUtcExclusive,
        },
      },
      select: {
        id: true,
        category: true,
        amount: true,
        description: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const paymentRows = payments.map((payment) => ({
    id: `PAY-${payment.id}`,
    movementId: payment.id,
    type: 'PAYMENT' as const,
    collectorId: payment.collector.id,
    collectorName: payment.collector.name,
    amount: toNumber(payment.amount),
    timestamp: payment.paymentTimestamp.toISOString(),
    clientName: payment.loan.client.name,
    clientCedula: payment.loan.client.cedula,
    loanNumber: payment.loan.loanNumber,
    category: null,
    description: `Cobro de prestamo ${payment.loan.loanNumber}`,
  }));

  const expenseRows = expenses.map((expense) => ({
    id: `EXP-${expense.id}`,
    movementId: expense.id,
    type: 'EXPENSE' as const,
    collectorId: expense.user.id,
    collectorName: expense.user.name,
    amount: toNumber(expense.amount),
    timestamp: expense.createdAt.toISOString(),
    clientName: null,
    clientCedula: null,
    loanNumber: null,
    category: expense.category,
    description: expense.description || null,
  }));

  const rows = [...paymentRows, ...expenseRows].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const totals = rows.reduce(
    (acc, row) => {
      if (row.type === 'PAYMENT') acc.totalCollected += row.amount;
      if (row.type === 'EXPENSE') acc.totalExpenses += row.amount;
      acc.net = acc.totalCollected - acc.totalExpenses;
      return acc;
    },
    {
      movementsCount: rows.length,
      totalCollected: 0,
      totalExpenses: 0,
      net: 0,
    }
  );

  return {
    period: {
      from: period.from,
      to: period.to,
    },
    totals,
    rows,
  };
}

export async function getCashClosures(query: ReportDateRangeQuery) {
  const period = parseReportPeriod(query);
  await getCollectors(query.collectorId);

  const shifts = await prisma.cashRegisterShift.findMany({
    where: {
      ...(query.collectorId ? { userId: query.collectorId } : {}),
      status: { in: [ShiftStatus.CLOSED, ShiftStatus.AUTO_CLOSED] },
      closedAt: {
        gte: period.startUtc,
        lt: period.endUtcExclusive,
      },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      openedAt: true,
      closedAt: true,
      totalCollected: true,
      totalExpenses: true,
      finalAmount: true,
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: { closedAt: 'desc' },
  });

  const rows = shifts.map((shift) => ({
    shiftId: shift.id,
    collectorId: shift.user.id,
    collectorName: shift.user.name,
    collectorPhone: shift.user.phone,
    businessDate: getDateKeyFromDate(shift.openedAt),
    status: shift.status,
    isAutoClosed: shift.status === ShiftStatus.AUTO_CLOSED,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    totalCollected: toNumber(shift.totalCollected),
    totalExpenses: toNumber(shift.totalExpenses),
    net: toNumber(shift.finalAmount),
  }));

  const totals = rows.reduce(
    (acc, row) => {
      acc.closuresCount += 1;
      if (row.isAutoClosed) acc.autoClosures += 1;
      else acc.manualClosures += 1;
      acc.totalCollected += row.totalCollected;
      acc.totalExpenses += row.totalExpenses;
      acc.totalNet += row.net;
      return acc;
    },
    {
      closuresCount: 0,
      manualClosures: 0,
      autoClosures: 0,
      totalCollected: 0,
      totalExpenses: 0,
      totalNet: 0,
    }
  );

  return {
    period: {
      from: period.from,
      to: period.to,
    },
    totals,
    rows,
  };
}
