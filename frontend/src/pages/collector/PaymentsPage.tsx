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

const thStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '14px 20px',
  whiteSpace: 'nowrap',
};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const limit = 10;

  const loansQuery = useQuery({
    queryKey: ['loans', 'active-for-payment', { search, page, limit }],
    queryFn: () =>
      loansService.getAll({ page, limit, search: search || undefined, status: 'ACTIVE' }),
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema as any),
    defaultValues: { amount: 0 },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (values: PaymentFormData) => {
      if (!selectedLoan) throw new Error('Selecciona un prestamo antes de registrar el cobro');
      const remaining = toAmount(selectedLoan.remainingAmount);
      if (values.amount > remaining) throw new Error('El monto no puede superar el saldo pendiente');
      return paymentsService.create({ loanId: selectedLoan.id, amount: values.amount });
    },
    onSuccess: (response) => {
      const result = response.data.data as { completed: boolean; appliedAmount: number | string };
      queryClient.invalidateQueries({ queryKey: ['collector', 'day-overview'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail'] });
      reset({ amount: 0 });
      if (result.completed) {
        toast.success(`Cobro aplicado (${formatCurrency(result.appliedAmount)}). Prestamo completado.`);
        setSelectedLoanId(null);
      } else {
        toast.success(`Cobro aplicado por ${formatCurrency(result.appliedAmount)}`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || error?.response?.data?.message || 'No se pudo registrar el cobro');
    },
  });

  return (
    <div
      style={{
        background: 'radial-gradient(ellipse at 10% 0%, rgba(37,99,235,0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(124,58,237,0.06) 0%, transparent 50%), #0c1220',
        minHeight: '100dvh',
        padding: '28px 24px 48px',
      }}
    >
      {/* ── Encabezado ── */}
      <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
        className="md:flex-row md:items-start md:justify-between"
      >
        <div>
          <h1 style={{
            display: 'flex', alignItems: 'center', gap: 10,
            color: 'white', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', margin: 0,
          }}>
            <CreditCard size={30} color="#3b82f6" />
            Registrar cobro diario
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
            Busca por nombre o cedula, selecciona el prestamo activo y registra el monto recibido.
          </p>
        </div>
        <Link
          to="/cash-register"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14, color: 'rgba(255,255,255,0.75)',
            fontSize: 14, fontWeight: 600, padding: '10px 18px',
            textDecoration: 'none', transition: 'all 0.2s',
            whiteSpace: 'nowrap', alignSelf: 'flex-start',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          <ArrowLeft size={16} />
          Volver a caja
        </Link>
      </div>

      {/* ── Buscador ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 520 }}>
          <Search size={17} style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(255,255,255,0.35)',
          }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar cliente por nombre o cedula..."
            className="w-full outline-none placeholder:text-white/20"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 14, color: 'rgba(255,255,255,0.9)',
              fontSize: 14, padding: '11px 16px 11px 46px',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.09)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* ── Tabla de préstamos ── */}
      <div style={{
        marginBottom: 20,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 20px 60px -12px rgba(0,0,0,0.5)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-left text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th style={thStyle}>Cliente</th>
                <th style={thStyle}>Prestamo</th>
                <th style={thStyle}>Saldo pendiente</th>
                <th style={thStyle}>Fecha</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {loansQuery.isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,0.35)' }}>
                      <Loader2 size={18} className="animate-spin" style={{ color: '#3b82f6' }} />
                      Cargando prestamos activos...
                    </div>
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                    No hay prestamos activos para registrar cobros.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr
                    key={loan.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: selectedLoanId === loan.id ? 'rgba(37,99,235,0.07)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedLoanId !== loan.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedLoanId !== loan.id) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '15px 20px' }}>
                      <p style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{loan.client.name}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{loan.client.cedula}</p>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 14 }}>{loan.loanNumber}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                        Pagado: {formatCurrency(loan.paidAmount)}
                      </p>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 15 }}>
                        {formatCurrency(loan.remainingAmount)}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                      {formatDate(loan.createdAt)}
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedLoanId(loan.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.15s',
                          ...(selectedLoanId === loan.id
                            ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }
                            : { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', border: 'none', boxShadow: '0 4px 12px -2px rgba(37,99,235,0.4)' }
                          ),
                        }}
                      >
                        {selectedLoanId === loan.id ? (
                          <><CheckCircle2 size={13} /> Seleccionado</>
                        ) : 'Seleccionar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
              Pagina {page} de {totalPages}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setPage((c) => Math.max(1, c - 1))}
                disabled={page <= 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 13,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.5)',
                  opacity: page <= 1 ? 0.3 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <button
                onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                disabled={page >= totalPages}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 13,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.5)',
                  opacity: page >= totalPages ? 0.3 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Siguiente <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Aplicar cobro ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 24, padding: '24px',
        boxShadow: '0 20px 60px -12px rgba(0,0,0,0.5)',
      }}>
        <h2 style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 17, margin: '0 0 20px' }}>
          Aplicar cobro
        </h2>

        {!selectedLoan ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Selecciona un prestamo activo en la tabla para registrar el pago.
          </p>
        ) : (
          <form onSubmit={handleSubmit((values) => createPaymentMutation.mutate(values))}>
            {/* Detalles del préstamo seleccionado */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" style={{ marginBottom: 24 }}>
              <DetailItem label="Cliente" value={selectedLoan.client.name} />
              <DetailItem label="Prestamo" value={selectedLoan.loanNumber} />
              <DetailItem label="Saldo pendiente" value={formatCurrency(selectedLoan.remainingAmount)} highlighted />
            </div>

            {/* Input monto */}
            <div style={{ maxWidth: 360 }}>
              <label style={{
                display: 'block', color: 'rgba(255,255,255,0.6)',
                fontSize: 13, fontWeight: 600, marginBottom: 8,
              }}>
                Monto recibido
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ej: 50000"
                className="placeholder:text-white/20"
                {...register('amount', { valueAsNumber: true })}
                style={{
                  width: '100%', padding: '11px 16px',
                  background: errors.amount ? 'rgba(248,113,113,0.07)' : 'rgba(255,255,255,0.06)',
                  border: errors.amount ? '1px solid rgba(248,113,113,0.5)' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, color: 'rgba(255,255,255,0.9)',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => { if (!errors.amount) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; } }}
                onBlur={(e) => { e.target.style.borderColor = errors.amount ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
              {errors.amount && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{errors.amount.message}</p>}
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>
                Maximo permitido: {formatCurrency(selectedLoan.remainingAmount)}
              </p>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
              <button
                type="submit"
                disabled={createPaymentMutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 24px',
                  background: createPaymentMutation.isPending ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  border: 'none', borderRadius: 12, color: 'white',
                  fontSize: 14, fontWeight: 700,
                  cursor: createPaymentMutation.isPending ? 'not-allowed' : 'pointer',
                  boxShadow: createPaymentMutation.isPending ? 'none' : '0 4px 16px rgba(37,99,235,0.4)',
                }}
              >
                {createPaymentMutation.isPending
                  ? <><Loader2 size={16} className="animate-spin" /> Registrando...</>
                  : 'Guardar cobro'}
              </button>
              <button
                type="button"
                onClick={() => { setSelectedLoanId(null); reset({ amount: 0 }); }}
                style={{
                  padding: '11px 20px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, color: 'rgba(255,255,255,0.6)',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Limpiar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── DetailItem ── */
function DetailItem({ label, value, highlighted = false }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <div style={{
      background: highlighted ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.04)',
      border: highlighted ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '12px 16px',
    }}>
      <p style={{
        color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
      }}>
        {label}
      </p>
      <p style={{ color: highlighted ? '#93c5fd' : 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 15 }}>
        {value}
      </p>
    </div>
  );
}