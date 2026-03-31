import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatDuration } from '../../utils/helpers';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Camera,
  AlertTriangle,
  MapPin,
  ArrowRight,
  TrendingUp,
  Briefcase,
  Sparkles,
  Bell,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AgentDashboard() {
  const { user } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const { records, fetchRecords } = useAttendanceStore();

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  if (!user) return null;

  const myEvents = events
    .filter((e) => e.assignedAgentIds.includes(user.id))
    .map(e => ({
      ...e,
      shifts: (e.shifts || []).filter(s => !s.agentId || s.agentId === user!.id),
    }));
  const myRecords = records.filter((r) => r.agentId === user.id);

  const activeEvents = myEvents.filter(
    (e) => e.status === 'en_cours' || e.status === 'planifie',
  );
  const pendingEvents = myEvents.filter((e) => e.agentResponses?.[user.id] === 'pending');
  const totalValidatedHours = myRecords
    .filter((r) => r.status === 'valide')
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const pendingHours = myRecords
    .filter((r) => r.status === 'en_attente')
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

  const todayD = new Date();
  const today = `${todayD.getFullYear()}-${String(todayD.getMonth()+1).padStart(2,'0')}-${String(todayD.getDate()).padStart(2,'0')}`;
  const todayEvents = myEvents.filter(
    (e) => e.startDate.slice(0, 10) <= today && e.endDate.slice(0, 10) >= today,
  );
  const todayRecords = myRecords.filter((r) => r.date === today);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <div className="p-4 space-y-5 animate-fadeIn">
      {/* Welcome card — rich gradient with pattern */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl shadow-primary-600/20">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/5 rounded-full" />
        <div className="absolute top-4 right-6 opacity-20">
          <Sparkles size={28} />
        </div>

        <p className="text-primary-200 text-sm font-medium">{greeting()} 👋</p>
        <h1 className="text-2xl font-extrabold mt-1 tracking-tight">
          {user.firstName}
        </h1>
        <p className="text-primary-200/80 text-sm mt-1.5 flex items-center gap-1.5">
          <CalendarDays size={14} />
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>

        {/* Quick check-in button */}
        {todayEvents.length > 0 && todayRecords.length === 0 && (
          <Link
            to="/agent/pointage"
            className="mt-5 flex items-center justify-center gap-2.5 w-full py-3.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-2xl text-white font-bold text-sm transition-all duration-200 border border-white/10 active:scale-[0.98]"
          >
            <Camera size={18} strokeWidth={2.5} />
            Pointer mon arrivée
            <ArrowRight size={16} className="ml-auto opacity-60" />
          </Link>
        )}
      </div>

      {/* Stats grid — cards with icons and subtle gradients */}
      <div className="grid grid-cols-2 gap-3">
        <div className="group bg-white rounded-2xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-primary-50 text-primary-500 group-hover:bg-primary-100 transition-colors">
              <Briefcase size={16} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Missions</span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeEvents.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">actives</p>
        </div>

        <div className="group bg-white rounded-2xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-500 group-hover:bg-amber-100 transition-colors">
              <Clock size={16} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">En attente</span>
          </div>
          <p className="text-3xl font-extrabold text-amber-600 tracking-tight">{pendingHours.toFixed(1)}<span className="text-lg">h</span></p>
          <p className="text-[11px] text-slate-400 mt-0.5">à valider</p>
        </div>

        <div className="group bg-white rounded-2xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-500 group-hover:bg-emerald-100 transition-colors">
              <CheckCircle2 size={16} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Validées</span>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">{totalValidatedHours.toFixed(1)}<span className="text-lg">h</span></p>
          <p className="text-[11px] text-slate-400 mt-0.5">ce mois</p>
        </div>

        <div className="group bg-white rounded-2xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-xl ${user.canRefuseEvents ? 'bg-orange-50 text-orange-500 group-hover:bg-orange-100' : 'bg-primary-50 text-primary-500 group-hover:bg-primary-100'} transition-colors`}>
              {user.canRefuseEvents ? <AlertTriangle size={16} strokeWidth={2.5} /> : <Bell size={16} strokeWidth={2.5} />}
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{user.canRefuseEvents ? 'À répondre' : 'Nouvelles'}</span>
          </div>
          <p className={`text-3xl font-extrabold tracking-tight ${user.canRefuseEvents ? 'text-orange-600' : 'text-primary-600'}`}>{pendingEvents.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{pendingEvents.length > 0 ? 'mission' + (pendingEvents.length > 1 ? 's' : '') : 'aucune'}</p>
        </div>
      </div>

      {/* Today's missions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary-50">
              <CalendarDays size={14} className="text-primary-500" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Missions du jour</h2>
          </div>
          <Link
            to="/agent/planning"
            className="text-xs text-primary-600 font-semibold flex items-center gap-1 hover:text-primary-700 transition-colors"
          >
            Tout voir <ArrowRight size={12} />
          </Link>
        </div>
        {todayEvents.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {todayEvents.map((event, idx) => {
              const attendance = todayRecords.find((r) => r.eventId === event.id);
              return (
                <div
                  key={event.id}
                  className="px-5 py-4 hover:bg-slate-50/50 transition-colors"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Color dot indicator */}
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ring-4 ring-opacity-20"
                        style={{
                          backgroundColor: event.color,
                          boxShadow: `0 0 0 4px ${event.color}20`,
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                          <Clock size={11} className="text-slate-400" />
                          {event.shifts?.filter(s => s.date === today).length > 0
                            ? event.shifts.filter(s => s.date === today).map(s => `${s.startTime} → ${s.endTime}`).join(' | ')
                            : `${event.shifts?.length || 0} créneau${(event.shifts?.length || 0) > 1 ? 'x' : ''}`}
                        </div>
                        {event.address && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                            <MapPin size={11} />
                            <span className="truncate">{event.address.split(',')[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge status={event.status} />
                      {attendance && (
                        <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                          attendance.checkOutTime
                            ? 'text-emerald-600'
                            : attendance.checkInTime
                            ? 'text-amber-600'
                            : 'text-slate-400'
                        }`}>
                          <CheckCircle2 size={11} />
                          {attendance.checkInTime && !attendance.checkOutTime
                            ? 'En cours'
                            : attendance.checkOutTime
                            ? 'Terminé'
                            : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-slate-50 mb-3">
              <CalendarDays size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">Aucune mission aujourd'hui</p>
            <p className="text-xs text-slate-300 mt-1">Profitez de votre journée !</p>
          </div>
        )}
      </div>

      {/* Pending responses / New missions */}
      {pendingEvents.length > 0 && (
        <div className={`rounded-2xl border shadow-card overflow-hidden ${
          user.canRefuseEvents
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60'
            : 'bg-gradient-to-br from-primary-50 to-blue-50 border-primary-200/60'
        }`}>
          <div className={`px-5 py-4 border-b ${user.canRefuseEvents ? 'border-amber-200/40' : 'border-primary-200/40'}`}>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${user.canRefuseEvents ? 'text-amber-800' : 'text-primary-800'}`}>
              <div className={`p-1.5 rounded-lg ${user.canRefuseEvents ? 'bg-amber-100' : 'bg-primary-100'}`}>
                {user.canRefuseEvents
                  ? <AlertTriangle size={14} className="text-amber-600" />
                  : <Bell size={14} className="text-primary-600" />}
              </div>
              {user.canRefuseEvents ? 'Missions en attente de réponse' : 'Nouvelles missions assignées'}
            </h2>
          </div>
          <div className={`divide-y ${user.canRefuseEvents ? 'divide-amber-100/60' : 'divide-primary-100/60'}`}>
            {pendingEvents.map((event) => (
              <div key={event.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <CalendarDays size={11} />
                      {formatDate(event.startDate)}
                    </p>
                    {event.address && (
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <MapPin size={11} />
                        {event.address.split(',')[0]}
                      </p>
                    )}
                  </div>
                  {user.canRefuseEvents ? (
                    <Link
                      to="/agent/planning"
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-sm active:scale-95 flex items-center gap-1.5 flex-shrink-0"
                    >
                      Répondre
                      <ArrowRight size={12} />
                    </Link>
                  ) : (
                    <Link
                      to="/agent/planning"
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-sm active:scale-95 flex items-center gap-1.5 flex-shrink-0"
                    >
                      Voir
                      <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats footer */}
      {myRecords.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-primary-500" />
            <h3 className="text-sm font-bold text-slate-900">Récapitulatif</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Total pointages</p>
              <p className="text-lg font-bold text-slate-900">{myRecords.length}</p>
            </div>
            <div className="h-8 w-px bg-slate-100" />
            <div>
              <p className="text-xs text-slate-400">Heures totales</p>
              <p className="text-lg font-bold text-primary-600">
                {formatDuration(myRecords.reduce((s, r) => s + (r.hoursWorked || 0), 0))}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-100" />
            <div>
              <p className="text-xs text-slate-400">Taux validation</p>
              <p className="text-lg font-bold text-emerald-600">
                {myRecords.filter(r => r.status === 'valide').length > 0
                  ? Math.round((myRecords.filter(r => r.status === 'valide').length / myRecords.length) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
