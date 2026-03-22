import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useNotificationStore } from '../../store/notificationStore';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import { formatDate, formatTime, formatDuration } from '../../utils/helpers';
import {
  Users,
  CalendarDays,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  Hourglass,
  CalendarX2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const { users, fetchUsers } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const { records, fetchRecords } = useAttendanceStore();
  const { notifications } = useNotificationStore();

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const agents = users.filter((u) => u.role === 'agent');
  const eventsEnCours = events.filter((e) => e.status === 'en_cours');
  const pendingAttendance = records.filter((r) => r.status === 'en_attente');
  const suspectAttendance = records.filter((r) => r.status === 'suspect');
  const toReassign = events.filter((e) => e.status === 'a_reattribuer');

  // Taux de validation
  const validatedRecords = records.filter((r) => r.status === 'valide').length;
  const validationRate = records.length > 0 ? Math.round((validatedRecords / records.length) * 100) : 0;

  // Événements ce mois
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const eventsThisMonth = events.filter((e) => {
    const d = new Date(e.startDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // Alertes actives (from notification system)
  const activeAlerts = notifications.filter((n) => !n.isRead).length;

  // Heures totales pointées ce mois
  const totalHoursThisMonth = records
    .filter((r) => {
      if (!r.checkInTime) return false;
      const d = new Date(r.checkInTime);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const totalHoursFormatted = totalHoursThisMonth < 1
    ? `${Math.round(totalHoursThisMonth * 60)}min`
    : `${Math.floor(totalHoursThisMonth)}h${String(Math.round((totalHoursThisMonth % 1) * 60)).padStart(2, '0')}`;

  // Créneaux non affectés (shifts sans agentId)
  const unassignedShifts = events.reduce((sum, e) =>
    sum + (e.shifts || []).filter((s) => !s.agentId).length, 0
  );

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const recentAttendance = [...records]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const getAgentName = (agentId: string) => {
    const agent = users.find((u) => u.id === agentId);
    return agent ? `${agent.firstName} ${agent.lastName}` : 'Non assigné';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de vos activités" />

      {/* Alerts */}
      {(suspectAttendance.length > 0 || toReassign.length > 0) && (
        <div className="space-y-3">
          {suspectAttendance.length > 0 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <AlertTriangle className="text-orange-500 flex-shrink-0" size={20} />
              <p className="text-sm text-orange-700 font-medium">
                {suspectAttendance.length} pointage(s) suspect(s) nécessitent votre attention
              </p>
              <Link
                to="/admin/pointage"
                className="ml-auto text-sm text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
              >
                Voir <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {toReassign.length > 0 && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <AlertTriangle className="text-rose-500 flex-shrink-0" size={20} />
              <p className="text-sm text-rose-700 font-medium">
                {toReassign.length} événement(s) à réattribuer
              </p>
              <Link
                to="/admin/planning"
                className="ml-auto text-sm text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
              >
                Voir <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          label="Agents"
          value={agents.length}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Événements en cours"
          value={eventsEnCours.length}
          subtitle={`/ ${events.length} total`}
          icon={CalendarDays}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Pointages en attente"
          value={pendingAttendance.length}
          icon={Clock}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          alert={pendingAttendance.length > 0}
        />
        <StatCard
          label="Taux de validation"
          value={`${validationRate}%`}
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Événements ce mois"
          value={eventsThisMonth}
          icon={TrendingUp}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <StatCard
          label="Alertes actives"
          value={activeAlerts}
          icon={ShieldAlert}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          alert={activeAlerts > 0}
        />
        <StatCard
          label="Heures ce mois"
          value={totalHoursFormatted}
          icon={Hourglass}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <StatCard
          label="Créneaux non affectés"
          value={unassignedShifts}
          icon={CalendarX2}
          iconBg="bg-pink-50"
          iconColor="text-pink-600"
          alert={unassignedShifts > 0}
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent events */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-extrabold text-slate-900">Événements récents</h2>
            <Link
              to="/admin/planning"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentEvents.map((event) => (
              <div key={event.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-normal text-slate-900 truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">
                        {event.assignedAgentIds.map((id) => getAgentName(id)).join(', ')}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin size={10} />
                        {event.address.split(',')[0]}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={event.status} />
                </div>
              </div>
            ))}
            {recentEvents.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Aucun événement
              </div>
            )}
          </div>
        </div>

        {/* Recent attendance */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-extrabold text-slate-900">Pointages récents</h2>
            <Link
              to="/admin/pointage"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAttendance.map((record) => {
              const event = events.find((e) => e.id === record.eventId);
              return (
                <div key={record.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-normal text-slate-900 truncate">
                        {getAgentName(record.agentId)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {event?.title || 'Événement inconnu'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-400">
                          {record.checkInTime && formatTime(record.checkInTime)}
                          {record.checkOutTime && ` → ${formatTime(record.checkOutTime)}`}
                        </span>
                      </div>
                      {record.hoursWorked && (
                        <p className="text-xs font-medium text-primary-600 mt-1">
                          {formatDuration(record.hoursWorked)} travaillées
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={record.status} />
                      {record.isSuspect && (
                        <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={10} /> Suspect
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {recentAttendance.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Aucun pointage
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
