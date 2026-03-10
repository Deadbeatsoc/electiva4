import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  reportsService,
  type CashClosuresReport,
  type CollectionSummaryReport,
  type MovementHistoryReport,
  type PortfolioStatusReport,
  type ReportCollector,
} from '../../services/reports.service';
import { exportToExcel, exportToPdf } from '../../services/exporters';

type ReportTab = 'collection' | 'portfolio' | 'movements' | 'closures';

interface FiltersState {
  from: string;
  to: string;
  collectorId: string;
}

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

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultFilters(): FiltersState {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
    collectorId: '',
  };
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('collection');
  const [filters, setFilters] = useState<FiltersState>(getDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(getDefaultFilters);

  const collectorsQuery = useQuery({
    queryKey: ['reports', 'collectors'],
    queryFn: async () => {
      const response = await reportsService.getCollectors();
      return response.data.data as ReportCollector[];
    },
  });

  const reportQuery = useQuery({
    queryKey: ['reports', activeTab, appliedFilters],
    queryFn: async () => {
      const baseParams = {
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
        collectorId: appliedFilters.collectorId || undefined,
      };

      if (activeTab === 'collection') {
        const response = await reportsService.getCollectionSummary(baseParams);
        return {
          type: 'collection' as const,
          data: response.data.data as CollectionSummaryReport,
        };
      }

      if (activeTab === 'portfolio') {
        const response = await reportsService.getPortfolioStatus({
          collectorId: baseParams.collectorId,
        });
        return {
          type: 'portfolio' as const,
          data: response.data.data as PortfolioStatusReport,
        };
      }

      if (activeTab === 'movements') {
        const response = await reportsService.getMovementHistory(baseParams);
        return {
          type: 'movements' as const,
          data: response.data.data as MovementHistoryReport,
        };
      }

      const response = await reportsService.getCashClosures(baseParams);
      return {
        type: 'closures' as const,
        data: response.data.data as CashClosuresReport,
      };
    },
  });

  const collectors = collectorsQuery.data || [];
  const selectedCollectorName = useMemo(() => {
    if (!appliedFilters.collectorId) return 'Todos los cobradores';
    return (
      collectors.find((collector) => collector.id === appliedFilters.collectorId)?.name ||
      'Cobrador filtrado'
    );
  }, [collectors, appliedFilters.collectorId]);

  const exportSubtitle = `Filtro cobrador: ${selectedCollectorName}${
    activeTab !== 'portfolio'
      ? ` | Rango: ${appliedFilters.from || '-'} a ${appliedFilters.to || '-'}`
      : ''
  }`;

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
  };

  const handleExportExcel = () => {
    if (!reportQuery.data) return;

    try {
      if (reportQuery.data.type === 'collection') {
        exportToExcel({
          filename: `reporte_cobranza_${appliedFilters.from}_${appliedFilters.to}`,
          title: 'Resumen de cobranza',
          subtitle: exportSubtitle,
          rows: reportQuery.data.data.rows,
          columns: [
            { header: 'Cobrador', value: (row) => row.collectorName },
            { header: 'Telefono', value: (row) => row.collectorPhone },
            { header: 'Cobrado', value: (row) => row.totalCollected },
            { header: 'Gastos', value: (row) => row.totalExpenses },
            { header: 'Neto', value: (row) => row.net },
          ],
        });
      } else if (reportQuery.data.type === 'portfolio') {
        exportToExcel({
          filename: 'reporte_estado_cartera',
          title: 'Estado de cartera',
          subtitle: exportSubtitle,
          rows: reportQuery.data.data.rows,
          columns: [
            { header: 'Prestamo', value: (row) => row.loanNumber },
            { header: 'Cliente', value: (row) => row.clientName },
            { header: 'Cedula', value: (row) => row.clientCedula },
            { header: 'Cobrador', value: (row) => row.collectorName },
            { header: 'Monto original', value: (row) => row.principalAmount },
            { header: 'Pagado', value: (row) => row.paidAmount },
            { header: 'Pendiente', value: (row) => row.remainingAmount },
          ],
        });
      } else if (reportQuery.data.type === 'movements') {
        exportToExcel({
          filename: `reporte_movimientos_${appliedFilters.from}_${appliedFilters.to}`,
          title: 'Historial de movimientos',
          subtitle: exportSubtitle,
          rows: reportQuery.data.data.rows,
          columns: [
            { header: 'Fecha', value: (row) => formatDateTime(row.timestamp) },
            { header: 'Tipo', value: (row) => row.type },
            { header: 'Cobrador', value: (row) => row.collectorName },
            { header: 'Cliente', value: (row) => row.clientName || '-' },
            { header: 'Prestamo', value: (row) => row.loanNumber || '-' },
            { header: 'Categoria', value: (row) => row.category || '-' },
            { header: 'Monto', value: (row) => row.amount },
          ],
        });
      } else {
        exportToExcel({
          filename: `reporte_cierres_${appliedFilters.from}_${appliedFilters.to}`,
          title: 'Cierres de caja',
          subtitle: exportSubtitle,
          rows: reportQuery.data.data.rows,
          columns: [
            { header: 'Fecha negocio', value: (row) => row.businessDate },
            { header: 'Cobrador', value: (row) => row.collectorName },
            { header: 'Tipo cierre', value: (row) => (row.isAutoClosed ? 'Automatico' : 'Manual') },
            { header: 'Cobrado', value: (row) => row.totalCollected },
            { header: 'Gastos', value: (row) => row.totalExpenses },
            { header: 'Neto', value: (row) => row.net },
            { header: 'Cerrado en', value: (row) => formatDateTime(row.closedAt) },
          ],
        });
      }

      toast.success('Reporte exportado en Excel');
    } catch (error: any) {
      toast.error(error.message || 'No se pudo exportar en Excel');
    }
  };

  const handleExportPdf = () => {
    if (!reportQuery.data) return;

    try {
      if (reportQuery.data.type === 'collection') {
        exportToPdf({
          filename: `reporte_cobranza_${appliedFilters.from}_${appliedFilters.to}`,
          title: 'Resumen de cobranza',
          subtitle: exportSubtitle,
          rows: reportQuery.data.data.rows,
          columns: [
            { header: 'Cobrador', value: (row) => row.collectorName },
            { header: 'Telefono', value: (row) => row.collectorPhone },
            { header: 'Cobrado', value: (row) => formatCurrency(row.totalCollected) },
            { header: 'Gastos', value: (row) => formatCurrency(row.totalExpenses) },
            { header: 'Neto', value: (row) => formatCurrency(row.net) },
          ],
        });
      } else if (reportQuery.data.type === 'portfolio') {
        exportToPdf({
          filename: 'reporte_estado_cartera',
          title: 'Estado de cartera',
          subtitle: exportSubtitle,
          rows: reportQuery.data.data.rows,
          columns: [
            { header: 'Prestamo', value: (row) => row.loanNumber },
            { header: 'Cliente', value: (row) => row.clientName },
            { header: 'Cobrador', value: (row) => row.collectorName },
            { header: 'Original', value: (row) => formatCurrency(row.principalAmount) },
            { header: 'Pagado', value: (row) => formatCurrency(row.paidAmount) },
            { header: 'Pendiente', value: (row) => formatCurrency(row.remainingAmount) },
          ],
        });
      } else if (reportQuery.data.type === 'movements') {
        exportToPdf({
          filename: `reporte_movimientos_${appliedFilters.from}_${appliedFilters.to}`,
          title: 'Historial de movimientos',
          subtitle: exportSubtitle,
          rows: reportQuery.data.data.rows,
          columns: [
            { header: 'Fecha', value: (row) => formatDateTime(row.timestamp) },
            { header: 'Tipo', value: (row) => row.type },
            { header: 'Cobrador', value: (row) => row.collectorName },
            { header: 'Detalle', value: (row) => row.description || '-' },
            { header: 'Monto', value: (row) => formatCurrency(row.amount) },
          ],
        });
      } else {
        exportToPdf({
          filename: `reporte_cierres_${appliedFilters.from}_${appliedFilters.to}`,
          title: 'Cierres de caja',
          subtitle: exportSubtitle,
          rows: reportQuery.data.data.rows,
          columns: [
            { header: 'Fecha negocio', value: (row) => row.businessDate },
            { header: 'Cobrador', value: (row) => row.collectorName },
            { header: 'Tipo', value: (row) => (row.isAutoClosed ? 'Automatico' : 'Manual') },
            { header: 'Cobrado', value: (row) => formatCurrency(row.totalCollected) },
            { header: 'Gastos', value: (row) => formatCurrency(row.totalExpenses) },
            { header: 'Neto', value: (row) => formatCurrency(row.net) },
          ],
        });
      }

      toast.success('Se abrio la vista de impresion para PDF');
    } catch (error: any) {
      toast.error(error.message || 'No se pudo exportar en PDF');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Genera y exporta reportes de cobranza, cartera, movimientos y cierres.
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <TabButton
            label="Resumen cobranza"
            active={activeTab === 'collection'}
            onClick={() => setActiveTab('collection')}
          />
          <TabButton
            label="Estado cartera"
            active={activeTab === 'portfolio'}
            onClick={() => setActiveTab('portfolio')}
          />
          <TabButton
            label="Movimientos"
            active={activeTab === 'movements'}
            onClick={() => setActiveTab('movements')}
          />
          <TabButton
            label="Cierres de caja"
            active={activeTab === 'closures'}
            onClick={() => setActiveTab('closures')}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Cobrador
            </label>
            <select
              value={filters.collectorId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, collectorId: event.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {collectors.map((collector) => (
                <option key={collector.id} value={collector.id}>
                  {collector.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Fecha desde
            </label>
            <input
              type="date"
              value={filters.from}
              onChange={(event) =>
                setFilters((current) => ({ ...current, from: event.target.value }))
              }
              disabled={activeTab === 'portfolio'}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Fecha hasta
            </label>
            <input
              type="date"
              value={filters.to}
              onChange={(event) =>
                setFilters((current) => ({ ...current, to: event.target.value }))
              }
              disabled={activeTab === 'portfolio'}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleApplyFilters}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Filter size={16} />
              Aplicar
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">
            Filtros activos: {selectedCollectorName}
            {activeTab !== 'portfolio' &&
              ` | ${appliedFilters.from || '-'} a ${appliedFilters.to || '-'}`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              disabled={!reportQuery.data || reportQuery.isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={!reportQuery.data || reportQuery.isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {reportQuery.isLoading ? (
          <div className="flex h-56 items-center justify-center text-gray-600">
            <Loader2 size={20} className="mr-2 animate-spin" />
            Generando reporte...
          </div>
        ) : reportQuery.data?.type === 'collection' ? (
          <CollectionSummaryView report={reportQuery.data.data} />
        ) : reportQuery.data?.type === 'portfolio' ? (
          <PortfolioStatusView report={reportQuery.data.data} />
        ) : reportQuery.data?.type === 'movements' ? (
          <MovementsView report={reportQuery.data.data} />
        ) : reportQuery.data?.type === 'closures' ? (
          <CashClosuresView report={reportQuery.data.data} />
        ) : (
          <div className="px-6 py-16 text-center text-gray-500">
            <CalendarRange className="mx-auto mb-2 h-6 w-6" />
            Sin datos para mostrar.
          </div>
        )}
      </section>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

function CollectionSummaryView({ report }: { report: CollectionSummaryReport }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 border-b border-gray-100 px-5 py-4 sm:grid-cols-3">
        <Metric label="Cobrado total" value={formatCurrency(report.totals.totalCollected)} />
        <Metric label="Gastos total" value={formatCurrency(report.totals.totalExpenses)} />
        <Metric label="Neto total" value={formatCurrency(report.totals.net)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 font-semibold text-gray-600">Cobrador</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Telefono</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Cobrado</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Gastos</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Neto</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                  Sin resultados para este filtro.
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <tr key={row.collectorId} className="border-b border-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-900">{row.collectorName}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{row.collectorPhone}</td>
                  <td className="px-5 py-3 text-green-700">
                    {formatCurrency(row.totalCollected)}
                  </td>
                  <td className="px-5 py-3 text-red-700">{formatCurrency(row.totalExpenses)}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">
                    {formatCurrency(row.net)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PortfolioStatusView({ report }: { report: PortfolioStatusReport }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 border-b border-gray-100 px-5 py-4 sm:grid-cols-4">
        <Metric label="Prestamos activos" value={String(report.totals.activeLoans)} />
        <Metric label="Capital colocado" value={formatCurrency(report.totals.totalPrincipal)} />
        <Metric label="Total pagado" value={formatCurrency(report.totals.totalPaid)} />
        <Metric label="Total pendiente" value={formatCurrency(report.totals.totalRemaining)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 font-semibold text-gray-600">Prestamo</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Cliente</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Cobrador</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Original</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Pagado</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                  Sin prestamos activos para este filtro.
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <tr key={row.loanId} className="border-b border-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-900">{row.loanNumber}</p>
                    <p className="text-xs text-gray-500">Inicio: {formatDate(row.disbursedAt)}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-gray-900">{row.clientName}</p>
                    <p className="text-xs text-gray-500">{row.clientCedula}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{row.collectorName}</td>
                  <td className="px-5 py-3 text-gray-700">{formatCurrency(row.principalAmount)}</td>
                  <td className="px-5 py-3 text-green-700">{formatCurrency(row.paidAmount)}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">
                    {formatCurrency(row.remainingAmount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovementsView({ report }: { report: MovementHistoryReport }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 border-b border-gray-100 px-5 py-4 sm:grid-cols-4">
        <Metric label="Movimientos" value={String(report.totals.movementsCount)} />
        <Metric label="Cobrado" value={formatCurrency(report.totals.totalCollected)} />
        <Metric label="Gastos" value={formatCurrency(report.totals.totalExpenses)} />
        <Metric label="Neto" value={formatCurrency(report.totals.net)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 font-semibold text-gray-600">Fecha y hora</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Tipo</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Cobrador</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Detalle</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                  Sin movimientos para este rango.
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-50">
                  <td className="px-5 py-3 text-gray-700">{formatDateTime(row.timestamp)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        row.type === 'PAYMENT'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {row.type === 'PAYMENT' ? 'Cobro' : 'Gasto'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{row.collectorName}</td>
                  <td className="px-5 py-3">
                    <p className="text-gray-900">{row.description || '-'}</p>
                    <p className="text-xs text-gray-500">
                      {row.clientName ? `${row.clientName} / ${row.loanNumber}` : row.category || '-'}
                    </p>
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-900">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CashClosuresView({ report }: { report: CashClosuresReport }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 border-b border-gray-100 px-5 py-4 sm:grid-cols-4">
        <Metric label="Cierres" value={String(report.totals.closuresCount)} />
        <Metric label="Manuales" value={String(report.totals.manualClosures)} />
        <Metric label="Automaticos" value={String(report.totals.autoClosures)} />
        <Metric label="Neto total" value={formatCurrency(report.totals.totalNet)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 font-semibold text-gray-600">Fecha negocio</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Cobrador</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Tipo cierre</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Cobrado</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Gastos</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Neto</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Cerrado en</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                  Sin cierres en este periodo.
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <tr key={row.shiftId} className="border-b border-gray-50">
                  <td className="px-5 py-3 text-gray-700">{row.businessDate}</td>
                  <td className="px-5 py-3 text-gray-900">{row.collectorName}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        row.isAutoClosed
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {row.isAutoClosed ? 'Automatico' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-green-700">
                    {formatCurrency(row.totalCollected)}
                  </td>
                  <td className="px-5 py-3 text-red-700">{formatCurrency(row.totalExpenses)}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">
                    {formatCurrency(row.net)}
                  </td>
                  <td className="px-5 py-3 text-gray-700">{formatDateTime(row.closedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
