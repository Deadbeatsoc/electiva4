import { Menu, LogOut } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

/** Derive initials from a full name */
function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Role badge colour */
function roleBadgeClass(roleName?: string | null): string {
  switch (roleName?.toLowerCase()) {
    case 'admin':    return 'bg-violet-100 text-violet-700 ring-1 ring-violet-200';
    case 'auxiliar': return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
    case 'cobrador': return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
    default:         return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
  }
}

/** Avatar gradient by role */
function avatarGradient(roleName?: string | null): string {
  switch (roleName?.toLowerCase()) {
    case 'admin':    return 'from-violet-500 to-purple-600';
    case 'auxiliar': return 'from-amber-400 to-orange-500';
    case 'cobrador': return 'from-emerald-500 to-green-600';
    default:         return 'from-blue-500 to-blue-700';
  }
}

export default function Topbar() {
  const { toggleSidebar } = useUIStore();
  const { user, logout }  = useAuthStore();
  const navigate          = useNavigate();

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      /* proceed even if API call fails */
    } finally {
      logout();
      navigate('/login');
      toast.success('Sesion cerrada correctamente');
    }
  };

  const initials   = getInitials(user?.name);
  const roleName   = user?.role?.name;
  const roleGrad   = avatarGradient(roleName);
  const badgeClass = roleBadgeClass(roleName);

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 shadow-sm backdrop-blur-sm">

      {/* ── Left ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-xl p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700 active:scale-90"
          title="Toggle menu"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb-style title */}
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-sm font-medium text-gray-400">Cobros Diarios</span>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-700">Panel</span>
        </div>
      </div>

      {/* ── Right ── */}
      <div className="flex items-center gap-2.5">

        {/* Role badge — desktop only */}
        <span
          className={`hidden rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide md:inline-flex ${badgeClass}`}
        >
          {roleName ?? 'Sin rol'}
        </span>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200" />

        {/* User pill */}
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-md ${roleGrad}`}
            aria-label={`Avatar de ${user?.name ?? 'usuario'}`}
          >
            {initials}
          </div>

          {/* Name + role */}
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-gray-800">
              {user?.name ?? 'Usuario'}
            </p>
            <p className="text-[11px] leading-tight text-gray-400">
              {roleName ?? 'Sin rol'}
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="group flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-gray-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600 active:scale-95"
          title="Cerrar sesion"
        >
          <LogOut size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
