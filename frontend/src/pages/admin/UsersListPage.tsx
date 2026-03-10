import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  KeyRound,
  Loader2,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  UserCog,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '../../services/auth.service';
import { rolesService } from '../../services/roles.service';
import { usersService } from '../../services/users.service';
import type { User } from '../../types/auth.types';

const createUserSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().min(1, 'El correo es requerido').email('Correo invalido'),
  phone: z.string().min(7, 'El telefono debe tener al menos 7 digitos'),
  password: z.string().min(8, 'La contrasena inicial debe tener al menos 8 caracteres'),
  roleId: z.string().min(1, 'Seleccione un rol'),
});

const editUserSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().min(1, 'El correo es requerido').email('Correo invalido'),
  phone: z.string().min(7, 'El telefono debe tener al menos 7 digitos'),
  roleId: z.string().min(1, 'Seleccione un rol'),
});

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'La nueva contrasena debe tener al menos 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirme la nueva contrasena'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
  });

type CreateUserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface RoleOption {
  id: string;
  name: string;
}

interface PaginationMeta {
  page: number;
  total: number;
  totalPages: number;
}

function isManagedRole(roleName?: string) {
  const role = (roleName || '').toLowerCase();
  return role === 'auxiliar' || role === 'cobrador';
}

export default function UsersListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const limit = 10;

  const usersQuery = useQuery({
    queryKey: ['users', { page, limit, search }],
    queryFn: () => usersService.getAll({ page, limit, search: search || undefined }),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles', 'managed'],
    queryFn: () => rolesService.getAll(),
  });

  const users: User[] = usersQuery.data?.data?.data || [];
  const pagination: PaginationMeta | undefined = usersQuery.data?.data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || users.length;

  const roles: RoleOption[] = useMemo(() => {
    const allRoles: RoleOption[] = rolesQuery.data?.data?.data || [];
    return allRoles.filter((role) => isManagedRole(role.name));
  }, [rolesQuery.data]);

  const createMutation = useMutation({
    mutationFn: (data: CreateUserFormData) => usersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario creado correctamente');
      closeUserModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el usuario');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditUserFormData }) =>
      usersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario actualizado correctamente');
      closeUserModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el usuario');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => usersService.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Estado del usuario actualizado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cambiar el estado');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      authService.resetUserPassword(userId, { newPassword }),
    onSuccess: () => {
      toast.success('Contrasena restablecida correctamente');
      setResetPasswordUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al restablecer la contrasena');
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const closeUserModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <UserCog className="text-blue-600" size={28} />
            Gestion de Usuarios
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Administre usuarios, estado y contrasenas ({total} total)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
        >
          <Plus size={18} />
          Nuevo usuario
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
            placeholder="Buscar por nombre, email o telefono..."
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Email</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Telefono</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Rol</th>
                <th className="px-6 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 size={20} className="animate-spin" />
                      Cargando usuarios...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-gray-600">{user.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {user.role?.name || 'Sin rol'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          title="Editar usuario"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setResetPasswordUser(user)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                          title="Restablecer contrasena"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => toggleActiveMutation.mutate(user.id)}
                          className={`rounded-lg p-2 transition-colors ${
                            user.isActive
                              ? 'text-green-500 hover:bg-red-50 hover:text-red-600'
                              : 'text-red-500 hover:bg-green-50 hover:text-green-600'
                          }`}
                          title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                        >
                          {user.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
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

      {modalOpen && (
        <UserFormModal
          editingUser={editingUser}
          roles={roles}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onClose={closeUserModal}
          onSubmitCreate={(data) => createMutation.mutate(data)}
          onSubmitEdit={(data) => {
            if (!editingUser) return;
            updateMutation.mutate({ id: editingUser.id, data });
          }}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          isSubmitting={resetPasswordMutation.isPending}
          onClose={() => setResetPasswordUser(null)}
          onSubmit={(newPassword) =>
            resetPasswordMutation.mutate({ userId: resetPasswordUser.id, newPassword })
          }
        />
      )}
    </div>
  );
}

interface UserFormModalProps {
  editingUser: User | null;
  roles: RoleOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmitCreate: (data: CreateUserFormData) => void;
  onSubmitEdit: (data: EditUserFormData) => void;
}

type UserFormValues = {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  password?: string;
};

function UserFormModal({
  editingUser,
  roles,
  isSubmitting,
  onClose,
  onSubmitCreate,
  onSubmitEdit,
}: UserFormModalProps) {
  const isEditing = !!editingUser;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver((isEditing ? editUserSchema : createUserSchema) as any),
    defaultValues: isEditing
      ? {
          name: editingUser.name,
          email: editingUser.email,
          phone: editingUser.phone || '',
          roleId: editingUser.role?.id || '',
        }
      : {
          name: '',
          email: '',
          phone: '',
          password: '',
          roleId: '',
        },
  });

  const onSubmit = (data: UserFormValues) => {
    if (isEditing) {
      onSubmitEdit({
        name: data.name,
        email: data.email,
        phone: data.phone,
        roleId: data.roleId,
      });
      return;
    }
    onSubmitCreate(data as CreateUserFormData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEditing ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nombre completo
            </label>
            <input
              type="text"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Nombre del usuario"
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Correo electronico
            </label>
            <input
              type="email"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="correo@ejemplo.com"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Telefono</label>
            <input
              type="text"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="3000000000"
              {...register('phone')}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>

          {!isEditing && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Contrasena inicial
              </label>
              <input
                type="password"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                  errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Minimo 8 caracteres"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Rol</label>
            <select
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.roleId ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              {...register('roleId')}
            >
              <option value="">Seleccione un rol</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {errors.roleId && <p className="mt-1 text-xs text-red-600">{errors.roleId.message}</p>}
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
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : isEditing ? (
                'Actualizar usuario'
              ) : (
                'Crear usuario'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ResetPasswordModalProps {
  user: User;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
}

function ResetPasswordModal({
  user,
  isSubmitting,
  onClose,
  onSubmit,
}: ResetPasswordModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema as any),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Restablecer contrasena</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Se actualizara la contrasena de <strong>{user.name}</strong>.
        </p>

        <form
          onSubmit={handleSubmit((data) => onSubmit(data.newPassword))}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nueva contrasena
            </label>
            <input
              type="password"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.newPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Minimo 8 caracteres"
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirmar contrasena
            </label>
            <input
              type="password"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Repita la contrasena"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
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
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar contrasena'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
