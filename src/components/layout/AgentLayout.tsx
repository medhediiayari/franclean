import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard,
  CalendarDays,
  Camera,
  Clock,
  LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/agent', icon: LayoutDashboard, label: 'Accueil', end: true },
  { to: '/agent/planning', icon: CalendarDays, label: 'Planning' },
  { to: '/agent/pointage', icon: Camera, label: 'Pointage' },
  { to: '/agent/heures', icon: Clock, label: 'Heures' },
];

export default function AgentLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
            FC
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">FranClean</h1>
            <p className="text-xs text-slate-400">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation (PWA mobile) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 safe-area-bottom">
        <div className="flex items-center justify-around py-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'text-primary-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1.5 rounded-xl transition-all ${
                      isActive ? 'bg-primary-50' : ''
                    }`}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
