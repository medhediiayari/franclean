import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useAppSettingsStore, getLogoSrc } from '../../store/appSettingsStore';
import { useSocket } from '../../lib/socket';
import NotificationPanel from '../common/NotificationPanel';
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Users,
  FileSpreadsheet,
  ListChecks,
  LogOut,
  Menu,
  X,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  Building2,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Tableau de bord', end: true },
  { to: '/admin/planning', icon: CalendarDays, label: 'Planification' },
  { to: '/admin/clients', icon: Building2, label: 'Clients' },
  { to: '/admin/utilisateurs', icon: Users, label: 'Utilisateurs' },
  { to: '/admin/heures', icon: FileSpreadsheet, label: 'Suivi Heures' },
  { to: '/admin/recap', icon: BarChart3, label: 'Récap' },
  { to: '/admin/gestion', icon: ListChecks, label: 'Gestion' },
  { to: '/admin/reglages', icon: Settings, label: 'Réglages' },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const { settings } = useAppSettingsStore();
  const navigate = useNavigate();

  // Socket.IO — handles all real-time data fetching & notification regeneration
  useSocket();

  const notifCount = unreadCount();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#0E2137] transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          collapsed ? 'w-[72px]' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center px-4 py-5 border-b border-[#1B3A5C]/50">
            <img src={getLogoSrc(settings)} alt={settings?.appName ?? 'Bipbip'} className={`rounded-lg object-contain ${collapsed ? 'w-9 h-9' : 'h-12 w-auto max-w-[140px]'}`} />
            {!collapsed && (
              <div className="ml-3">
                <h1 className="text-white font-extrabold text-[22px] leading-tight tracking-tight">{settings?.appName ?? 'Bipbip'}</h1>
                <p className="text-slate-400 text-[13px] mt-0.5">{settings?.appSubtitle ?? 'Gestion RH'}</p>
              </div>
            )}
            {!collapsed && (
              <button
                className="ml-auto lg:hidden text-slate-400 hover:text-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-5 space-y-1.5 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-[#1B3A5C] text-white shadow-lg shadow-[#1B3A5C]/25'
                      : 'text-slate-300 hover:bg-[#122A44] hover:text-white'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} />
                {!collapsed && label}
              </NavLink>
            ))}
          </nav>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden lg:block px-2 py-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Agrandir' : 'Réduire'}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-[#122A44] hover:text-white transition-all duration-150 justify-center"
            >
              {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              {!collapsed && <span>Réduire</span>}
            </button>
          </div>

          {/* User section */}
          <div className={`px-2 py-5 border-t border-[#1B3A5C]/50 space-y-1.5`}>
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                title={collapsed ? 'Notifications' : undefined}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-[#122A44] hover:text-white transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="relative">
                  <Bell size={20} />
                  {notifCount > 0 && collapsed && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] flex items-center justify-center px-1 text-[9px] font-bold bg-rose-500 text-white rounded-full">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </div>
                {!collapsed && 'Notifications'}
                {!collapsed && notifCount > 0 && (
                  <span className="ml-auto min-w-[20px] h-[20px] flex items-center justify-center px-1.5 text-[10px] font-bold bg-rose-500 text-white rounded-full">
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </button>
            </div>

            {/* Déconnexion */}
            <button
              onClick={handleLogout}
              title={collapsed ? 'Déconnexion' : undefined}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
            >
              <LogOut size={20} />
              {!collapsed && 'Déconnexion'}
            </button>

            {/* User info */}
            <div className={`flex items-center gap-3 px-3 py-2 mt-2 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-slate-400">Administrateur</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Notification panel - outside sidebar to avoid transform stacking context */}
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} sidebarCollapsed={collapsed} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-4 sticky top-0 z-30">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="flex-1" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
