import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getInitials } from '../../utils/helpers';
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

  const initials = user ? getInitials(user.firstName, user.lastName) : '';

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-slate-100/50">
      {/* Header — glassmorphism */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 flex items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Avatar with initials */}
          <div className="relative">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={`${user.firstName} ${user.lastName}`}
                className="w-10 h-10 rounded-2xl object-cover ring-2 ring-primary-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-primary-500/20">
                {initials}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              FranClean — Agent de terrain
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleLogout}
          className="p-2.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all duration-200 active:scale-95"
          title="Déconnexion"
        >
          <LogOut size={18} strokeWidth={2.5} />
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24 scroll-smooth">
        <Outlet />
      </main>

      {/* Bottom Navigation — modern pill style */}
      <nav className="fixed bottom-0 inset-x-0 z-30 safe-area-bottom">
        <div className="bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-around py-1.5 px-2 max-w-md mx-auto">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl text-[11px] font-semibold transition-all duration-200 ${
                    isActive
                      ? 'text-primary-600 bg-primary-50/80'
                      : 'text-slate-400 hover:text-slate-600 active:scale-95'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <Icon
                        size={20}
                        strokeWidth={isActive ? 2.5 : 1.8}
                        className={`transition-all duration-200 ${isActive ? 'drop-shadow-sm' : ''}`}
                      />
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full animate-scaleIn shadow-sm shadow-primary-500/50" />
                      )}
                    </div>
                    <span className="tracking-tight">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
