import { prisma } from '../../config/database';
import { ensureOpenShiftForToday } from '../collector/collector.shared';
import type { CreateExpenseInput } from './expenses.validation';

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function createForCollector(
  collectorId: string,
  payload: CreateExpenseInput
) {
  const shift = await ensureOpenShiftForToday(collectorId);
  const amount = roundMoney(payload.amount);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        userId: collectorId,
        shiftId: shift.id,
        category: payload.category.trim(),
        amount,
        description: payload.description?.trim() || null,
        createdAt: now,
      },
      select: {
        id: true,
        category: true,
        amount: true,
        description: true,
        createdAt: true,
      },
    });

    await tx.cashRegisterShift.update({
      where: { id: shift.id },
      data: {
        totalExpenses: {
          increment: amount,
        },
      },
    });

    return expense;
  });
}
