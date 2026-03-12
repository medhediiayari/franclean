import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatTime } from '../../utils/helpers';
import {
  Users,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const { users, fetchUsers } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const { records, fetchRecords } = useAttendanceStore();

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const agents = users.filter((u) => u.role === 'agent');
  const activeAgents = agents.filter((u) => u.isActive);
  const eventsEnCours = events.filter((e) => e.status === 'en_cours');
  const pendingAttendance = records.filter((r) => r.status === 'en_attente');
  const suspectAttendance = records.filter((r) => r.status === 'suspect');
  const validatedHours = records
    .filter((r) => r.status === 'valide' && r.hoursWorked)
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const toReassign = events.filter((e) => e.status === 'a_reattribuer');

  const stats = [
    {
      label: 'Agents actifs',
      value: activeAgents.length,
      total: agents.length,
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: 'Événements en cours',
      value: eventsEnCours.length,
      total: events.length,
      icon: CalendarDays,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
    {
      label: 'Pointages en attente',
      value: pendingAttendance.length,
      icon: Clock,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      alert: pendingAttendance.length > 0,
    },
    {
      label: 'Heures validées',
      value: `${validatedHours.toFixed(1)}h`,
      icon: CheckCircle2,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
  ];

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
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Vue d'ensemble de vos activités</p>
      </div>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl ${stat.bgColor}`}>
                <stat.icon size={20} className={stat.textColor} />
              </div>
              {stat.alert && (
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-sm text-slate-500 mt-1">
              {stat.label}
              {stat.total !== undefined && (
                <span className="text-slate-400"> / {stat.total} total</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent events */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Événements récents</h2>
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
                    <p className="text-sm font-medium text-slate-900 truncate">{event.title}</p>
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
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Pointages récents</h2>
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
                      <p className="text-sm font-medium text-slate-900 truncate">
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
                          {record.hoursWorked.toFixed(1)}h travaillées
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

      {/* Quick stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Taux de validation</p>
              <p className="text-xl font-bold text-slate-900">
                {records.length
                  ? `${Math.round((records.filter((r) => r.status === 'valide').length / records.length) * 100)}%`
                  : '0%'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <CalendarDays size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Événements ce mois</p>
              <p className="text-xl font-bold text-slate-900">{events.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50">
              <AlertTriangle size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Alertes actives</p>
              <p className="text-xl font-bold text-slate-900">
                {suspectAttendance.length + toReassign.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
