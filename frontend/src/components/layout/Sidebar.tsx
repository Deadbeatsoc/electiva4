import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Banknote,
  CreditCard,
  Wallet,
  FileText,
  UserCog,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useEffect } from 'react';
import { normalizeRole } from '../../router/roleUtils';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const panelNavItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={19} />, label: 'Dashboard' },
  { to: '/reports',   icon: <FileText size={19} />,         label: 'Reportes' },
];

const fieldNavItems: NavItem[] = [
  { to: '/cash-register', icon: <Wallet size={19} />,    label: 'Caja' },
  { to: '/payments',      icon: <CreditCard size={19} />, label: 'Cobros / Pagos' },
  { to: '/clients',       icon: <Users size={19} />,      label: 'Clientes' },
  { to: '/loans',         icon: <Banknote size={19} />,   label: 'Prestamos' },
];

const adminNavItems: NavItem[] = [
  { to: '/admin/users', icon: <UserCog size={19} />, label: 'Usuarios' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUIStore();
  const { user } = useAuthStore();

  const role        = normalizeRole(user?.role?.name);
  const isAdmin     = role === 'admin';
  const mainNavItems =
    role === 'cobrador'
      ? fieldNavItems
      : role === 'admin' || role === 'auxiliar'
      ? panelNavItems
      : [];

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarCollapsed]);

  /** Build NavLink class string */
  const navLinkClasses = (isActive: boolean) =>
    [
      'nav-item group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
      isActive
        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-700/30 nav-item-active pl-4'
        : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-100 hover:pl-4',
    ].join(' ');

  return (
    <>
      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full flex-col bg-[#0f172a] text-white transition-all duration-300 ease-in-out md:relative md:z-auto ${
          sidebarCollapsed
            ? '-translate-x-full md:translate-x-0 md:w-[68px]'
            : 'w-[260px] translate-x-0'
        }`}
        style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >

        {/* ── Header ── */}
        <div className="flex h-16 items-center justify-between border-b border-slate-700/50 px-4">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-700/40">
                <Banknote size={16} className="text-white" strokeWidth={2} />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-white truncate">
                Cobros Diarios
              </span>
            </div>
          )}

          {/* Collapse toggle — desktop */}
          <button
            onClick={toggleSidebar}
            className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-200 active:scale-90 md:flex items-center justify-center"
            title={sidebarCollapsed ? 'Expandir menu' : 'Colapsar menu'}
          >
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>

          {/* Close — mobile */}
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-200 active:scale-90 md:hidden"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">

          {/* Section label */}
          {!sidebarCollapsed && (
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
              Menu
            </p>
          )}

          <ul className="flex flex-col gap-0.5">
            {mainNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => navLinkClasses(isActive)}
                  onClick={() => { if (window.innerWidth < 768) setSidebarCollapsed(true); }}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {/* Icon */}
                  <span className="flex shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-110">
                    {item.icon}
                  </span>
                  {/* Label */}
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Admin section */}
          {isAdmin && (
            <>
              <div className="my-4 border-t border-slate-700/50" />
              {!sidebarCollapsed && (
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                  Administracion
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {adminNavItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => navLinkClasses(isActive)}
                      onClick={() => { if (window.innerWidth < 768) setSidebarCollapsed(true); }}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="flex shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-110">
                        {item.icon}
                      </span>
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        {/* ── Footer ── */}
        <div className="border-t border-slate-700/50 px-4 py-3">
          {sidebarCollapsed ? (
            <div className="flex h-6 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">v1.0.0</span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-700">
                BETA
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
