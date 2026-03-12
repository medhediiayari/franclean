import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/helpers';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Camera,
  AlertTriangle,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AgentDashboard() {
  const { user } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const { records, fetchRecords } = useAttendanceStore();

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  if (!user) return null;

  const myEvents = events.filter((e) => e.assignedAgentIds.includes(user.id));
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

  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = myEvents.filter(
    (e) => e.startDate.slice(0, 10) <= today && e.endDate.slice(0, 10) >= today,
  );
  const todayRecords = myRecords.filter((r) => r.date === today);

  return (
    <div className="p-4 space-y-5 animate-fadeIn">
      {/* Welcome */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-5 text-white">
        <p className="text-primary-200 text-sm">Bonjour</p>
        <h1 className="text-xl font-bold mt-0.5">
          {user.firstName} {user.lastName}
        </h1>
        <p className="text-primary-200 text-sm mt-2">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>

        {/* Quick check-in button */}
        {todayEvents.length > 0 && todayRecords.length === 0 && (
          <Link
            to="/agent/pointage"
            className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-white font-semibold text-sm transition-all"
          >
            <Camera size={18} />
            Pointer mon arrivée
          </Link>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={16} className="text-primary-500" />
            <span className="text-xs font-medium text-slate-400">Missions actives</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{activeEvents.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-400">En attente</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{pendingHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-xs font-medium text-slate-400">Heures validées</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{totalValidatedHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-orange-500" />
            <span className="text-xs font-medium text-slate-400">À répondre</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{pendingEvents.length}</p>
        </div>
      </div>

      {/* Today's missions */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Missions du jour</h2>
          <Link
            to="/agent/planning"
            className="text-xs text-primary-600 font-medium flex items-center gap-1"
          >
            Tout voir <ArrowRight size={12} />
          </Link>
        </div>
        {todayEvents.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {todayEvents.map((event) => {
              const attendance = todayRecords.find((r) => r.eventId === event.id);
              return (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Clock size={12} />
                        {event.shifts?.filter(s => s.date === today).length > 0
                          ? event.shifts.filter(s => s.date === today).map(s => `${s.startTime}→${s.endTime}`).join(' | ')
                          : `${event.shifts?.length || 0} créneau${(event.shifts?.length || 0) > 1 ? 'x' : ''}`}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <MapPin size={12} />
                        {event.address.split(',')[0]}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={event.status} />
                      {attendance && (
                        <span className="text-xs text-emerald-600 font-medium">
                          {attendance.checkInTime && !attendance.checkOutTime
                            ? 'Pointé ✓'
                            : attendance.checkOutTime
                            ? 'Terminé ✓'
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
          <div className="px-4 py-8 text-center">
            <CalendarDays size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Aucune mission aujourd'hui</p>
          </div>
        )}
      </div>

      {/* Pending responses */}
      {pendingEvents.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200">
          <div className="px-4 py-3 border-b border-amber-200">
            <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <AlertTriangle size={14} />
              Missions en attente de réponse
            </h2>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingEvents.map((event) => (
              <div key={event.id} className="px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{event.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDate(event.startDate)} — {event.address.split(',')[0]}
                </p>
                <Link
                  to="/agent/planning"
                  className="inline-block mt-2 text-xs text-primary-600 font-semibold"
                >
                  Répondre →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
