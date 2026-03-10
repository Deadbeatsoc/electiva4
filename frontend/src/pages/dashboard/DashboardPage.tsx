import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock3,
  Loader2,
  Users,
  Wallet,
  WalletCards,
  TrendingUp,
} from 'lucide-react';
import {
  dashboardService,
  type DashboardCollectorStatus,
  type DashboardOverview,
} from '../../services/dashboard.service';

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function shiftStatusLabel(status: DashboardCollectorStatus['shiftStatus']) {
  if (status === 'OPEN')        return 'Caja abierta';
  if (status === 'CLOSED')      return 'Caja cerrada';
  if (status === 'AUTO_CLOSED') return 'Auto cerrada';
  return 'Sin apertura';
}

function shiftStatusClass(status: DashboardCollectorStatus['shiftStatus']) {
  if (status === 'OPEN')        return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
  if (status === 'CLOSED')      return 'bg-blue-100 text-blue-700 ring-1 ring-blue-200';
  if (status === 'AUTO_CLOSED') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
  return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
}

export default function DashboardPage() {
  const overviewQuery = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => {
      const response = await dashboardService.getOverview();
      return response.data.data as DashboardOverview;
    },
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const overview = overviewQuery.data;

  if (overviewQuery.isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <p className="text-sm font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">No se pudo cargar el dashboard.</p>
        </div>
      </div>
    );
  }

  const inactiveCollectors = overview.collectors.filter((c) => c.isInactive);

  return (
    <div className="p-6 space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Dashboard General
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Datos en tiempo real &mdash; {overview.businessDate}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 self-start md:self-auto">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          Actualizado {formatDateTime(overview.generatedAt)}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Cobrado hoy"
          value={formatCurrency(overview.kpis.totalCollectedToday)}
          icon={<Wallet size={20} />}
          tone="green"
          trend="up"
        />
        <KpiCard
          title="Cartera activa"
          value={formatCurrency(overview.kpis.activePortfolioTotal)}
          icon={<WalletCards size={20} />}
          tone="blue"
        />
        <KpiCard
          title="Clientes activos"
          value={String(overview.kpis.activeClientsTotal)}
          icon={<Users size={20} />}
          tone="indigo"
        />
        <KpiCard
          title="Alertas sin leer"
          value={String(overview.unreadInactivityAlerts.total)}
          icon={<AlertTriangle size={20} />}
          tone={overview.unreadInactivityAlerts.total > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* ── Inactive collectors warning ── */}
      {inactiveCollectors.length > 0 && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-bold text-red-700">
              Cobradores con mas de {overview.inactivityThresholdHours}h sin actividad
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {inactiveCollectors.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center rounded-full bg-red-100 px-3 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200"
                >
                  {c.name} ({c.hoursWithoutActivity}h)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">

        {/* Collectors table */}
        <section className="xl:col-span-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-[15px] font-bold text-gray-800">Estado de cobradores</h2>
            <p className="mt-0.5 text-xs text-gray-400">{overview.collectors.length} cobradores registrados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Cobrador</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Cobrado</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Gastos</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Neto</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Ult. movimiento</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Caja</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {overview.collectors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <p className="text-sm text-gray-400">No hay cobradores registrados.</p>
                    </td>
                  </tr>
                ) : (
                  overview.collectors.map((collector) => (
                    <tr
                      key={collector.id}
                      className={`table-row-hover transition-colors ${
                        collector.isInactive
                          ? 'bg-red-50/40 hover:bg-red-50'
                          : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-900">{collector.name}</p>
                        <p className="text-xs text-gray-400">{collector.phone}</p>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-emerald-600">
                        {formatCurrency(collector.totalCollectedToday)}
                      </td>
                      <td className="px-5 py-3.5 text-red-600">
                        {formatCurrency(collector.totalExpensesToday)}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-gray-900">
                        {formatCurrency(collector.netToday)}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {formatDateTime(collector.lastMovementAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${shiftStatusClass(collector.shiftStatus)}`}>
                          {shiftStatusLabel(collector.shiftStatus)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {collector.isInactive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Inactivo ({collector.hoursWithoutActivity}h)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Activo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Alerts panel */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-gray-800">Notificaciones</h2>
              {overview.unreadInactivityAlerts.total > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {overview.unreadInactivityAlerts.total}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-400">Alertas de inactividad sin leer</p>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {overview.unreadInactivityAlerts.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <AlertTriangle size={16} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-400">Sin alertas por ahora</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {overview.unreadInactivityAlerts.items.map((item) => (
                  <li
                    key={item.id}
                    className="px-5 py-4 transition-colors hover:bg-gray-50/50"
                  >
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="mt-0.5 text-sm text-gray-500">{item.message}</p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
                      <Clock3 size={11} />
                      {formatDateTime(item.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── KPI Card component ── */
const toneConfig = {
  green:  { icon: 'bg-emerald-100 text-emerald-600',  value: 'text-emerald-700',  border: 'border-emerald-100' },
  blue:   { icon: 'bg-blue-100 text-blue-600',        value: 'text-blue-700',     border: 'border-blue-100'   },
  indigo: { icon: 'bg-indigo-100 text-indigo-600',    value: 'text-indigo-700',   border: 'border-indigo-100' },
  red:    { icon: 'bg-red-100 text-red-600',          value: 'text-red-700',      border: 'border-red-100'    },
  gray:   { icon: 'bg-gray-100 text-gray-500',        value: 'text-gray-700',     border: 'border-gray-100'   },
};

function KpiCard({
  title,
  value,
  icon,
  tone,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone: keyof typeof toneConfig;
  trend?: 'up' | 'down';
}) {
  const cfg = toneConfig[tone];

  return (
    <div className={`card-hover rounded-2xl border bg-white p-5 shadow-sm ${cfg.border}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${cfg.icon}`}>
          {icon}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-xl font-extrabold ${cfg.value}`}>{value}</p>
        {trend === 'up' && (
          <span className="mb-0.5 flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
            <TrendingUp size={13} />
            Hoy
          </span>
        )}
      </div>
    </div>
  );
}
