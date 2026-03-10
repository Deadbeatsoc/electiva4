import { Prisma, PrismaClient, ShiftStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError } from '../../utils/errors';

const BOGOTA_UTC_OFFSET_HOURS = 5;
export const BUSINESS_TIMEZONE = 'America/Bogota';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface DayRange {
  dateKey: string;
  startUtc: Date;
  endUtc: Date;
}

export function getBusinessDateKey(reference = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(reference);
}

export function getDayRangeByKey(dateKey: string): DayRange {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const startUtc = new Date(
    Date.UTC(year, month - 1, day, BOGOTA_UTC_OFFSET_HOURS, 0, 0, 0)
  );
  const endUtc = new Date(
    Date.UTC(year, month - 1, day + 1, BOGOTA_UTC_OFFSET_HOURS, 0, 0, 0)
  );

  return {
    dateKey,
    startUtc,
    endUtc,
  };
}

export function getDayRange(reference = new Date()): DayRange {
  return getDayRangeByKey(getBusinessDateKey(reference));
}

export function getDateKeyDaysAgo(days: number, reference = new Date()): string {
  const date = new Date(reference);
  date.setUTCDate(date.getUTCDate() - days);
  return getBusinessDateKey(date);
}

export async function findShiftForDate(
  collectorId: string,
  dateKey: string,
  db: DbClient = prisma
) {
  const range = getDayRangeByKey(dateKey);

  return db.cashRegisterShift.findFirst({
    where: {
      userId: collectorId,
      openedAt: {
        gte: range.startUtc,
        lt: range.endUtc,
      },
    },
    orderBy: { openedAt: 'desc' },
  });
}

async function calculateShiftTotalsById(
  shiftId: string,
  db: DbClient = prisma
): Promise<{ totalCollected: number; totalExpenses: number }> {
  const [paymentsAgg, expensesAgg] = await Promise.all([
    db.payment.aggregate({
      _sum: { amount: true },
      where: { shiftId },
    }),
    db.expense.aggregate({
      _sum: { amount: true },
      where: { shiftId },
    }),
  ]);

  return {
    totalCollected: Number(paymentsAgg._sum.amount || 0),
    totalExpenses: Number(expensesAgg._sum.amount || 0),
  };
}

async function closeShift(
  shiftId: string,
  status: ShiftStatus,
  db: DbClient = prisma
) {
  const totals = await calculateShiftTotalsById(shiftId, db);

  return db.cashRegisterShift.update({
    where: { id: shiftId },
    data: {
      totalCollected: totals.totalCollected,
      totalExpenses: totals.totalExpenses,
      finalAmount: totals.totalCollected - totals.totalExpenses,
      status,
      closedAt: new Date(),
    },
  });
}

export async function autoCloseStaleOpenShiftsForCollector(
  collectorId: string,
  db: DbClient = prisma
) {
  const today = getDayRange();
  const staleShifts = await db.cashRegisterShift.findMany({
    where: {
      userId: collectorId,
      status: 'OPEN',
      openedAt: {
        lt: today.startUtc,
      },
    },
    select: { id: true },
  });

  for (const shift of staleShifts) {
    await closeShift(shift.id, 'AUTO_CLOSED', db);
  }
}

export async function ensureOpenShiftForToday(
  collectorId: string,
  db: DbClient = prisma
) {
  await autoCloseStaleOpenShiftsForCollector(collectorId, db);

  const todayKey = getBusinessDateKey();
  const existingShift = await findShiftForDate(collectorId, todayKey, db);

  if (!existingShift) {
    return db.cashRegisterShift.create({
      data: {
        userId: collectorId,
        openedAt: new Date(),
        initialAmount: 0,
        totalCollected: 0,
        totalExpenses: 0,
        status: 'OPEN',
      },
    });
  }

  if (existingShift.status !== 'OPEN') {
    throw new BadRequestError(
      'Cash register is already closed for today'
    );
  }

  return existingShift;
}

export async function closeCurrentShiftForCollector(
  collectorId: string,
  status: ShiftStatus,
  db: DbClient = prisma
) {
  const shift = await ensureOpenShiftForToday(collectorId, db);
  return closeShift(shift.id, status, db);
}
