import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getInitials } from '../../utils/helpers';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  ClipboardList,
  Image,
  LogOut,
  Sparkles,
  Shield,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { to: '/client', icon: LayoutDashboard, label: 'Tableau de bord', end: true },
  { to: '/client/sites', icon: MapPin, label: 'Sites' },
  { to: '/client/missions', icon: ClipboardList, label: 'Missions' },
  { to: '/client/photos', icon: Image, label: 'Photos' },
];

export default function ClientLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user ? getInitials(user.firstName, user.lastName) : '';

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/60">
      {/* Sidebar */}
      <aside className="hidden md:flex w-[270px] flex-col text-white relative overflow-hidden">
        {/* Animated mesh background */}
        <div className="absolute inset-0 mesh-gradient" />
        <div className="orb w-40 h-40 bg-emerald-400/10 -top-10 -right-10" />
        <div className="orb orb-alt w-28 h-28 bg-blue-400/8 bottom-20 -left-8" />
        <div className="dot-pattern absolute inset-0 opacity-30" />

        {/* Logo / brand */}
        <div className={`px-5 py-6 border-b border-white/[0.06] relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-extrabold shadow-xl shadow-emerald-500/30 ring-2 ring-emerald-400/20">
                {initials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0a1929] animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-white truncate">{user?.firstName} {user?.lastName}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Sparkles size={10} className="text-emerald-400 animate-pulse" />
                <p className="text-[10px] text-emerald-400/80 font-bold tracking-widest uppercase">Espace Client</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 relative">
          {navItems.map(({ to, icon: Icon, label, end }, i) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-semibold transition-all duration-300 group relative overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/25 to-emerald-500/5 text-white shadow-lg shadow-emerald-500/10 border border-emerald-500/20'
                    : 'text-white/45 hover:text-white/90 hover:bg-white/[0.05] border border-transparent'
                }`
              }
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-emerald-400 rounded-r-full shadow-lg shadow-emerald-400/50" />
                  )}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40 scale-105'
                      : 'bg-white/[0.06] group-hover:bg-white/10 group-hover:scale-105'
                  }`}>
                    <Icon size={17} className={isActive ? 'text-white' : ''} />
                  </div>
                  <span className="flex-1">{label}</span>
                  {isActive && (
                    <ChevronRight size={14} className="text-emerald-400/60" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-5 relative space-y-3">
          {/* Trust badge */}
          <div className="mx-1 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 flex items-center justify-center flex-shrink-0">
                <Shield size={14} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Portail sécurisé</p>
                <p className="text-[9px] text-white/30 mt-0.5">Données en temps réel</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-3" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-semibold text-white/35 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-300 w-full group border border-transparent hover:border-rose-500/10"
          >
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] group-hover:bg-rose-500/20 flex items-center justify-center transition-all duration-300">
              <LogOut size={16} />
            </div>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden bg-white/80 backdrop-blur-2xl border-b border-slate-200/40 px-4 py-3 flex items-center sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-extrabold shadow-lg shadow-emerald-500/20">
                {initials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">{user?.firstName}</h1>
              <div className="flex items-center gap-1">
                <Sparkles size={9} className="text-emerald-500" />
                <p className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase">Client</p>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 safe-area-bottom">
          <div className="bg-white/90 backdrop-blur-2xl border-t border-slate-200/40 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-around py-1 px-2 max-w-md mx-auto">
              {navItems.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl text-[10px] font-semibold transition-all duration-300 ${
                      isActive
                        ? 'text-emerald-600'
                        : 'text-slate-400 hover:text-slate-600'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        isActive ? 'bg-gradient-to-br from-emerald-100 to-emerald-50 shadow-sm shadow-emerald-200/50 scale-110' : ''
                      }`}>
                        <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                      </div>
                      <span>{label}</span>
                      {isActive && (
                        <div className="w-4 h-0.5 rounded-full bg-emerald-500 mt-0.5" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
