import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { loansService } from '../../services/loans.service';
import { paymentsService } from '../../services/payments.service';

interface LoanRow {
  id: string;
  loanNumber: string;
  status: 'ACTIVE' | 'COMPLETED' | 'RENEWED' | 'DEFAULTED' | 'CANCELLED';
  totalAmount: number | string;
  paidAmount: number | string;
  remainingAmount: number | string;
  createdAt: string;
  client: {
    id: string;
    name: string;
    cedula: string;
    phone: string;
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const paymentSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a cero'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

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

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const limit = 10;

  const loansQuery = useQuery({
    queryKey: ['loans', 'active-for-payment', { search, page, limit }],
    queryFn: () =>
      loansService.getAll({
        page,
        limit,
        search: search || undefined,
        status: 'ACTIVE',
      }),
  });

  const loans: LoanRow[] = useMemo(
    () => (loansQuery.data?.data?.data as LoanRow[]) || [],
    [loansQuery.data]
  );
  const pagination: PaginationMeta | undefined = loansQuery.data?.data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const selectedLoan = useMemo(
    () => loans.find((loan) => loan.id === selectedLoanId) || null,
    [loans, selectedLoanId]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema as any),
    defaultValues: {
      amount: 0,
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (values: PaymentFormData) => {
      if (!selectedLoan) {
        throw new Error('Selecciona un prestamo antes de registrar el cobro');
      }

      const remaining = toAmount(selectedLoan.remainingAmount);
      if (values.amount > remaining) {
        throw new Error('El monto no puede superar el saldo pendiente');
      }

      return paymentsService.create({
        loanId: selectedLoan.id,
        amount: values.amount,
      });
    },
    onSuccess: (response) => {
      const result = response.data.data as {
        completed: boolean;
        appliedAmount: number | string;
      };

      queryClient.invalidateQueries({ queryKey: ['collector', 'day-overview'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail'] });
      reset({ amount: 0 });

      if (result.completed) {
        toast.success(
          `Cobro aplicado (${formatCurrency(result.appliedAmount)}). Prestamo completado.`
        );
        setSelectedLoanId(null);
      } else {
        toast.success(`Cobro aplicado por ${formatCurrency(result.appliedAmount)}`);
      }
    },
    onError: (error: any) => {
      const message =
        error?.message || error?.response?.data?.message || 'No se pudo registrar el cobro';
      toast.error(message);
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <CreditCard size={28} className="text-blue-600" />
            Registrar cobro diario
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Busca por nombre o cedula, selecciona el prestamo activo y registra el monto
            recibido.
          </p>
        </div>
        <Link
          to="/cash-register"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
        >
          <ArrowLeft size={16} />
          Volver a caja
        </Link>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xl">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar cliente por nombre o cedula..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Prestamo</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Saldo pendiente</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Fecha</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">Accion</th>
              </tr>
            </thead>
            <tbody>
              {loansQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 size={20} className="animate-spin" />
                      Cargando prestamos activos...
                    </div>
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No hay prestamos activos para registrar cobros.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr
                    key={loan.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{loan.client.name}</p>
                      <p className="text-xs text-gray-500">{loan.client.cedula}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{loan.loanNumber}</p>
                      <p className="text-xs text-gray-500">
                        Pagado: {formatCurrency(loan.paidAmount)}
                      </p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {formatCurrency(loan.remainingAmount)}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{formatDate(loan.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLoanId(loan.id)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          selectedLoanId === loan.id
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {selectedLoanId === loan.id ? (
                          <>
                            <CheckCircle2 size={14} />
                            Seleccionado
                          </>
                        ) : (
                          'Seleccionar'
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <p className="text-sm text-gray-500">
              Pagina {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Aplicar cobro</h2>
        {!selectedLoan ? (
          <p className="text-sm text-gray-500">
            Selecciona un prestamo activo en la tabla para registrar el pago.
          </p>
        ) : (
          <form onSubmit={handleSubmit((values) => createPaymentMutation.mutate(values))}>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DetailItem label="Cliente" value={selectedLoan.client.name} />
              <DetailItem label="Prestamo" value={selectedLoan.loanNumber} />
              <DetailItem
                label="Saldo pendiente"
                value={formatCurrency(selectedLoan.remainingAmount)}
                highlighted
              />
            </div>

            <div className="max-w-sm">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Monto recibido
              </label>
              <input
                type="number"
                min="1"
                step="1000"
                {...register('amount', { valueAsNumber: true })}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                  errors.amount ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Ej: 50000"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Maximo permitido: {formatCurrency(selectedLoan.remainingAmount)}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={createPaymentMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createPaymentMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Guardar cobro'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedLoanId(null);
                  reset({ amount: 0 });
                }}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Limpiar
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function DetailItem({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlighted ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-sm font-semibold ${highlighted ? 'text-blue-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}
