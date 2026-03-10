import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CircleDollarSign,
  Clock3,
  Loader2,
  NotebookPen,
  Phone,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { clientsService } from '../../services/clients.service';
import { loansService } from '../../services/loans.service';

interface LoanDetail {
  id: string;
  loanNumber: string;
  status: 'ACTIVE' | 'COMPLETED' | 'RENEWED' | 'DEFAULTED' | 'CANCELLED';
  principalAmount: number;
  interestRate: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  createdAt: string;
  disbursedAt: string;
}

interface PaymentHistoryItem {
  id: string;
  amount: number;
  moraAmount: number;
  isLate: boolean;
  paymentTimestamp: string;
  loan: {
    id: string;
    loanNumber: string;
    status: string;
  };
  installment: {
    id: string;
    number: number;
  };
}

interface ClientDetailResponse {
  id: string;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  notes: string | null;
  isActive: boolean;
  lastContactAt: string;
  currentLoan: LoanDetail | null;
  hasActiveLoan: boolean;
  loans: LoanDetail[];
  paymentHistory: PaymentHistoryItem[];
}

const loanFormSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a cero'),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

const FIXED_INTEREST = 20;

function formatCurrency(value: number | string) {
  const amount = Number(value);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isNaN(amount) ? 0 : amount);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusBadge(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'ACTIVE') {
    return 'bg-green-100 text-green-700';
  }
  if (normalized === 'COMPLETED') {
    return 'bg-blue-100 text-blue-700';
  }
  if (normalized === 'RENEWED') {
    return 'bg-purple-100 text-purple-700';
  }
  return 'bg-gray-100 text-gray-700';
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn: () => clientsService.getById(id!),
    enabled: !!id,
  });

  const detail: ClientDetailResponse | null = detailQuery.data?.data?.data || null;

  const loanMutation = useMutation({
    mutationFn: async (payload: LoanFormData) => {
      if (!detail) return;

      const hasLoans = detail.loans.length > 0;
      const isRenewalCandidate =
        !!detail.currentLoan &&
        !detail.hasActiveLoan &&
        detail.currentLoan.status === 'COMPLETED';

      if (hasLoans && isRenewalCandidate && detail.currentLoan) {
        return loansService.renew(detail.currentLoan.id, payload);
      }

      return loansService.createForClient(detail.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Prestamo guardado correctamente');
      reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'No se pudo guardar el prestamo');
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema as any),
    defaultValues: {
      amount: 0,
    },
  });

  const amountValue = Number(watch('amount') || 0);
  const interestValue = useMemo(
    () => (amountValue > 0 ? (amountValue * FIXED_INTEREST) / 100 : 0),
    [amountValue]
  );
  const totalValue = amountValue + interestValue;

  if (detailQuery.isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 size={20} className="animate-spin" />
          Cargando cliente...
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <Link
          to="/clients"
          className="mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          Volver a clientes
        </Link>
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          No se encontro el cliente solicitado.
        </div>
      </div>
    );
  }

  const isRenewalCandidate =
    !!detail.currentLoan &&
    !detail.hasActiveLoan &&
    detail.currentLoan.status === 'COMPLETED';
  const canCreateLoan = !detail.hasActiveLoan;

  return (
    <div className="p-6">
      <Link
        to="/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} />
        Volver a clientes
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h1 className="mb-4 text-2xl font-bold text-gray-800">{detail.name}</h1>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem label="Cedula" value={detail.cedula} />
              <InfoItem label="Telefono" value={detail.phone} icon={<Phone size={14} />} />
              <InfoItem label="Direccion" value={detail.address} />
              <InfoItem
                label="Ultimo contacto"
                value={formatDate(detail.lastContactAt)}
                icon={<Clock3 size={14} />}
              />
            </div>
            {detail.notes && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                <div className="mb-1 flex items-center gap-1 font-medium">
                  <NotebookPen size={14} />
                  Notas
                </div>
                <p>{detail.notes}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Prestamo actual</h2>
            {detail.currentLoan ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    #{detail.currentLoan.loanNumber}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(
                      detail.currentLoan.status
                    )}`}
                  >
                    {detail.currentLoan.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    Creado: {formatDate(detail.currentLoan.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricCard label="Total prestamo" value={formatCurrency(detail.currentLoan.totalAmount)} />
                  <MetricCard label="Pagado" value={formatCurrency(detail.currentLoan.paidAmount)} />
                  <MetricCard
                    label="Saldo pendiente"
                    value={formatCurrency(detail.currentLoan.remainingAmount)}
                    emphasized
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Este cliente aun no tiene prestamos.</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Historial de pagos</h2>
            {detail.paymentHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No hay pagos registrados para este cliente.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-2 py-2">Fecha</th>
                      <th className="px-2 py-2">Prestamo</th>
                      <th className="px-2 py-2">Cuota</th>
                      <th className="px-2 py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.paymentHistory.map((payment) => (
                      <tr key={payment.id} className="border-b border-gray-50">
                        <td className="px-2 py-2 text-gray-700">
                          {formatDate(payment.paymentTimestamp)}
                        </td>
                        <td className="px-2 py-2 text-gray-700">{payment.loan.loanNumber}</td>
                        <td className="px-2 py-2 text-gray-700">#{payment.installment.number}</td>
                        <td className="px-2 py-2 text-right font-medium text-gray-900">
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {isRenewalCandidate ? 'Renovar prestamo' : 'Crear prestamo'}
            </h2>

            {!canCreateLoan ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                El cliente ya tiene un prestamo activo. Finalizalo antes de crear uno nuevo.
              </p>
            ) : (
              <form onSubmit={handleSubmit((data) => loanMutation.mutate(data))} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Monto base</label>
                  <input
                    type="number"
                    min="1"
                    step="1000"
                    {...register('amount', { valueAsNumber: true })}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                      errors.amount ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="Ej: 500000"
                  />
                  {errors.amount && (
                    <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between text-gray-600">
                    <span>Interes ({FIXED_INTEREST}%)</span>
                    <span className="font-medium text-gray-800">{formatCurrency(interestValue)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-gray-700">
                    <span className="font-medium">Total a pagar</span>
                    <span className="text-base font-bold text-blue-700">
                      {formatCurrency(totalValue)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loanMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loanMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Guardando...
                    </>
                  ) : isRenewalCandidate ? (
                    'Renovar prestamo'
                  ) : (
                    'Crear prestamo'
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Historial de prestamos</h2>
            {detail.loans.length === 0 ? (
              <p className="text-sm text-gray-500">Sin prestamos registrados.</p>
            ) : (
              <div className="space-y-3">
                {detail.loans.map((loan) => (
                  <div key={loan.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">{loan.loanNumber}</p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(
                          loan.status
                        )}`}
                      >
                        {loan.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Creado: {formatDate(loan.createdAt)}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Saldo: {formatCurrency(loan.remainingAmount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="flex items-center gap-1 text-sm text-gray-900">
        {icon || <UserRound size={14} className="text-gray-400" />}
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        emphasized ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={`flex items-center gap-1 text-sm font-semibold ${
          emphasized ? 'text-blue-700' : 'text-gray-900'
        }`}
      >
        <CircleDollarSign size={14} />
        {value}
      </p>
    </div>
  );
}
