import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import {
  BUSINESS_TIMEZONE,
  closeCurrentShiftForCollector,
  findShiftForDate,
  getBusinessDateKey,
  getDateKeyDaysAgo,
  getDayRange,
  getDayRangeByKey,
} from './collector.shared';

interface MovementItem {
  id: string;
  type: 'PAYMENT' | 'EXPENSE';
  amount: number;
  timestamp: Date;
  description: string | null;
  category: string | null;
  clientName: string | null;
  loanNumber: string | null;
}

async function getDailyTotals(collectorId: string, dateKey: string) {
  const range = getDayRangeByKey(dateKey);

  const [paymentsAgg, expensesAgg] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        collectorId,
        paymentTimestamp: {
          gte: range.startUtc,
          lt: range.endUtc,
        },
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId: collectorId,
        createdAt: {
          gte: range.startUtc,
          lt: range.endUtc,
        },
      },
    }),
  ]);

  const totalCollected = Number(paymentsAgg._sum.amount || 0);
  const totalExpenses = Number(expensesAgg._sum.amount || 0);

  return {
    totalCollected,
    totalExpenses,
    net: totalCollected - totalExpenses,
  };
}

async function getDailyMovements(collectorId: string, dateKey: string): Promise<MovementItem[]> {
  const range = getDayRangeByKey(dateKey);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        collectorId,
        paymentTimestamp: {
          gte: range.startUtc,
          lt: range.endUtc,
        },
      },
      select: {
        id: true,
        amount: true,
        paymentTimestamp: true,
        loan: {
          select: {
            loanNumber: true,
            client: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { paymentTimestamp: 'desc' },
    }),
    prisma.expense.findMany({
      where: {
        userId: collectorId,
        createdAt: {
          gte: range.startUtc,
          lt: range.endUtc,
        },
      },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const paymentMovements: MovementItem[] = payments.map((payment) => ({
    id: payment.id,
    type: 'PAYMENT',
    amount: Number(payment.amount),
    timestamp: payment.paymentTimestamp,
    description: 'Cobro registrado',
    category: null,
    clientName: payment.loan.client.name,
    loanNumber: payment.loan.loanNumber,
  }));

  const expenseMovements: MovementItem[] = expenses.map((expense) => ({
    id: expense.id,
    type: 'EXPENSE',
    amount: Number(expense.amount),
    timestamp: expense.createdAt,
    description: expense.description || null,
    category: expense.category,
    clientName: null,
    loanNumber: null,
  }));

  return [...paymentMovements, ...expenseMovements].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

async function getAdminUsers() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      role: { name: { equals: 'admin', mode: 'insensitive' } },
    },
    select: { id: true },
  });
}

async function notifyAdmins(type: 'INACTIVITY' | 'AUTO_CLOSED', message: string, title: string) {
  const admins = await getAdminUsers();
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: type === 'INACTIVITY' ? 'INACTIVITY' : 'INFO',
      title,
      message,
      isRead: false,
    })),
  });
}

async function getShiftTotals(shiftId: string) {
  const [paymentsAgg, expensesAgg] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { shiftId },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { shiftId },
    }),
  ]);

  const totalCollected = Number(paymentsAgg._sum.amount || 0);
  const totalExpenses = Number(expensesAgg._sum.amount || 0);

  return {
    totalCollected,
    totalExpenses,
    finalAmount: totalCollected - totalExpenses,
  };
}

async function closeShiftAsAutoAndNotify(shift: {
  id: string;
  openedAt: Date;
  user: {
    id: string;
    name: string;
  };
}) {
  const totals = await getShiftTotals(shift.id);
  const closed = await prisma.cashRegisterShift.update({
    where: { id: shift.id },
    data: {
      status: 'AUTO_CLOSED',
      closedAt: new Date(),
      totalCollected: totals.totalCollected,
      totalExpenses: totals.totalExpenses,
      finalAmount: totals.finalAmount,
    },
  });

  const dateKey = getBusinessDateKey(closed.openedAt);
  const messageRef = `[autoclose:${closed.id}]`;
  const existing = await prisma.notification.findFirst({
    where: {
      type: 'INFO',
      message: { contains: messageRef },
    },
    select: { id: true },
  });

  if (!existing) {
    await notifyAdmins(
      'AUTO_CLOSED',
      `Se realizo cierre automatico para ${shift.user.name} (${dateKey}) ${messageRef}`,
      'Cierre automatico de caja'
    );
  }
}

export async function registerCollectorActivity(
  collectorId: string,
  action: string,
  module = 'collector',
  entityId?: string
) {
  await prisma.auditLog.create({
    data: {
      userId: collectorId,
      module,
      action,
      entityId: entityId || null,
      timestamp: new Date(),
    },
  });
}

export async function getDayOverview(collectorId: string) {
  const todayKey = getBusinessDateKey();
  const todayShift = await findShiftForDate(collectorId, todayKey);
  const totals = await getDailyTotals(collectorId, todayKey);
  const movements = await getDailyMovements(collectorId, todayKey);

  const previousDayKey = getDateKeyDaysAgo(1);
  const previousShift = await findShiftForDate(collectorId, previousDayKey);

  return {
    businessDate: todayKey,
    timezone: BUSINESS_TIMEZONE,
    summary: {
      totalCollected: totals.totalCollected,
      totalExpenses: totals.totalExpenses,
      net: totals.net,
      shiftStatus: todayShift?.status || 'NOT_OPENED',
      closedAt: todayShift?.closedAt || null,
    },
    previousClosure: previousShift
      ? {
          businessDate: previousDayKey,
          status: previousShift.status,
          totalCollected: Number(previousShift.totalCollected),
          totalExpenses: Number(previousShift.totalExpenses),
          net: Number(previousShift.finalAmount || 0),
          closedAt: previousShift.closedAt,
          isAutoClosed: previousShift.status === 'AUTO_CLOSED',
        }
      : null,
    movements: movements.map((item) => ({
      ...item,
      timestamp: item.timestamp.toISOString(),
    })),
  };
}

export async function closeCashForToday(collectorId: string) {
  const closedShift = await closeCurrentShiftForCollector(collectorId, 'CLOSED');
  const businessDate = getBusinessDateKey(closedShift.openedAt);

  return {
    shiftId: closedShift.id,
    businessDate,
    status: closedShift.status,
    totalCollected: Number(closedShift.totalCollected),
    totalExpenses: Number(closedShift.totalExpenses),
    net: Number(closedShift.finalAmount || 0),
    closedAt: closedShift.closedAt,
  };
}

export async function autoCloseExpiredShifts() {
  const today = getDayRange();
  const openShifts = await prisma.cashRegisterShift.findMany({
    where: {
      status: 'OPEN',
      openedAt: {
        lt: today.startUtc,
      },
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  for (const shift of openShifts) {
    await closeShiftAsAutoAndNotify(shift);
  }
}

export async function autoCloseTodayOpenShifts(dateKey = getBusinessDateKey()) {
  const range = getDayRangeByKey(dateKey);
  const openShifts = await prisma.cashRegisterShift.findMany({
    where: {
      status: 'OPEN',
      openedAt: {
        gte: range.startUtc,
        lt: range.endUtc,
      },
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  for (const shift of openShifts) {
    await closeShiftAsAutoAndNotify(shift);
  }
}

export async function processCollectorInactivityAlerts() {
  const now = new Date();
  const todayRange = getDayRange(now);
  const dateKey = todayRange.dateKey;

  const startOfControl = new Date(todayRange.startUtc);
  startOfControl.setUTCHours(13, 0, 0, 0); // 08:00 in Bogota

  if (now < startOfControl) {
    return;
  }

  const openTodayShifts = await prisma.cashRegisterShift.findMany({
    where: {
      status: 'OPEN',
      openedAt: {
        gte: todayRange.startUtc,
        lt: todayRange.endUtc,
      },
      user: {
        isActive: true,
        role: { name: { equals: 'cobrador', mode: 'insensitive' } },
      },
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  for (const shift of openTodayShifts) {
    const lastActivity = await prisma.auditLog.findFirst({
      where: {
        userId: shift.user.id,
        timestamp: {
          gte: startOfControl,
        },
      },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    const reference = lastActivity?.timestamp || startOfControl;
    const inactiveMs = now.getTime() - reference.getTime();

    if (inactiveMs < 3 * 60 * 60 * 1000) {
      continue;
    }

    const ref = `[inactivity:${shift.user.id}:${dateKey}]`;
    const existing = await prisma.notification.findFirst({
      where: {
        type: 'INACTIVITY',
        message: { contains: ref },
      },
      select: { id: true },
    });

    if (!existing) {
      await notifyAdmins(
        'INACTIVITY',
        `El cobrador ${shift.user.name} supera 3 horas sin actividad ${ref}`,
        'Alerta de inactividad de cobrador'
      );
    }
  }
}

export async function getCollectorByIdOrFail(collectorId: string) {
  const collector = await prisma.user.findFirst({
    where: {
      id: collectorId,
      isActive: true,
      role: { name: { equals: 'cobrador', mode: 'insensitive' } },
    },
    select: { id: true },
  });

  if (!collector) {
    throw new NotFoundError('Collector user not found');
  }

  return collector;
}
