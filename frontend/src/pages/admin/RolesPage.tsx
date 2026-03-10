import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import {
  Shield,
  Plus,
  Edit2,
  Check,
  X,
  Loader2,
  ChevronRight,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { rolesService } from '../../services/roles.service';

// ---------- Types ----------

interface Permission {
  id: string;
  name: string;
  description?: string;
  module: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
}

// ---------- Schema ----------

const roleSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

// ---------- Component ----------

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Fetch roles
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.getAll(),
  });

  // Fetch all permissions
  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesService.getAllPermissions(),
  });

  // Fetch single role details
  const { data: roleDetailData, isLoading: roleDetailLoading } = useQuery({
    queryKey: ['roles', selectedRole?.id],
    queryFn: () => rolesService.getById(selectedRole!.id),
    enabled: !!selectedRole?.id,
  });

  const roles: Role[] = rolesData?.data?.data || [];
  const allPermissions: Permission[] = permissionsData?.data?.data || [];
  const roleDetail: Role | null = roleDetailData?.data?.data || null;

  // Group permissions by module
  const permissionsByModule = allPermissions.reduce<Record<string, Permission[]>>(
    (acc, perm) => {
      const module = perm.module || 'General';
      if (!acc[module]) acc[module] = [];
      acc[module].push(perm);
      return acc;
    },
    {}
  );

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: (data: RoleFormData) => rolesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Rol creado correctamente');
      setIsCreating(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el rol');
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoleFormData }) =>
      rolesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Rol actualizado correctamente');
      setIsEditingRole(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el rol');
    },
  });

  // Assign permissions mutation
  const assignPermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      rolesService.assignPermissions(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', selectedRole?.id] });
      toast.success('Permisos actualizados correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al asignar permisos');
    },
  });

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setIsCreating(false);
    setIsEditingRole(false);
    // Set current permissions
    const currentPermIds =
      role.permissions?.map((p) => p.id) || [];
    setSelectedPermissions(currentPermIds);
  };

  // When role detail loads, update selected permissions
  const currentRolePermissions =
    roleDetail?.permissions?.map((p) => p.id) || selectedPermissions;

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSavePermissions = () => {
    if (!selectedRole) return;
    assignPermissionsMutation.mutate({
      roleId: selectedRole.id,
      permissionIds: selectedPermissions,
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="text-blue-600" size={28} />
          Gestion de Roles
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Administre los roles y permisos del sistema
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Roles List */}
        <div className="lg:col-span-1">
          <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-700">Roles</h2>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedRole(null);
                  setIsEditingRole(false);
                }}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus size={14} />
                Nuevo
              </button>
            </div>

            <div className="divide-y divide-gray-50">
              {rolesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              ) : roles.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">
                  No hay roles registrados
                </p>
              ) : (
                roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handleSelectRole(role)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                      selectedRole?.id === role.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{role.name}</p>
                      <p className="text-xs text-gray-500">
                        {role.permissions?.length || 0} permisos
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail / Create Panel */}
        <div className="lg:col-span-2">
          {isCreating ? (
            <CreateRoleCard
              onSubmit={(data) => createRoleMutation.mutate(data)}
              onCancel={() => setIsCreating(false)}
              isSubmitting={createRoleMutation.isPending}
            />
          ) : selectedRole ? (
            <div className="space-y-6">
              {/* Role Info Card */}
              <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
                {isEditingRole ? (
                  <EditRoleCard
                    role={selectedRole}
                    onSubmit={(data) =>
                      updateRoleMutation.mutate({ id: selectedRole.id, data })
                    }
                    onCancel={() => setIsEditingRole(false)}
                    isSubmitting={updateRoleMutation.isPending}
                  />
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-800">
                          {selectedRole.name}
                        </h2>
                        {selectedRole.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {selectedRole.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setIsEditingRole(true)}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Edit2 size={14} />
                        Editar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Permissions Card */}
              <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-800">Permisos</h3>
                  <button
                    onClick={handleSavePermissions}
                    disabled={assignPermissionsMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {assignPermissionsMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Guardar permisos
                  </button>
                </div>

                {roleDetailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                ) : Object.keys(permissionsByModule).length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-8">
                    No hay permisos disponibles en el sistema
                  </p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(permissionsByModule).map(([module, perms]) => (
                      <div key={module}>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                          {module}
                        </h4>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {perms.map((perm) => {
                            const isChecked =
                              selectedPermissions.includes(perm.id) ||
                              currentRolePermissions.includes(perm.id);
                            return (
                              <label
                                key={perm.id}
                                className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                                  isChecked
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(perm.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <p className="text-sm font-medium text-gray-800">
                                    {perm.name}
                                  </p>
                                  {perm.description && (
                                    <p className="text-xs text-gray-500">
                                      {perm.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-12 text-center">
              <Shield className="mx-auto mb-4 text-gray-300" size={48} />
              <p className="text-gray-500">
                Seleccione un rol para ver y editar sus permisos
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-Components ----------

function CreateRoleCard({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: RoleFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema as any),
    defaultValues: { name: '', description: '' },
  });

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Crear Nuevo Rol</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nombre del rol
          </label>
          <input
            type="text"
            className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Ej: Cobrador, Administrador"
            {...register('name')}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Descripcion (opcional)
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            placeholder="Descripcion del rol..."
            {...register('description')}
          />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Check size={16} />
                Crear rol
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditRoleCard({
  role,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  role: Role;
  onSubmit: (data: RoleFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema as any),
    defaultValues: { name: role.name, description: role.description || '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Nombre del rol
        </label>
        <input
          type="text"
          className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
          }`}
          {...register('name')}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Descripcion
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={2}
          {...register('description')}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <X size={14} />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-all disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          Guardar
        </button>
      </div>
    </form>
  );
}
