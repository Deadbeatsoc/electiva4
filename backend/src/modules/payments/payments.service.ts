import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { ensureOpenShiftForToday } from '../collector/collector.shared';
import type { CreatePaymentInput } from './payments.validation';

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function createForCollector(
  collectorId: string,
  payload: CreatePaymentInput
) {
  const shift = await ensureOpenShiftForToday(collectorId);
  const amount = roundMoney(payload.amount);

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({
      where: {
        id: payload.loanId,
        collectorId,
        status: 'ACTIVE',
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
        installments: {
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!loan) {
      throw new NotFoundError('Active loan not found');
    }

    const remaining = toNumber(loan.remainingAmount);
    if (amount > remaining) {
      throw new BadRequestError(
        'Payment amount cannot exceed remaining loan balance'
      );
    }

    let paymentRemainder = amount;
    const now = new Date();
    let createdPaymentCount = 0;

    const payableInstallments = loan.installments.filter(
      (installment) => installment.status !== 'PAID'
    );

    if (payableInstallments.length === 0) {
      throw new BadRequestError('No pending installments available for this loan');
    }

    for (const installment of payableInstallments) {
      if (paymentRemainder <= 0) break;

      const installmentAmount = toNumber(installment.amount);
      const currentPaid = toNumber(installment.paidAmount);
      const pendingForInstallment = roundMoney(installmentAmount - currentPaid);

      if (pendingForInstallment <= 0) continue;

      const applied = roundMoney(Math.min(paymentRemainder, pendingForInstallment));
      if (applied <= 0) continue;

      const updatedPaid = roundMoney(currentPaid + applied);
      const isFullyPaid = updatedPaid >= installmentAmount;

      await tx.installment.update({
        where: { id: installment.id },
        data: {
          paidAmount: updatedPaid,
          status: isFullyPaid ? 'PAID' : 'PARTIAL',
          paidAt: isFullyPaid ? now : null,
        },
      });

      await tx.payment.create({
        data: {
          loanId: loan.id,
          installmentId: installment.id,
          collectorId,
          shiftId: shift.id,
          amount: applied,
          moraAmount: 0,
          isLate: false,
          paymentTimestamp: now,
          createdAt: now,
        },
      });

      createdPaymentCount += 1;
      paymentRemainder = roundMoney(paymentRemainder - applied);
    }

    if (paymentRemainder > 0) {
      throw new BadRequestError(
        'Payment could not be fully applied to loan installments'
      );
    }

    const updatedPaidAmount = roundMoney(toNumber(loan.paidAmount) + amount);
    const newRemaining = roundMoney(toNumber(loan.totalAmount) - updatedPaidAmount);
    const newStatus = newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE';

    const paidInstallments = await tx.installment.count({
      where: {
        loanId: loan.id,
        status: 'PAID',
      },
    });

    const updatedLoan = await tx.loan.update({
      where: { id: loan.id },
      data: {
        paidAmount: updatedPaidAmount,
        remainingAmount: newRemaining <= 0 ? 0 : newRemaining,
        status: newStatus,
        paidInstallments,
      },
      select: {
        id: true,
        loanNumber: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
        remainingAmount: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await tx.client.update({
      where: { id: loan.client.id },
      data: { lastContactAt: now },
    });

    await tx.cashRegisterShift.update({
      where: { id: shift.id },
      data: {
        totalCollected: {
          increment: amount,
        },
      },
    });

    return {
      loan: updatedLoan,
      appliedAmount: amount,
      splitPayments: createdPaymentCount,
      completed: updatedLoan.status === 'COMPLETED',
      timestamp: now.toISOString(),
    };
  });
}
