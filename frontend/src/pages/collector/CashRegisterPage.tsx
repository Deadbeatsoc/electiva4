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

function statusStyle(status: ShiftStatus): React.CSSProperties {
  if (status === 'OPEN') return { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' };
  if (status === 'CLOSED') return { background: 'rgba(37,99,235,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' };
  if (status === 'AUTO_CLOSED') return { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' };
  return { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' };
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.4)' }}>
          <Loader2 size={26} className="animate-spin" style={{ color: '#3b82f6' }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>Cargando resumen de caja...</p>
        </div>
      </div>
    );
  }

  if (!overview || !summary) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          borderRadius: 16, border: '1px solid rgba(239,68,68,0.3)',
          background: 'rgba(239,68,68,0.08)', padding: 24, color: '#f87171',
        }}>
          No se pudo cargar el resumen diario del cobrador.
        </div>
      </div>
    );
  }

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
            <Wallet size={30} color="#3b82f6" />
            Resumen del dia
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
            Fecha operativa: {overview.businessDate} ({overview.timezone})
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link
            to="/payments"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              borderRadius: 14, color: 'white', fontSize: 14, fontWeight: 700,
              padding: '10px 20px', textDecoration: 'none',
              boxShadow: '0 6px 20px -4px rgba(37,99,235,0.45)',
              transition: 'all 0.2s',
            }}
          >
            <ArrowUpCircle size={17} />
            Registrar cobro
          </Link>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            disabled={!allowOperations}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, color: allowOperations ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
              fontSize: 14, fontWeight: 700, padding: '10px 20px',
              cursor: allowOperations ? 'pointer' : 'not-allowed',
              opacity: allowOperations ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
          >
            <ArrowDownCircle size={17} />
            Registrar gasto
          </button>
          <button
            onClick={() => setIsCloseModalOpen(true)}
            disabled={!allowOperations}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: allowOperations ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
              border: allowOperations ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              color: allowOperations ? '#4ade80' : 'rgba(255,255,255,0.3)',
              fontSize: 14, fontWeight: 700, padding: '10px 20px',
              cursor: allowOperations ? 'pointer' : 'not-allowed',
              opacity: allowOperations ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
          >
            <ClipboardCheck size={17} />
            Cerrar caja
          </button>
        </div>
      </div>

      {/* ── Aviso caja cerrada ── */}
      {!allowOperations && (
        <div style={{
          marginBottom: 20,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 16, padding: '14px 18px', color: '#fbbf24', fontSize: 13,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          La caja de hoy ya fue cerrada. Para registrar nuevos movimientos debes esperar al siguiente dia.
        </div>
      )}

      {/* ── Aviso dia anterior ── */}
      {shouldShowPreviousDayNotice && overview.previousClosure && (
        <div style={{
          marginBottom: 20,
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 16, padding: '14px 18px', color: '#a5b4fc', fontSize: 13,
        }}>
          Antes de iniciar el dia nuevo, revisa el cierre anterior ({overview.previousClosure.businessDate}):
          neto {formatCurrency(overview.previousClosure.net)} ({overview.previousClosure.isAutoClosed ? 'automatico' : 'manual'}).
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" style={{ marginBottom: 24 }}>
        <StatCard title="Cobrado hoy" value={formatCurrency(summary.totalCollected)} icon={<ArrowUpCircle size={18} />} tone="green" />
        <StatCard title="Gastos hoy" value={formatCurrency(summary.totalExpenses)} icon={<ArrowDownCircle size={18} />} tone="red" />
        <StatCard title="Neto del dia" value={formatCurrency(summary.net)} icon={<Wallet size={18} />} tone="blue" />
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '16px 18px',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Estado caja
          </p>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700,
            ...statusStyle(shiftStatus),
          }}>
            {statusLabel(shiftStatus)}
          </span>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 10 }}>
            Cierre: {formatDateTime(summary.closedAt)}
          </p>
        </div>
      </div>

      {/* ── Cierre dia anterior ── */}
      {overview.previousClosure && (
        <div style={{
          marginBottom: 20,
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 20, padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Clock3 size={15} style={{ color: '#a5b4fc' }} />
            <p style={{ color: '#a5b4fc', fontSize: 14, fontWeight: 700 }}>
              Cierre del dia anterior ({overview.previousClosure.businessDate})
            </p>
          </div>
          <p style={{ color: 'rgba(165,180,252,0.7)', fontSize: 13, marginBottom: 14 }}>
            {overview.previousClosure.isAutoClosed ? 'Cierre automatico por sistema' : 'Cierre manual realizado por cobrador'}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Cobrado', value: formatCurrency(overview.previousClosure.totalCollected) },
              { label: 'Gastos', value: formatCurrency(overview.previousClosure.totalExpenses) },
              { label: 'Neto', value: formatCurrency(overview.previousClosure.net), bold: true },
            ].map(({ label, value, bold }) => (
              <div key={label} style={{
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: 12, padding: '10px 14px',
              }}>
                <p style={{ color: 'rgba(165,180,252,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
                <p style={{ color: bold ? 'white' : '#a5b4fc', fontWeight: bold ? 800 : 600, fontSize: 15 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Movimientos ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 20px 60px -12px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 15, margin: 0,
          }}>
            <ReceiptText size={17} style={{ color: '#3b82f6' }} />
            Movimientos del dia
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            Neto actual: <strong style={{ color: 'white' }}>{formatCurrency(summary.net)}</strong>
          </p>
        </div>

        {overview.movements.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
            Aun no hay cobros ni gastos registrados hoy.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {overview.movements.map((movement) => (
              <li
                key={`${movement.type}-${movement.id}`}
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600 }}>
                      {movementTitle(movement)}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 3 }}>
                      {formatDateTime(movement.timestamp)}
                      {movement.description ? ` · ${movement.description}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                      ...(movement.type === 'PAYMENT'
                        ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                        : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }),
                    }}>
                      {movement.type === 'PAYMENT' ? 'Cobro' : 'Gasto'}
                    </span>
                    <p style={{
                      fontSize: 15, fontWeight: 700,
                      color: movement.type === 'PAYMENT' ? '#4ade80' : '#f87171',
                    }}>
                      {movement.type === 'PAYMENT' ? '+' : '-'}{formatCurrency(movement.amount)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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

/* ── StatCard ── */
function StatCard({
  title, value, icon, tone,
}: {
  title: string; value: string; icon: React.ReactNode; tone: 'green' | 'red' | 'blue';
}) {
  const toneColor = tone === 'green' ? '#4ade80' : tone === 'red' ? '#f87171' : '#60a5fa';
  const toneBg = tone === 'green' ? 'rgba(34,197,94,0.1)' : tone === 'red' ? 'rgba(239,68,68,0.1)' : 'rgba(37,99,235,0.12)';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20, padding: '16px 18px',
      transition: 'all 0.2s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        {title}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ color: 'white', fontWeight: 800, fontSize: 22, letterSpacing: '-0.01em' }}>{value}</p>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: toneBg, borderRadius: 12, padding: 10, color: toneColor }}>
          {icon}
        </span>
      </div>
    </div>
  );
}

/* ── ExpenseModal ── */
function ExpenseModal({
  isSubmitting, onClose, onSubmit,
}: {
  isSubmitting: boolean; onClose: () => void; onSubmit: (values: ExpenseFormData) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema as any),
    defaultValues: { category: '', amount: 0, description: '' },
  });

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%', padding: '11px 16px',
    background: hasError ? 'rgba(248,113,113,0.07)' : 'rgba(255,255,255,0.06)',
    border: hasError ? '1px solid rgba(248,113,113,0.5)' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, color: 'rgba(255,255,255,0.88)',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-lg" style={{
        background: 'linear-gradient(160deg, #131e35 0%, #0f172a 100%)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24,
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        maxHeight: '92dvh', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <h2 style={{ color: 'white', fontWeight: 700, fontSize: 18, margin: 0 }}>Registrar gasto</h2>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Categoria</label>
              <input type="text" placeholder="Ej: Gasolina" className="placeholder:text-white/20"
                {...register('category')} style={inputStyle(!!errors.category)}
                onFocus={(e) => { if (!errors.category) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; } }}
                onBlur={(e) => { e.target.style.borderColor = errors.category ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
              {errors.category && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{errors.category.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Monto</label>
              <input type="number" step="1" min="0" className="placeholder:text-white/20"
                {...register('amount', { valueAsNumber: true })} style={inputStyle(!!errors.amount)}
                onFocus={(e) => { if (!errors.amount) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; } }}
                onBlur={(e) => { e.target.style.borderColor = errors.amount ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
              {errors.amount && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{errors.amount.message}</p>}
            </div>

            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Descripcion <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(opcional)</span></label>
              <textarea rows={3} className="placeholder:text-white/20"
                {...register('description')}
                style={{ ...inputStyle(!!errors.description), resize: 'none', height: 'auto', padding: '11px 16px' }}
                onFocus={(e) => { if (!errors.description) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; } }}
                onBlur={(e) => { e.target.style.borderColor = errors.description ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
              {errors.description && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{errors.description.message}</p>}
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 12, marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)',
          }}>
            <button type="button" onClick={onClose} style={{
              padding: '11px 20px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
              color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} style={{
              padding: '11px 24px',
              background: isSubmitting ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              border: 'none', borderRadius: 12, color: 'white',
              fontSize: 14, fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: isSubmitting ? 'none' : '0 4px 16px rgba(37,99,235,0.4)',
            }}>
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : 'Guardar gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── CloseCashModal ── */
function CloseCashModal({
  isSubmitting, summary, onConfirm, onClose,
}: {
  isSubmitting: boolean; summary: CollectorDayOverview['summary'];
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-md" style={{
        background: 'linear-gradient(160deg, #131e35 0%, #0f172a 100%)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24,
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        maxHeight: '92dvh', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
            <h2 style={{ color: 'white', fontWeight: 700, fontSize: 18, margin: 0 }}>Confirmar cierre de caja</h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '16px 18px', marginBottom: 20,
          }}>
            {[
              { label: 'Total cobrado', value: formatCurrency(summary.totalCollected) },
              { label: 'Total gastos', value: formatCurrency(summary.totalExpenses) },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{label}</span>
                <strong style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{value}</strong>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 600 }}>Neto del dia</span>
              <strong style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>{formatCurrency(summary.net)}</strong>
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24 }}>
            Esta accion cerrara tu caja del dia. Despues no podras registrar nuevos cobros ni gastos hasta el siguiente dia.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={onClose} style={{
              padding: '11px 20px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
              color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} disabled={isSubmitting} style={{
              padding: '11px 24px',
              background: isSubmitting ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg, #16a34a, #15803d)',
              border: 'none', borderRadius: 12, color: 'white',
              fontSize: 14, fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: isSubmitting ? 'none' : '0 4px 16px rgba(22,163,74,0.4)',
            }}>
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Cerrando...</> : 'Confirmar cierre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}