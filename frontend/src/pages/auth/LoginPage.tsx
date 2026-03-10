import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useNavigate, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Banknote, Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import type { LoginResponse } from '../../types/auth.types';
import { getHomeRouteByRole } from '../../router/roleUtils';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo es requerido')
    .email('Ingrese un correo valido'),
  password: z
    .string()
    .min(1, 'La contrasena es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, setAuth, user } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema as any),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to={user ? getHomeRouteByRole(user.role?.name) : '/'} replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await authService.login(data);
      const loginData: LoginResponse = response.data;
      setAuth(loginData.data.user, loginData.data.accessToken);
      toast.success(`Bienvenido, ${loginData.data.user.name}`);
      navigate(getHomeRouteByRole(loginData.data.user.role?.name), { replace: true });
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Error al iniciar sesion. Verifique sus credenciales.';
      toast.error(message);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-4">

      {/* ── Animated background blobs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="animate-blob absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-500/25 blur-3xl"
        />
        <div
          className="animate-blob animation-delay-2000 absolute left-1/2 top-1/4 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div
          className="animate-blob animation-delay-4000 absolute -bottom-24 right-0 h-[28rem] w-[28rem] rounded-full bg-blue-400/20 blur-3xl"
        />
        {/* Subtle dot-grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">

        {/* Pre-card label */}
        <div className="animate-fade-in mb-7 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-100 backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-300" />
            Sistema de Gestion
          </span>
        </div>

        {/* ── Card ── */}
        <div className="animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl shadow-blue-900/50 ring-1 ring-white/20">

          {/* Logo / Header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="animate-float animate-pulse-glow mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl shadow-blue-500/40">
              <Banknote className="h-9 w-9 text-white" strokeWidth={1.75} />
            </div>
            <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight text-gray-900">
              Cobros Diarios
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            {/* Email field */}
            <div className="animate-fade-in-up animation-delay-150">
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                Correo electronico
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail size={16} />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="correo@ejemplo.com"
                  className={`input-field w-full rounded-xl border pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 ${
                    errors.email
                      ? 'border-red-300 bg-red-50 focus:ring-red-400/40 focus:border-red-400'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white'
                  }`}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="animate-fade-in mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                  <span className="text-sm">⚠</span> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div className="animate-fade-in-up animation-delay-300">
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-gray-700"
                >
                  Contrasena
                </label>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={16} />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`input-field w-full rounded-xl border pl-10 pr-12 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 ${
                    errors.password
                      ? 'border-red-300 bg-red-50 focus:ring-red-400/40 focus:border-red-400'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white'
                  }`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-90"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="animate-fade-in mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                  <span className="text-sm">⚠</span> {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit button */}
            <div className="animate-fade-in-up animation-delay-400 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary group flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/35 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar Sesion</span>
                    <ArrowRight
                      size={17}
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="animate-fade-in-up animation-delay-500 my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Seguridad
            </span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          {/* Security badge */}
          <div className="animate-fade-in-up animation-delay-600 flex items-center justify-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 ring-1 ring-green-100">
            <ShieldCheck size={15} className="text-green-600 shrink-0" />
            <span className="text-xs font-medium text-green-700">
              Conexion protegida con encriptacion SSL
            </span>
          </div>
        </div>

        {/* Footer below card */}
        <div className="animate-fade-in animation-delay-700 mt-6 text-center">
          <p className="text-xs text-blue-200/60">
            &copy; {new Date().getFullYear()} Cobros Diarios &middot; Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
