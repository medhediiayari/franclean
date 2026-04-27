import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useEventStore } from '../../store/eventStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatTime, formatDuration } from '../../utils/helpers';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Filter,
  TrendingUp,
  Zap,
} from 'lucide-react';

export default function MyHours() {
  const { user } = useAuthStore();
  const { records, fetchRecords } = useAttendanceStore();
  const { events, fetchEvents } = useEventStore();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  if (!user) return null;

  const myRecords = records
    .filter((r) => r.agentId === user.id)
    .filter((r) => filterStatus === 'all' || r.status === filterStatus)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalHoursValidated = records
    .filter((r) => r.agentId === user.id && r.status === 'valide')
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const totalHoursPending = records
    .filter((r) => r.agentId === user.id && r.status === 'en_attente')
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const totalHoursRefused = records
    .filter((r) => r.agentId === user.id && r.status === 'refuse')
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

  const totalAll = totalHoursValidated + totalHoursPending + totalHoursRefused;
  const validationRate = totalAll > 0
    ? Math.round((totalHoursValidated / totalAll) * 100)
    : 0;

  return (
    <div className="p-4 space-y-5 animate-fadeIn">
      <div className="bg-slate-800 rounded-xl px-5 py-3.5 shadow-lg">
        <h1 className="text-lg font-bold text-white tracking-tight">Mes Heures</h1>
        <p className="text-sm text-slate-300 mt-0.5">Historique de vos pointages</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
            <div className="group bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-3.5 text-center hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="inline-flex p-2 rounded-xl bg-emerald-100/80 mb-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <p className="text-xl font-extrabold text-emerald-700 tracking-tight">{formatDuration(totalHoursValidated)}</p>
              <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider mt-0.5">Validées</p>
            </div>
            <div className="group bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-100 p-3.5 text-center hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="inline-flex p-2 rounded-xl bg-amber-100/80 mb-2">
                <Clock size={16} className="text-amber-600" />
              </div>
              <p className="text-xl font-extrabold text-amber-700 tracking-tight">{formatDuration(totalHoursPending)}</p>
              <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider mt-0.5">En attente</p>
            </div>
            <div className="group bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-100 p-3.5 text-center hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="inline-flex p-2 rounded-xl bg-rose-100/80 mb-2">
                <XCircle size={16} className="text-rose-600" />
              </div>
              <p className="text-xl font-extrabold text-rose-700 tracking-tight">{formatDuration(totalHoursRefused)}</p>
              <p className="text-[10px] font-bold text-rose-600/70 uppercase tracking-wider mt-0.5">Refusées</p>
            </div>
          </div>

          {/* Big total with progress bar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary-50">
                  <TrendingUp size={16} className="text-primary-500" />
                </div>
                <span className="text-sm font-bold text-slate-900">Total ce mois</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatDuration(totalHoursValidated + totalHoursPending)}
              </p>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full flex rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500" style={{ width: `${totalAll > 0 ? (totalHoursValidated / totalAll) * 100 : 0}%` }} />
                <div className="bg-gradient-to-r from-amber-300 to-amber-400 transition-all duration-500" style={{ width: `${totalAll > 0 ? (totalHoursPending / totalAll) * 100 : 0}%` }} />
                <div className="bg-gradient-to-r from-rose-300 to-rose-400 transition-all duration-500" style={{ width: `${totalAll > 0 ? (totalHoursRefused / totalAll) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-3 text-[10px] font-semibold">
                <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Validées</span>
                <span className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-400" /> En attente</span>
                <span className="flex items-center gap-1 text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-400" /> Refusées</span>
              </div>
              <span className="text-[11px] font-bold text-primary-600">{validationRate}% validé</span>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2.5">
            <Filter size={13} className="text-slate-400 flex-shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: 'all', label: 'Tous' },
                { key: 'valide', label: 'Validé' },
                { key: 'en_attente', label: 'En attente' },
                { key: 'refuse', label: 'Refusé' },
                { key: 'suspect', label: 'Suspect' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 ${
                    filterStatus === f.key
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Records list */}
          {myRecords.length > 0 ? (
            <div className="space-y-2.5">
              {myRecords.map((rec, idx) => {
                const event = events.find((e) => e.id === rec.eventId);
                return (
                  <div
                    key={rec.id}
                    className="bg-white rounded-2xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-all duration-200"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{event?.title || 'Mission'}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <Calendar size={11} className="text-slate-400" />
                          {formatDate(rec.date)}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          {rec.checkInTime && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <div className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-100" />
                              <span className="font-semibold text-slate-700">{formatTime(rec.checkInTime)}</span>
                            </div>
                          )}
                          {rec.checkOutTime && (
                            <>
                              <div className="w-6 h-px bg-slate-200" />
                              <div className="flex items-center gap-1.5 text-xs">
                                <div className="w-2 h-2 rounded-full bg-rose-400 ring-2 ring-rose-100" />
                                <span className="font-semibold text-slate-700">{formatTime(rec.checkOutTime)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <StatusBadge status={rec.status} />
                        {rec.hoursWorked && (
                          <span className="flex items-center gap-1 text-sm font-extrabold text-primary-600">
                            <Zap size={13} className="text-primary-400" />
                            {formatDuration(rec.hoursWorked)}
                          </span>
                        )}
                      </div>
                    </div>
                    {rec.isSuspect && rec.suspectReasons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {rec.suspectReasons.map((reason, i) => (
                          <p key={i} className="text-[11px] text-orange-500 flex items-center gap-1.5 font-semibold">
                            <AlertTriangle size={11} /> {reason}
                          </p>
                        ))}
                      </div>
                    )}
                    {rec.status === 'refuse' && rec.refusalReason && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[11px] text-rose-500 font-semibold">Motif : {rec.refusalReason}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-slate-50 mb-3">
                <Clock size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-400">Aucun pointage enregistré</p>
              <p className="text-xs text-slate-300 mt-1">Vos pointages apparaîtront ici</p>
            </div>
          )}
    </div>
  );
}
