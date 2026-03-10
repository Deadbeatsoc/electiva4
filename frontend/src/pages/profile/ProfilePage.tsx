import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { User, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { useState } from 'react';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contrasena actual es requerida'),
    newPassword: z.string().min(6, 'La nueva contrasena debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme la nueva contrasena'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema as any),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setIsChangingPassword(true);
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Contrasena actualizada correctamente');
      reset();
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Error al cambiar la contrasena';
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mi Perfil</h1>
        <p className="text-sm text-gray-500 mt-1">
          Informacion de su cuenta y configuraciones
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Info Card */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <User size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              Informacion Personal
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Nombre</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-lg px-4 py-2.5">
                {user?.name || '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">
                Correo electronico
              </label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-lg px-4 py-2.5">
                {user?.email || '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Telefono</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-lg px-4 py-2.5">
                {user?.phone || '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Rol</label>
              <p className="mt-1">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                  {user?.role?.name || 'Sin rol'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Lock size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              Cambiar Contrasena
            </h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              Si olvida su contrasena y no recuerda la actual, debe solicitar
              el cambio al administrador.
            </p>
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Contrasena actual
              </label>
              <input
                id="currentPassword"
                type="password"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.currentPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-white'
                }`}
                placeholder="Ingrese su contrasena actual"
                {...register('currentPassword')}
              />
              {errors.currentPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Nueva contrasena
              </label>
              <input
                id="newPassword"
                type="password"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.newPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-white'
                }`}
                placeholder="Ingrese la nueva contrasena"
                {...register('newPassword')}
              />
              {errors.newPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Confirmar nueva contrasena
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.confirmPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-white'
                }`}
                placeholder="Repita la nueva contrasena"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Cambiando contrasena...
                </>
              ) : (
                'Cambiar contrasena'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
