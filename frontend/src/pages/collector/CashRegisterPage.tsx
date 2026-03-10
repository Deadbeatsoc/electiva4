import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  Clock3,
  Loader2,
  ReceiptText,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  collectorService,
  type CloseCashResult,
  type CollectorDayOverview,
  type CollectorMovement,
  type ShiftStatus,
} from '../../services/collector.service';
import { expensesService } from '../../services/expenses.service';

const expenseSchema = z.object({
  category: z.string().min(2, 'La categoria es requerida'),
  amount: z.number().positive('El monto debe ser mayor a cero'),
  description: z
    .string()
    .max(500, 'La descripcion no puede superar 500 caracteres')
    .optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

function toAmount(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(toAmount(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function statusLabel(status: ShiftStatus) {
  if (status === 'OPEN') return 'Caja abierta';
  if (status === 'CLOSED') return 'Caja cerrada manualmente';
  if (status === 'AUTO_CLOSED') return 'Caja cerrada automaticamente';
  return 'Caja aun no iniciada';
}

function statusClass(status: ShiftStatus) {
  if (status === 'OPEN') return 'bg-green-100 text-green-700';
  if (status === 'CLOSED') return 'bg-blue-100 text-blue-700';
  if (status === 'AUTO_CLOSED') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-700';
}

function canOperateShift(status: ShiftStatus) {
  return status !== 'CLOSED' && status !== 'AUTO_CLOSED';
}

function movementTitle(movement: CollectorMovement) {
  if (movement.type === 'PAYMENT') {
    return `Cobro de ${movement.clientName || 'cliente'} (${movement.loanNumber || 'sin prestamo'})`;
  }
  return movement.category ? `Gasto: ${movement.category}` : 'Gasto registrado';
}

export default function CashRegisterPage() {
  const queryClient = useQueryClient();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ['collector', 'day-overview'],
    queryFn: async () => {
      const response = await collectorService.getDayOverview();
      return response.data.data as CollectorDayOverview;
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (payload: ExpenseFormData) => expensesService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collector', 'day-overview'] });
      toast.success('Gasto registrado correctamente');
      setIsExpenseModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'No se pudo registrar el gasto');
    },
  });

  const closeCashMutation = useMutation({
    mutationFn: async () => {
      const response = await collectorService.closeCash();
      return response.data.data as CloseCashResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['collector', 'day-overview'] });
      toast.success(`Caja cerrada (${formatCurrency(result.net)} neto del dia)`);
      setIsCloseModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'No se pudo cerrar la caja');
    },
  });

  const overview = overviewQuery.data;
  const summary = overview?.summary;
  const shiftStatus: ShiftStatus = summary?.shiftStatus || 'NOT_OPENED';
  const allowOperations = canOperateShift(shiftStatus);
  const shouldShowPreviousDayNotice =
    shiftStatus === 'NOT_OPENED' && !!overview?.previousClosure;

  if (overviewQuery.isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 size={20} className="animate-spin" />
          Cargando resumen de caja...
        </div>
      </div>
    );
  }

  if (!overview || !summary) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-red-700">
          No se pudo cargar el resumen diario del cobrador.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <Wallet size={28} className="text-blue-600" />
            Resumen del dia
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Fecha operativa: {overview.businessDate} ({overview.timezone})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/payments"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <ArrowUpCircle size={16} />
            Registrar cobro
          </Link>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            disabled={!allowOperations}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowDownCircle size={16} />
            Registrar gasto
          </button>
          <button
            onClick={() => setIsCloseModalOpen(true)}
            disabled={!allowOperations}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ClipboardCheck size={16} />
            Cerrar caja
          </button>
        </div>
      </div>

      {!allowOperations && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          La caja de hoy ya fue cerrada. Para registrar nuevos movimientos debes esperar
          al siguiente dia.
        </div>
      )}

      {shouldShowPreviousDayNotice && overview.previousClosure && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          Antes de iniciar el dia nuevo, revisa el cierre anterior ({overview.previousClosure.businessDate}):
          neto {formatCurrency(overview.previousClosure.net)} (
          {overview.previousClosure.isAutoClosed ? 'automatico' : 'manual'}).
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Cobrado hoy"
          value={formatCurrency(summary.totalCollected)}
          icon={<ArrowUpCircle size={18} />}
          tone="green"
        />
        <StatCard
          title="Gastos hoy"
          value={formatCurrency(summary.totalExpenses)}
          icon={<ArrowDownCircle size={18} />}
          tone="red"
        />
        <StatCard
          title="Neto del dia"
          value={formatCurrency(summary.net)}
          icon={<Wallet size={18} />}
          tone="blue"
        />
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Estado caja
          </p>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
              shiftStatus
            )}`}
          >
            {statusLabel(shiftStatus)}
          </span>
          <p className="mt-2 text-xs text-gray-500">
            Cierre: {formatDateTime(summary.closedAt)}
          </p>
        </div>
      </div>

      {overview.previousClosure && (
        <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-indigo-800">
            <Clock3 size={16} />
            <p className="text-sm font-semibold">
              Cierre del dia anterior ({overview.previousClosure.businessDate})
            </p>
          </div>
          <p className="text-sm text-indigo-700">
            {overview.previousClosure.isAutoClosed
              ? 'Cierre automatico por sistema'
              : 'Cierre manual realizado por cobrador'}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <p className="text-indigo-800">
              Cobrado: {formatCurrency(overview.previousClosure.totalCollected)}
            </p>
            <p className="text-indigo-800">
              Gastos: {formatCurrency(overview.previousClosure.totalExpenses)}
            </p>
            <p className="font-semibold text-indigo-900">
              Neto: {formatCurrency(overview.previousClosure.net)}
            </p>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <ReceiptText size={18} />
            Movimientos del dia
          </h2>
          <p className="text-sm text-gray-500">
            Neto actual: <strong className="text-gray-800">{formatCurrency(summary.net)}</strong>
          </p>
        </div>
        {overview.movements.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            Aun no hay cobros ni gastos registrados hoy.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {overview.movements.map((movement) => (
              <li key={`${movement.type}-${movement.id}`} className="px-5 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {movementTitle(movement)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatDateTime(movement.timestamp)}
                      {movement.description ? ` - ${movement.description}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        movement.type === 'PAYMENT'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {movement.type === 'PAYMENT' ? 'Cobro' : 'Gasto'}
                    </span>
                    <p
                      className={`text-sm font-semibold ${
                        movement.type === 'PAYMENT' ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {movement.type === 'PAYMENT' ? '+' : '-'}
                      {formatCurrency(movement.amount)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isExpenseModalOpen && (
        <ExpenseModal
          isSubmitting={createExpenseMutation.isPending}
          onClose={() => setIsExpenseModalOpen(false)}
          onSubmit={(values) => createExpenseMutation.mutate(values)}
        />
      )}

      {isCloseModalOpen && (
        <CloseCashModal
          isSubmitting={closeCashMutation.isPending}
          summary={summary}
          onConfirm={() => closeCashMutation.mutate()}
          onClose={() => setIsCloseModalOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone: 'green' | 'red' | 'blue';
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-green-100 text-green-700'
      : tone === 'red'
      ? 'bg-red-100 text-red-700'
      : 'bg-blue-100 text-blue-700';

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-gray-900">{value}</p>
        <span className={`rounded-lg p-2 ${toneClass}`}>{icon}</span>
      </div>
    </div>
  );
}

function ExpenseModal({
  isSubmitting,
  onClose,
  onSubmit,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseFormData) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema as any),
    defaultValues: {
      category: '',
      amount: 0,
      description: '',
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Registrar gasto</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
            <input
              type="text"
              {...register('category')}
              placeholder="Ej: Gasolina"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.category && (
              <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Monto</label>
            <input
              type="number"
              step="1000"
              min="1"
              {...register('amount', { valueAsNumber: true })}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.amount ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Descripcion (opcional)
            </label>
            <textarea
              rows={3}
              {...register('description')}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar gasto'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseCashModal({
  isSubmitting,
  summary,
  onConfirm,
  onClose,
}: {
  isSubmitting: boolean;
  summary: CollectorDayOverview['summary'];
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2 text-amber-600">
          <AlertTriangle size={18} />
          <h2 className="text-lg font-semibold text-gray-800">Confirmar cierre de caja</h2>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="mb-1 flex items-center justify-between text-gray-700">
            <span>Total cobrado</span>
            <strong>{formatCurrency(summary.totalCollected)}</strong>
          </p>
          <p className="mb-1 flex items-center justify-between text-gray-700">
            <span>Total gastos</span>
            <strong>{formatCurrency(summary.totalExpenses)}</strong>
          </p>
          <p className="flex items-center justify-between border-t border-gray-200 pt-2 text-gray-800">
            <span>Neto del dia</span>
            <strong>{formatCurrency(summary.net)}</strong>
          </p>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          Esta accion cerrara tu caja del dia. Despues no podras registrar nuevos cobros ni
          gastos hasta el siguiente dia.
        </p>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Cerrando...
              </>
            ) : (
              'Confirmar cierre'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
