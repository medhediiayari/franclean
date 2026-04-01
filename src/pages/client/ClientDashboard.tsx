import { useEffect, useState, useRef } from 'react';
import { useClientPortalStore } from '../../store/clientPortalStore';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, MapPin, Image, Clock, CheckCircle2, PlayCircle,
  CalendarClock, ArrowRight, Shield, Sparkles, Eye, Zap, Activity,
} from 'lucide-react';

function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = ref.current;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (target - start) * eased);
      setValue(current);
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = target;
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function StatCard({ label, value, icon: Icon, gradient, onClick }: {
  label: string; value: number; icon: typeof ClipboardList; gradient: string; onClick?: () => void;
}) {
  const animatedValue = useAnimatedNumber(value);
  return (
    <div onClick={onClick} className="group relative bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover-lift card-shine cursor-pointer overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-[0.07] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-[0.15] group-hover:scale-150 transition-all duration-700`} />
      <div className="relative">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
          <Icon size={22} className="text-white" />
        </div>
        <p className="animate-number text-3xl font-black text-slate-900 tracking-tight">{animatedValue}</p>
        <p className="text-[10px] font-bold text-slate-400 mt-1 tracking-widest uppercase">{label}</p>
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const { dashboard, missions, fetchDashboard, fetchMissions, loading } = useClientPortalStore();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchDashboard();
    fetchMissions();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [fetchDashboard, fetchMissions]);

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-[3px] border-emerald-100 border-t-emerald-500 animate-spin" />
          <Sparkles size={18} className="absolute inset-0 m-auto text-emerald-500 animate-pulse" />
        </div>
      </div>
    );
  }
  if (!dashboard) return null;

  const recentMissions = missions.slice(0, 5);
  const completionRate = dashboard.totalMissions > 0 ? Math.round((dashboard.missionsTerminees / dashboard.totalMissions) * 100) : 0;
  const statusLabel: Record<string, { label: string; dot: string }> = {
    termine: { label: 'Termine', dot: 'bg-emerald-500' },
    en_cours: { label: 'En cours', dot: 'bg-amber-500 animate-pulse' },
    planifie: { label: 'Planifie', dot: 'bg-blue-500' },
    a_reattribuer: { label: 'A reattribuer', dot: 'bg-red-500' },
  };

  return (
    <div className={`space-y-6 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl mesh-gradient px-7 py-8 md:px-10 md:py-10 shadow-2xl">
        <div className="orb w-32 h-32 bg-emerald-400/20 top-0 right-10" />
        <div className="orb orb-alt w-24 h-24 bg-blue-400/15 bottom-0 left-20" />
        <div className="dot-pattern absolute inset-0" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full mb-4 border border-white/10">
              <Sparkles size={13} className="text-emerald-400" />
              <span className="text-emerald-300 text-[11px] font-bold tracking-widest uppercase">Espace Client</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Bienvenue, <span className="bg-gradient-to-r from-emerald-300 to-emerald-100 bg-clip-text text-transparent">{dashboard.clientName}</span>
            </h1>
            <p className="text-white/50 mt-3 text-sm max-w-lg leading-relaxed">
              Suivez en temps reel vos interventions, consultez les photos et surveillez la qualite de service.
            </p>
          </div>
          <div className="flex-shrink-0 hidden md:flex flex-col items-center">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#cgrad)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${completionRate * 2.64} 264`} className="transition-all duration-[1500ms] ease-out" style={{ transitionDelay: '500ms' }} />
                <defs><linearGradient id="cgrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#10b981" />
                </linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white">{completionRate}%</span>
                <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Complete</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard label="Missions" value={dashboard.totalMissions} icon={ClipboardList} gradient="from-blue-500 to-blue-600" onClick={() => navigate('/client/missions')} />
        <StatCard label="Terminees" value={dashboard.missionsTerminees} icon={CheckCircle2} gradient="from-emerald-500 to-emerald-600" onClick={() => navigate('/client/missions')} />
        <StatCard label="En cours" value={dashboard.missionsEnCours} icon={PlayCircle} gradient="from-amber-500 to-orange-500" onClick={() => navigate('/client/missions')} />
        <StatCard label="Planifiees" value={dashboard.missionsPlanifiees} icon={CalendarClock} gradient="from-violet-500 to-purple-600" onClick={() => navigate('/client/missions')} />
      </div>

      {/* Secondary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <div className="group glass-card rounded-2xl p-5 hover-lift cursor-pointer" onClick={() => navigate('/client/sites')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sites</p>
              <p className="text-3xl font-black text-slate-900">{dashboard.sitesCount}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-100 to-rose-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
              <MapPin size={24} className="text-rose-500" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-rose-500 font-semibold">
            <Eye size={12} /> Voir les sites <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Heures</p>
              <p className="text-3xl font-black text-slate-900">{dashboard.totalHours}<span className="text-lg text-slate-400 font-bold">h</span></p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-100 to-cyan-50 flex items-center justify-center">
              <Clock size={24} className="text-cyan-500" />
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full progress-glow animate-progressBar"
              style={{ '--progress': `${Math.min((dashboard.totalHours / 100) * 100, 100)}%` } as React.CSSProperties} />
          </div>
        </div>
        <div className="group glass-card rounded-2xl p-5 hover-lift cursor-pointer" onClick={() => navigate('/client/photos')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Photos</p>
              <p className="text-3xl font-black text-slate-900">{dashboard.totalPhotos}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
              <Image size={24} className="text-orange-500" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-orange-500 font-semibold">
            <Eye size={12} /> Galerie photos <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Activity size={14} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Activite recente</h2>
            </div>
            <button onClick={() => navigate('/client/missions')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-all">
              Tout voir <ArrowRight size={13} />
            </button>
          </div>
          {recentMissions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <ClipboardList size={24} className="text-slate-200" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Aucune mission pour le moment</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50/80">
              {recentMissions.map((m, i) => {
                const st = statusLabel[m.status] || { label: m.status, dot: 'bg-slate-400' };
                return (
                  <div key={m.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-transparent transition-all cursor-pointer group"
                    onClick={() => navigate('/client/missions')} style={{ animationDelay: `${i * 60}ms` }}>
                    <div className={`w-2.5 h-2.5 rounded-full ${st.dot} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{m.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{m.site || m.address}</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full flex-shrink-0">{st.label}</span>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-xl shadow-emerald-500/20 flex-1 group card-shine">
            <div className="orb w-24 h-24 bg-white/10 -top-6 -right-6" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform duration-500">
                <Shield size={22} className="text-white" />
              </div>
              <h3 className="text-lg font-extrabold">Suivi transparent</h3>
              <p className="text-emerald-100/80 text-sm mt-2 leading-relaxed">Photos, heures et statuts de chaque mission en temps reel.</p>
            </div>
            <button onClick={() => navigate('/client/photos')}
              className="relative mt-5 w-full bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group/btn">
              <Eye size={16} /> Voir les photos <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-500/20 group card-shine">
            <div className="orb w-20 h-20 bg-white/10 -bottom-4 -left-4" />
            <div className="relative flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:rotate-12 transition-transform duration-500 flex-shrink-0">
                <Zap size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold">Acces rapide</h3>
                <p className="text-indigo-200/70 text-xs mt-0.5">Consultez vos missions en un clic</p>
              </div>
              <button onClick={() => navigate('/client/missions')}
                className="ml-auto w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all flex-shrink-0">
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
