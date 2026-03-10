import { prisma } from '../../config/database';
import { getBusinessDateKey, getDayRange } from '../collector/collector.shared';

const INACTIVITY_THRESHOLD_MS = 3 * 60 * 60 * 1000;
const CONTROL_START_UTC_HOUR = 13; // 08:00 America/Bogota

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function buildControlStart(dayStartUtc: Date): Date {
  const controlStart = new Date(dayStartUtc);
  controlStart.setUTCHours(CONTROL_START_UTC_HOUR, 0, 0, 0);
  return controlStart;
}

function parseInactivityReference(message: string) {
  const match = message.match(/\[inactivity:([^\]:]+):([^\]]+)\]/);
  return {
    ref: match?.[0] || message,
    collectorId: match?.[1] || null,
  };
}

export async function getOverview() {
  const now = new Date();
  const today = getDayRange(now);
  const controlStart = buildControlStart(today.startUtc);
  const businessDate = getBusinessDateKey(now);

  const [todayCollectedAgg, activePortfolioAgg, activeClientsCount, collectors] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          paymentTimestamp: {
            gte: today.startUtc,
            lt: today.endUtc,
          },
        },
      }),
      prisma.loan.aggregate({
        _sum: { remainingAmount: true },
        where: { status: 'ACTIVE' },
      }),
      prisma.client.count({
        where: { isActive: true },
      }),
      prisma.user.findMany({
        where: {
          role: { name: { equals: 'cobrador', mode: 'insensitive' } },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

  const collectorIds = collectors.map((collector) => collector.id);

  const [
    paymentsByCollector,
    expensesByCollector,
    shiftsToday,
    lastAuditOverall,
    lastAuditDuringControl,
    lastPaymentOverall,
    lastExpenseOverall,
    unreadInactivityNotificationsRaw,
  ] = collectorIds.length
    ? await Promise.all([
        prisma.payment.groupBy({
          by: ['collectorId'],
          where: {
            collectorId: { in: collectorIds },
            paymentTimestamp: {
              gte: today.startUtc,
              lt: today.endUtc,
            },
          },
          _sum: { amount: true },
        }),
        prisma.expense.groupBy({
          by: ['userId'],
          where: {
            userId: { in: collectorIds },
            createdAt: {
              gte: today.startUtc,
              lt: today.endUtc,
            },
          },
          _sum: { amount: true },
        }),
        prisma.cashRegisterShift.findMany({
          where: {
            userId: { in: collectorIds },
            openedAt: {
              gte: today.startUtc,
              lt: today.endUtc,
            },
          },
          select: {
            id: true,
            userId: true,
            status: true,
            openedAt: true,
            closedAt: true,
          },
          orderBy: { openedAt: 'desc' },
        }),
        prisma.auditLog.groupBy({
          by: ['userId'],
          where: {
            userId: { in: collectorIds },
          },
          _max: { timestamp: true },
        }),
        prisma.auditLog.groupBy({
          by: ['userId'],
          where: {
            userId: { in: collectorIds },
            timestamp: {
              gte: controlStart,
            },
          },
          _max: { timestamp: true },
        }),
        prisma.payment.groupBy({
          by: ['collectorId'],
          where: {
            collectorId: { in: collectorIds },
          },
          _max: { paymentTimestamp: true },
        }),
        prisma.expense.groupBy({
          by: ['userId'],
          where: {
            userId: { in: collectorIds },
          },
          _max: { createdAt: true },
        }),
        prisma.notification.findMany({
          where: {
            type: 'INACTIVITY',
            isRead: false,
          },
          select: {
            id: true,
            title: true,
            message: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 250,
        }),
      ])
    : [
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
      ];

  const collectedMap = new Map<string, number>();
  for (const row of paymentsByCollector) {
    collectedMap.set(row.collectorId, toNumber(row._sum.amount));
  }

  const expensesMap = new Map<string, number>();
  for (const row of expensesByCollector) {
    expensesMap.set(row.userId, toNumber(row._sum.amount));
  }

  const shiftByCollector = new Map<string, (typeof shiftsToday)[number]>();
  for (const shift of shiftsToday) {
    if (!shiftByCollector.has(shift.userId)) {
      shiftByCollector.set(shift.userId, shift);
    }
  }

  const lastAuditMap = new Map<string, Date | null>();
  for (const row of lastAuditOverall) {
    lastAuditMap.set(row.userId || '', row._max.timestamp || null);
  }

  const lastAuditControlMap = new Map<string, Date | null>();
  for (const row of lastAuditDuringControl) {
    lastAuditControlMap.set(row.userId || '', row._max.timestamp || null);
  }

  const lastPaymentMap = new Map<string, Date | null>();
  for (const row of lastPaymentOverall) {
    lastPaymentMap.set(row.collectorId, row._max.paymentTimestamp || null);
  }

  const lastExpenseMap = new Map<string, Date | null>();
  for (const row of lastExpenseOverall) {
    lastExpenseMap.set(row.userId, row._max.createdAt || null);
  }

  const unreadAlertMap = new Map<
    string,
    {
      id: string;
      title: string;
      message: string;
      createdAt: Date;
      collectorId: string | null;
    }
  >();

  for (const notification of unreadInactivityNotificationsRaw) {
    const parsed = parseInactivityReference(notification.message);
    if (!unreadAlertMap.has(parsed.ref)) {
      unreadAlertMap.set(parsed.ref, {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
        collectorId: parsed.collectorId,
      });
    }
  }

  const unreadAlerts = Array.from(unreadAlertMap.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const unreadAlertCountByCollector = new Map<string, number>();
  for (const alert of unreadAlerts) {
    if (!alert.collectorId) continue;
    const count = unreadAlertCountByCollector.get(alert.collectorId) || 0;
    unreadAlertCountByCollector.set(alert.collectorId, count + 1);
  }

  const collectorsStatus = collectors
    .map((collector) => {
      const collectedToday = collectedMap.get(collector.id) || 0;
      const expensesToday = expensesMap.get(collector.id) || 0;
      const netToday = collectedToday - expensesToday;
      const shift = shiftByCollector.get(collector.id);
      const shiftStatus = shift?.status || 'NOT_OPENED';
      const hasClosedCash = shiftStatus === 'CLOSED' || shiftStatus === 'AUTO_CLOSED';

      const candidateDates = [
        lastAuditMap.get(collector.id) || null,
        lastPaymentMap.get(collector.id) || null,
        lastExpenseMap.get(collector.id) || null,
      ].filter((value): value is Date => value instanceof Date);

      const lastMovementAt =
        candidateDates.length > 0
          ? new Date(
              Math.max(...candidateDates.map((candidate) => candidate.getTime()))
            )
          : null;

      let hoursWithoutActivity = 0;
      let isInactive = false;

      const inactivityApplies =
        collector.isActive && shiftStatus === 'OPEN' && now >= controlStart;

      if (inactivityApplies) {
        const lastControlActivity = lastAuditControlMap.get(collector.id) || controlStart;
        const inactiveMs = now.getTime() - lastControlActivity.getTime();
        hoursWithoutActivity = Number((inactiveMs / (60 * 60 * 1000)).toFixed(1));
        isInactive = inactiveMs >= INACTIVITY_THRESHOLD_MS;
      }

      return {
        id: collector.id,
        name: collector.name,
        phone: collector.phone,
        isActiveUser: collector.isActive,
        totalCollectedToday: collectedToday,
        totalExpensesToday: expensesToday,
        netToday,
        lastMovementAt: lastMovementAt ? lastMovementAt.toISOString() : null,
        shiftStatus,
        hasClosedCash,
        shiftClosedAt: shift?.closedAt ? shift.closedAt.toISOString() : null,
        hoursWithoutActivity,
        isInactive,
        unreadInactivityAlerts: unreadAlertCountByCollector.get(collector.id) || 0,
      };
    })
    .sort((a, b) => {
      if (a.isInactive !== b.isInactive) {
        return a.isInactive ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'es');
    });

  return {
    generatedAt: now.toISOString(),
    businessDate,
    kpis: {
      totalCollectedToday: toNumber(todayCollectedAgg._sum.amount),
      activePortfolioTotal: toNumber(activePortfolioAgg._sum.remainingAmount),
      activeClientsTotal: activeClientsCount,
      activeCollectors: collectors.filter((collector) => collector.isActive).length,
    },
    collectors: collectorsStatus,
    unreadInactivityAlerts: {
      total: unreadAlerts.length,
      items: unreadAlerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
      })),
    },
    inactivityThresholdHours: 3,
    controlWindowStart: controlStart.toISOString(),
  };
}
