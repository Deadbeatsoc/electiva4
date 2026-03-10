import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { clientsService } from '../../services/clients.service';

interface LoanSummary {
  id: string;
  loanNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  createdAt: string;
}

interface ClientListItem {
  id: string;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  notes: string | null;
  isActive: boolean;
  lastContactAt: string;
  hasActiveLoan: boolean;
  activeLoan: LoanSummary | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const createClientSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  cedula: z.string().min(5, 'La cedula es requerida'),
  phone: z.string().min(7, 'El telefono debe tener al menos 7 digitos'),
  address: z.string().min(5, 'La direccion es requerida'),
  notes: z.string().max(500, 'Las notas no pueden superar 500 caracteres').optional(),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

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

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const limit = 12;

  const clientsQuery = useQuery({
    queryKey: ['clients', { page, limit, search }],
    queryFn: () =>
      clientsService.getAll({
        page,
        limit,
        search: search || undefined,
      }),
  });

  const createClientMutation = useMutation({
    mutationFn: (data: CreateClientFormData) => clientsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente creado correctamente');
      setIsModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'No se pudo crear el cliente');
    },
  });

  const clients: ClientListItem[] = useMemo(
    () => clientsQuery.data?.data?.data || [],
    [clientsQuery.data]
  );
  const pagination: PaginationMeta | undefined = clientsQuery.data?.data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || clients.length;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <Users size={28} className="text-blue-600" />
            Mis clientes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Administra tu cartera de clientes ({total} registrados)
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          Nuevo cliente
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
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
            placeholder="Buscar por nombre o cedula..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Cedula</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Prestamo activo</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Ultimo contacto</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientsQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 size={20} className="animate-spin" />
                      Cargando clientes...
                    </div>
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No hay clientes para mostrar
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.phone}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{client.cedula}</td>
                    <td className="px-6 py-4">
                      {client.hasActiveLoan && client.activeLoan ? (
                        <div>
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            Activo
                          </span>
                          <p className="mt-1 text-xs text-gray-500">
                            Saldo: {formatCurrency(client.activeLoan.remainingAmount)}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Sin prestamo activo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {formatDate(client.lastContactAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <Link
                          to={`/clients/${client.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          <Eye size={14} />
                          Ver detalle
                        </Link>
                      </div>
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

      {isModalOpen && (
        <CreateClientModal
          isSubmitting={createClientMutation.isPending}
          onClose={() => setIsModalOpen(false)}
          onSubmit={(data) => createClientMutation.mutate(data)}
        />
      )}
    </div>
  );
}

function CreateClientModal({
  isSubmitting,
  onClose,
  onSubmit,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateClientFormData) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema as any),
    defaultValues: {
      name: '',
      cedula: '',
      phone: '',
      address: '',
      notes: '',
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Crear cliente</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              {...register('name')}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Cedula
              </label>
              <input
                type="text"
                {...register('cedula')}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                  errors.cedula ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.cedula && (
                <p className="mt-1 text-xs text-red-600">{errors.cedula.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Telefono
              </label>
              <input
                type="text"
                {...register('phone')}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                  errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Direccion</label>
            <input
              type="text"
              {...register('address')}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.address ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.address && (
              <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Notas (opcional)
            </label>
            <textarea
              rows={3}
              {...register('notes')}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.notes ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.notes && (
              <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>
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
                'Guardar cliente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
