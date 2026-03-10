import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  WalletCards,
} from 'lucide-react';
import { loansService } from '../../services/loans.service';
import { Link } from 'react-router-dom';

interface LoanRow {
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

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'ACTIVE') return 'bg-green-100 text-green-700';
  if (normalized === 'COMPLETED') return 'bg-blue-100 text-blue-700';
  if (normalized === 'RENEWED') return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-600';
}

export default function LoansPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'COMPLETED' | 'RENEWED' | ''>('');
  const limit = 12;

  const loansQuery = useQuery({
    queryKey: ['loans', { page, limit, search, status }],
    queryFn: () =>
      loansService.getAll({
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  const loans: LoanRow[] = loansQuery.data?.data?.data || [];
  const pagination: PaginationMeta | undefined = loansQuery.data?.data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || loans.length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
          <WalletCards size={28} className="text-blue-600" />
          Mis prestamos
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Seguimiento de prestamos creados ({total} registros)
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
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
            placeholder="Buscar por cliente o cedula..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as 'ACTIVE' | 'COMPLETED' | 'RENEWED' | '');
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="COMPLETED">Completados</option>
          <option value="RENEWED">Renovados</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 font-semibold text-gray-600">Prestamo</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Saldo</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loansQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 size={20} className="animate-spin" />
                      Cargando prestamos...
                    </div>
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No hay prestamos para mostrar
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr
                    key={loan.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{loan.loanNumber}</p>
                      <p className="text-xs text-gray-500">
                        Total: {formatCurrency(loan.totalAmount)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/clients/${loan.client.id}`}
                        className="font-medium text-blue-700 hover:text-blue-800"
                      >
                        {loan.client.name}
                      </Link>
                      <p className="text-xs text-gray-500">{loan.client.cedula}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(
                          loan.status
                        )}`}
                      >
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {formatCurrency(loan.remainingAmount)}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{formatDate(loan.createdAt)}</td>
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
    </div>
  );
}
