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
  loan: { id: string; loanNumber: string; status: string };
  installment: { id: string; number: number };
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

function statusStyle(status: string): React.CSSProperties {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' };
  if (s === 'COMPLETED') return { background: 'rgba(37,99,235,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' };
  if (s === 'RENEWED') return { background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)' };
  if (s === 'DEFAULTED') return { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' };
  return { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' };
}

function statusLabel(status: string) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return 'Activo';
  if (s === 'COMPLETED') return 'Completado';
  if (s === 'RENEWED') return 'Renovado';
  if (s === 'DEFAULTED') return 'En mora';
  if (s === 'CANCELLED') return 'Cancelado';
  return status;
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 24,
  padding: '24px',
};

const sectionTitle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.85)',
  fontWeight: 700,
  fontSize: 17,
  margin: '0 0 20px',
};

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

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema as any),
    defaultValues: { amount: 0 },
  });

  const amountValue = Number(watch('amount') || 0);
  const interestValue = useMemo(
    () => (amountValue > 0 ? (amountValue * FIXED_INTEREST) / 100 : 0),
    [amountValue]
  );
  const totalValue = amountValue + interestValue;

  // ── Loading ──
  if (detailQuery.isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.4)' }}>
          <Loader2 size={26} className="animate-spin" style={{ color: '#3b82f6' }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>Cargando cliente...</p>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!detail) {
    return (
      <div style={{ padding: '28px 24px' }}>
        <Link
          to="/clients"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: '#93c5fd', fontSize: 14, textDecoration: 'none', marginBottom: 20,
          }}
        >
          <ArrowLeft size={16} /> Volver a clientes
        </Link>
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 16, padding: 24, color: '#f87171', fontSize: 14,
        }}>
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
    <div
      style={{
        background:
          'radial-gradient(ellipse at 10% 0%, rgba(37,99,235,0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(124,58,237,0.06) 0%, transparent 50%), #0c1220',
        minHeight: '100dvh',
        padding: '28px 24px 48px',
      }}
    >
      {/* ── Volver ── */}
      <Link
        to="/clients"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'rgba(255,255,255,0.5)', fontSize: 14, textDecoration: 'none',
          marginBottom: 24, transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#93c5fd'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
      >
        <ArrowLeft size={16} /> Volver a clientes
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ══ Columna izquierda (2/3) ══ */}
        <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Info del cliente ── */}
          <div style={cardStyle}>
            <h1 style={{ color: 'white', fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', margin: '0 0 20px' }}>
              {detail.name}
            </h1>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem label="Cedula" value={detail.cedula} />
              <InfoItem label="Telefono" value={detail.phone} icon={<Phone size={14} />} />
              <InfoItem label="Direccion" value={detail.address} />
              <InfoItem label="Ultimo contacto" value={formatDate(detail.lastContactAt)} icon={<Clock3 size={14} />} />
            </div>

            {detail.notes && (
              <div style={{
                marginTop: 20,
                background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 12, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#93c5fd', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <NotebookPen size={14} /> Notas
                </div>
                <p style={{ color: 'rgba(147,197,253,0.8)', fontSize: 13 }}>{detail.notes}</p>
              </div>
            )}
          </div>

          {/* ── Préstamo actual ── */}
          <div style={cardStyle}>
            <h2 style={sectionTitle}>Prestamo actual</h2>
            {detail.currentLoan ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header del préstamo */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 14 }}>
                    #{detail.currentLoan.loanNumber}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                    ...statusStyle(detail.currentLoan.status),
                  }}>
                    {statusLabel(detail.currentLoan.status)}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                    Creado: {formatDate(detail.currentLoan.createdAt)}
                  </span>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricCard label="Total prestamo" value={formatCurrency(detail.currentLoan.totalAmount)} />
                  <MetricCard label="Pagado" value={formatCurrency(detail.currentLoan.paidAmount)} />
                  <MetricCard label="Saldo pendiente" value={formatCurrency(detail.currentLoan.remainingAmount)} emphasized />
                </div>
              </div>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
                Este cliente aun no tiene prestamos.
              </p>
            )}
          </div>

          {/* ── Historial de pagos ── */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>Historial de pagos</h2>
            </div>

            {detail.paymentHistory.length === 0 ? (
              <p style={{ padding: '32px 24px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
                No hay pagos registrados para este cliente.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full text-left text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Fecha', 'Prestamo', 'Cuota', 'Monto'].map((h, i) => (
                        <th key={h} style={{
                          color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          padding: '12px 20px', whiteSpace: 'nowrap',
                          textAlign: i === 3 ? 'right' : 'left',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.paymentHistory.map((payment) => (
                      <tr
                        key={payment.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '13px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                          {formatDate(payment.paymentTimestamp)}
                        </td>
                        <td style={{ padding: '13px 20px', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                          {payment.loan.loanNumber}
                        </td>
                        <td style={{ padding: '13px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                          #{payment.installment.number}
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'right', color: '#4ade80', fontWeight: 700, fontSize: 14 }}>
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

        {/* ══ Columna derecha (1/3) ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Crear / Renovar préstamo ── */}
          <div style={cardStyle}>
            <h2 style={sectionTitle}>
              {isRenewalCandidate ? 'Renovar prestamo' : 'Crear prestamo'}
            </h2>

            {!canCreateLoan ? (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 12, padding: '12px 16px', color: '#fbbf24', fontSize: 13,
              }}>
                El cliente ya tiene un prestamo activo. Finalizalo antes de crear uno nuevo.
              </div>
            ) : (
              <form onSubmit={handleSubmit((data) => loanMutation.mutate(data))} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Monto */}
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Monto base
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ej: 500000"
                    className="placeholder:text-white/20"
                    {...register('amount', { valueAsNumber: true })}
                    style={{
                      width: '100%', height: 48, padding: '0 16px',
                      background: errors.amount ? 'rgba(248,113,113,0.07)' : 'rgba(255,255,255,0.06)',
                      border: errors.amount ? '1px solid rgba(248,113,113,0.5)' : '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12, color: 'rgba(255,255,255,0.9)',
                      fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      if (!errors.amount) {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.amount ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.12)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {errors.amount && (
                    <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{errors.amount.message}</p>
                  )}
                </div>

                {/* Resumen */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Interes ({FIXED_INTEREST}%)</span>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 13 }}>
                      {formatCurrency(interestValue)}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }}>Total a pagar</span>
                    <span style={{ color: '#93c5fd', fontWeight: 800, fontSize: 16 }}>
                      {formatCurrency(totalValue)}
                    </span>
                  </div>
                </div>

                {/* Botón */}
                <button
                  type="submit"
                  disabled={loanMutation.isPending}
                  style={{
                    width: '100%', padding: '12px',
                    background: loanMutation.isPending ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    border: 'none', borderRadius: 12, color: 'white',
                    fontSize: 14, fontWeight: 700,
                    cursor: loanMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: loanMutation.isPending ? 'none' : '0 4px 16px rgba(37,99,235,0.4)',
                  }}
                >
                  {loanMutation.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                  ) : isRenewalCandidate ? 'Renovar prestamo' : 'Crear prestamo'}
                </button>
              </form>
            )}
          </div>

          {/* ── Historial de préstamos ── */}
          <div style={cardStyle}>
            <h2 style={sectionTitle}>Historial de prestamos</h2>
            {detail.loans.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Sin prestamos registrados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {detail.loans.map((loan) => (
                  <div key={loan.id} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14, padding: '12px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 14 }}>
                        {loan.loanNumber}
                      </p>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                        ...statusStyle(loan.status),
                      }}>
                        {statusLabel(loan.status)}
                      </span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 4 }}>
                      Creado: {formatDate(loan.createdAt)}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600 }}>
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

/* ── InfoItem ── */
function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>{icon || <UserRound size={14} />}</span>
        {value}
      </p>
    </div>
  );
}

/* ── MetricCard ── */
function MetricCard({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div style={{
      background: emphasized ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.04)',
      border: emphasized ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '12px 16px',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: emphasized ? '#93c5fd' : 'rgba(255,255,255,0.85)',
        fontWeight: 700, fontSize: 15,
      }}>
        <CircleDollarSign size={14} style={{ color: emphasized ? '#93c5fd' : 'rgba(255,255,255,0.35)' }} />
        {value}
      </p>
    </div>
  );
}