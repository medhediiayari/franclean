import { useEffect, useState } from 'react';
import { useClientPortalStore } from '../../store/clientPortalStore';
import { formatDate } from '../../utils/helpers';
import {
  ClipboardList,
  Clock,
  MapPin,
  User,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  PlayCircle,
  CalendarClock,
  Image,
  XCircle,
  Calendar,
  FileText,
  Sparkles,
  ArrowRight,
  Activity,
} from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; bg: string; gradient: string; icon: typeof CheckCircle2 }> = {
  termine: { label: 'Terminé', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', gradient: 'from-emerald-500 to-emerald-600', icon: CheckCircle2 },
  en_cours: { label: 'En cours', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', gradient: 'from-amber-500 to-orange-500', icon: PlayCircle },
  planifie: { label: 'Planifié', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', gradient: 'from-blue-500 to-blue-600', icon: CalendarClock },
  a_reattribuer: { label: 'À réattribuer', color: 'text-red-700', bg: 'bg-red-50 border-red-200', gradient: 'from-red-500 to-rose-600', icon: XCircle },
  annule: { label: 'Annulé', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', gradient: 'from-slate-400 to-slate-500', icon: XCircle },
};

export default function ClientMissions() {
  const { missions, fetchMissions, loading } = useClientPortalStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchMissions();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [fetchMissions]);

  const filtered = statusFilter === 'all' ? missions : missions.filter((m) => m.status === statusFilter);

  if (loading && missions.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-[3px] border-emerald-100 border-t-emerald-500 animate-spin" />
          <Sparkles size={18} className="absolute inset-0 m-auto text-emerald-500 animate-pulse" />
        </div>
      </div>
    );
  }

  const filters = [
    { key: 'all', label: 'Toutes', count: missions.length, gradient: 'from-slate-500 to-slate-600' },
    { key: 'en_cours', label: 'En cours', count: missions.filter(m => m.status === 'en_cours').length, gradient: 'from-amber-500 to-orange-500' },
    { key: 'planifie', label: 'Planifiées', count: missions.filter(m => m.status === 'planifie').length, gradient: 'from-blue-500 to-blue-600' },
    { key: 'termine', label: 'Terminées', count: missions.filter(m => m.status === 'termine').length, gradient: 'from-emerald-500 to-emerald-600' },
  ];

  return (
    <div className={`space-y-6 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl mesh-gradient px-7 py-8 md:px-10 md:py-10 shadow-2xl">
        <div className="orb w-32 h-32 bg-blue-400/15 top-0 right-10" />
        <div className="orb orb-alt w-24 h-24 bg-emerald-400/10 bottom-0 left-20" />
        <div className="dot-pattern absolute inset-0" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full mb-4 border border-white/10">
              <Activity size={13} className="text-blue-300" />
              <span className="text-blue-200 text-[11px] font-bold tracking-widest uppercase">Missions</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">{missions.length} mission{missions.length > 1 ? 's' : ''}</span>
            </h1>
            <p className="text-white/40 mt-2 text-sm max-w-lg">Suivez l'avancement de chaque intervention en temps réel.</p>
          </div>
          <div className="hidden sm:flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.08] backdrop-blur-sm flex items-center justify-center border border-white/10">
              <FileText size={36} className="text-white/40" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 stagger-children">
        {filters.map(({ key, label, count, gradient }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`group relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 overflow-hidden ${
              statusFilter === key
                ? 'text-white shadow-lg scale-[1.02]'
                : 'bg-white text-slate-600 border border-slate-200/60 hover:border-slate-300 hover:shadow-md hover-lift'
            }`}
          >
            {statusFilter === key && (
              <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />
            )}
            <span className="relative flex items-center gap-2">
              {label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                statusFilter === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {count}
              </span>
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl border border-dashed border-slate-200 p-14 text-center hover-lift">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <ClipboardList size={32} className="text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-400">Aucune mission trouvée</p>
          <p className="text-sm text-slate-400/70 mt-2">Essayez de changer le filtre.</p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {filtered.map((mission) => {
            const isExpanded = expandedId === mission.id;
            const status = statusConfig[mission.status] || statusConfig.planifie;
            const StatusIcon = status.icon;
            const totalHours = mission.attendances.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
            const totalPhotos = mission.attendances.reduce(
              (sum, a) => sum + a.photos.length + (a.checkInPhotoUrl ? 1 : 0) + (a.checkOutPhotoUrl ? 1 : 0),
              0
            );

            return (
              <div
                key={mission.id}
                className={`group bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-500 card-shine ${
                  isExpanded ? 'border-emerald-200/80 shadow-xl shadow-emerald-500/5' : 'border-slate-200/60 hover:shadow-lg hover:border-slate-200 hover-lift'
                }`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : mission.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${status.gradient} shadow-lg`}>
                    <StatusIcon size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">{mission.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" />
                        {formatDate(mission.startDate)}{mission.startDate !== mission.endDate ? ` → ${formatDate(mission.endDate)}` : ''}
                      </span>
                      {mission.site && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-slate-400" />
                          {mission.site}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {totalHours > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl text-xs font-bold text-emerald-600 border border-emerald-100">
                        <Clock size={12} /> {totalHours.toFixed(1)}h
                      </span>
                    )}
                    {totalPhotos > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl text-xs font-bold text-blue-600 border border-blue-100">
                        <Image size={12} /> {totalPhotos}
                      </span>
                    )}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isExpanded ? 'bg-emerald-100 rotate-0' : 'bg-slate-100 group-hover:bg-slate-200'
                    }`}>
                      {isExpanded ? <ChevronUp size={16} className="text-emerald-600" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                <div className={`transition-all duration-500 ease-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-5 pb-5 pt-1 border-t border-slate-100/80">
                    {mission.description && (
                      <div className="glass-card rounded-xl p-4 mt-3 mb-4 border border-slate-100">
                        <p className="text-sm text-slate-600 leading-relaxed">{mission.description}</p>
                      </div>
                    )}

                    {mission.address && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 px-1">
                        <MapPin size={13} className="text-slate-400" />
                        <span>{mission.address}</span>
                      </div>
                    )}

                    {mission.agents.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] font-bold text-slate-400 mb-2.5 uppercase tracking-widest px-1">Agents intervenants</p>
                        <div className="flex flex-wrap gap-2">
                          {mission.agents.map((a) => (
                            <span key={a.id} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 hover-lift shadow-sm">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-sm">
                                <User size={11} className="text-white" />
                              </div>
                              {a.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {mission.attendances.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 mb-2.5 uppercase tracking-widest px-1">Relevés de présence</p>
                        <div className="space-y-2.5">
                          {mission.attendances.map((att) => (
                            <div key={att.id} className="glass-card rounded-xl p-4 border border-slate-100 hover-lift">
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                                    <User size={13} className="text-white" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-slate-800">{att.agentName}</span>
                                    <span className="text-[10px] text-slate-400 ml-2">{formatDate(att.date)}</span>
                                  </div>
                                </div>
                                {att.hoursWorked != null && (
                                  <span className="text-xs font-extrabold text-emerald-600 bg-gradient-to-r from-emerald-50 to-emerald-100/50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                    {att.hoursWorked.toFixed(1)}h
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-6 text-xs text-slate-500 ml-10">
                                {att.checkInTime && (
                                  <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 shadow-sm shadow-blue-400/40" />
                                    Arrivée : {new Date(att.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {att.checkOutTime && (
                                  <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 shadow-sm shadow-orange-400/40" />
                                    Départ : {new Date(att.checkOutTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              {(att.photos.length > 0 || att.checkInPhotoUrl || att.checkOutPhotoUrl) && (
                                <div className="mt-3.5 ml-10 flex flex-wrap gap-2.5">
                                  {att.checkInPhotoUrl && (
                                    <div className="relative group/photo">
                                      <img src={att.checkInPhotoUrl} alt="Arrivée" className="w-20 h-20 object-cover rounded-xl border-2 border-blue-200 shadow-md group-hover/photo:scale-110 group-hover/photo:shadow-xl transition-all duration-300" />
                                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[8px] font-bold rounded-lg shadow-sm">Arrivée</span>
                                    </div>
                                  )}
                                  {att.photos.map((p) => (
                                    <div key={p.id} className="relative group/photo">
                                      <img src={p.photoUrl} alt={p.caption || 'Photo'} className="w-20 h-20 object-cover rounded-xl border-2 border-emerald-200 shadow-md group-hover/photo:scale-110 group-hover/photo:shadow-xl transition-all duration-300" />
                                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[8px] font-bold rounded-lg shadow-sm">Travail</span>
                                    </div>
                                  ))}
                                  {att.checkOutPhotoUrl && (
                                    <div className="relative group/photo">
                                      <img src={att.checkOutPhotoUrl} alt="Départ" className="w-20 h-20 object-cover rounded-xl border-2 border-orange-200 shadow-md group-hover/photo:scale-110 group-hover/photo:shadow-xl transition-all duration-300" />
                                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[8px] font-bold rounded-lg shadow-sm">Départ</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
