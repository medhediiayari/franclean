import { useEffect, useState, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import { useClientPortalStore } from '../../store/clientPortalStore';
import {
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  PlayCircle,
  CalendarClock,
  XCircle,
  X,
  Image,
  ClipboardList,
} from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  termine: { label: 'Terminé', color: '#10B981', bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
  en_cours: { label: 'En cours', color: '#F59E0B', bgColor: 'bg-amber-50 border-amber-200 text-amber-700', icon: PlayCircle },
  planifie: { label: 'Planifié', color: '#6366F1', bgColor: 'bg-blue-50 border-blue-200 text-blue-700', icon: CalendarClock },
  a_reattribuer: { label: 'À réattribuer', color: '#EF4444', bgColor: 'bg-red-50 border-red-200 text-red-700', icon: XCircle },
  annule: { label: 'Annulé', color: '#94A3B8', bgColor: 'bg-slate-50 border-slate-200 text-slate-500', icon: XCircle },
};

export default function ClientCalendar() {
  const { missions, fetchMissions, clientInfo, fetchClientInfo, loading } = useClientPortalStore();
  const [visible, setVisible] = useState(false);
  const [selectedMission, setSelectedMission] = useState<typeof missions[0] | null>(null);
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    fetchMissions();
    fetchClientInfo();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [fetchMissions, fetchClientInfo]);

  // Filter missions
  const filteredMissions = useMemo(() => {
    let result = missions;
    if (siteFilter !== 'all') result = result.filter((m) => m.site === siteFilter);
    if (statusFilter !== 'all') result = result.filter((m) => m.status === statusFilter);
    return result;
  }, [missions, siteFilter, statusFilter]);

  // Build FullCalendar events from missions (same logic as admin)
  const calendarEvents = useMemo(() => {
    const result: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      allDay?: boolean;
      backgroundColor: string;
      borderColor: string;
      extendedProps?: { shiftsInfo: string; missionId: string };
    }> = [];

    for (const m of filteredMissions) {
      if (m.shifts && m.shifts.length > 0) {
        const shiftsByDate: Record<string, typeof m.shifts> = {};
        for (const shift of m.shifts) {
          const d = shift.date;
          if (!shiftsByDate[d]) shiftsByDate[d] = [];
          shiftsByDate[d].push(shift);
        }
        for (const [date, dayShifts] of Object.entries(shiftsByDate)) {
          const earliest = dayShifts.reduce((a, b) => (a.startTime < b.startTime ? a : b));
          const latest = dayShifts.reduce((a, b) => (a.endTime > b.endTime ? a : b));
          const shiftsInfo = dayShifts.map((s) => `${s.startTime}-${s.endTime}`).join(' / ');
          const color = statusConfig[m.status]?.color || '#6366F1';
          result.push({
            id: `${m.id}__${date}`,
            title: m.title,
            start: `${date}T${earliest.startTime}:00`,
            end: `${date}T${latest.endTime}:00`,
            backgroundColor: color,
            borderColor: color,
            extendedProps: { shiftsInfo, missionId: m.id },
          });
        }
      } else {
        const color = statusConfig[m.status]?.color || '#6366F1';
        result.push({
          id: m.id,
          title: m.title,
          start: m.startDate,
          end: m.endDate,
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          extendedProps: { shiftsInfo: '', missionId: m.id },
        });
      }
    }
    return result;
  }, [filteredMissions]);

  // Handle event click
  const handleEventClick = (info: any) => {
    const missionId = info.event.extendedProps?.missionId || info.event.id.split('__')[0];
    const mission = missions.find((m) => m.id === missionId);
    if (mission) setSelectedMission(mission);
  };

  // Navigation helpers
  const goToday = () => calendarRef.current?.getApi().today();
  const goPrev = () => calendarRef.current?.getApi().prev();
  const goNext = () => calendarRef.current?.getApi().next();

  // Get unique sites for filter
  const sites = useMemo(() => {
    const s = new Set(missions.map((m) => m.site).filter(Boolean));
    return Array.from(s) as string[];
  }, [missions]);

  // Stat counts for header
  const stats = useMemo(() => {
    const enCours = filteredMissions.filter((m) => m.status === 'en_cours').length;
    const terminees = filteredMissions.filter((m) => m.status === 'termine').length;
    const planifiees = filteredMissions.filter((m) => m.status === 'planifie').length;
    return { total: filteredMissions.length, enCours, terminees, planifiees };
  }, [filteredMissions]);

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

  return (
    <div className={`space-y-6 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl mesh-gradient px-7 py-8 md:px-10 md:py-10 shadow-2xl">
        <div className="orb w-32 h-32 bg-violet-400/15 top-0 right-10" />
        <div className="orb orb-alt w-24 h-24 bg-blue-400/10 bottom-0 left-20" />
        <div className="dot-pattern absolute inset-0" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full mb-4 border border-white/10">
              <Calendar size={13} className="text-violet-300" />
              <span className="text-violet-200 text-[11px] font-bold tracking-widest uppercase">Calendrier</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Planning missions</span>
            </h1>
            <p className="text-white/40 mt-2 text-sm max-w-lg">Visualisez vos missions sur un calendrier interactif.</p>
          </div>
          {/* Mini stats */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{stats.total}</p>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Total</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-black text-amber-400">{stats.enCours}</p>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider">En cours</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">{stats.terminees}</p>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Terminées</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-black text-blue-400">{stats.planifiees}</p>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Planifiées</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white shadow-sm hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
        >
          <option value="all">Tous les sites</option>
          {sites.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white shadow-sm hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
        >
          <option value="all">Tous les statuts</option>
          <option value="planifie">Planifié</option>
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé</option>
        </select>

        {/* Custom nav buttons */}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={goPrev} className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-all">
            <ChevronLeft size={16} className="text-slate-600" />
          </button>
          <button onClick={goToday} className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-sm hover:bg-emerald-600 transition-all">
            Aujourd'hui
          </button>
          <button onClick={goNext} className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-all">
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        {Object.entries(statusConfig).filter(([k]) => k !== 'annule').map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
            <span className="text-xs text-slate-500 font-medium">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 client-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView="dayGridMonth"
            locale="fr"
            headerToolbar={{
              left: '',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,listWeek',
            }}
            buttonText={{
              month: 'Mois',
              week: 'Semaine',
              list: 'Liste',
            }}
            events={calendarEvents}
            eventClick={handleEventClick}
            eventContent={(arg) => {
              const shiftsInfo = arg.event.extendedProps?.shiftsInfo;
              const color = arg.event.backgroundColor || '#6366F1';
              return (
                <div className="fc-event-inner" style={{ backgroundColor: color }}>
                  <span className="fc-event-dot" style={{ background: 'rgba(255,255,255,0.8)' }} />
                  <span className="fc-event-label">{arg.event.title}</span>
                  {shiftsInfo && <span className="fc-event-time-label">{shiftsInfo}</span>}
                </div>
              );
            }}
            height="auto"
            dayMaxEvents={3}
            firstDay={1}
            moreLinkContent={(arg) => `+${arg.num} de plus`}
            selectable={false}
            editable={false}
          />
        </div>
      </div>

      {/* Mission detail modal */}
      {selectedMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedMission(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${statusConfig[selectedMission.status]?.bgColor?.includes('emerald') ? 'from-emerald-500 to-emerald-600' : statusConfig[selectedMission.status]?.bgColor?.includes('amber') ? 'from-amber-500 to-orange-500' : statusConfig[selectedMission.status]?.bgColor?.includes('blue') ? 'from-blue-500 to-blue-600' : 'from-slate-400 to-slate-500'} flex items-center justify-center shadow-lg`}>
                  <ClipboardList size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedMission.title}</h2>
                  <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig[selectedMission.status]?.bgColor || 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    {(() => { const Icon = statusConfig[selectedMission.status]?.icon || XCircle; return <Icon size={10} />; })()}
                    {statusConfig[selectedMission.status]?.label || selectedMission.status}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedMission(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Description */}
              {selectedMission.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{selectedMission.description}</p>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {selectedMission.site && (
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                    <MapPin size={15} className="text-rose-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Site</p>
                      <p className="text-xs font-semibold text-slate-700">{selectedMission.site}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                  <Calendar size={15} className="text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Dates</p>
                    <p className="text-xs font-semibold text-slate-700">
                      {new Date(selectedMission.startDate).toLocaleDateString('fr-FR')}
                      {selectedMission.startDate !== selectedMission.endDate && ` → ${new Date(selectedMission.endDate).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                </div>
                {selectedMission.address && (
                  <div className="col-span-2 flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                    <MapPin size={15} className="text-violet-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Adresse</p>
                      <p className="text-xs font-semibold text-slate-700">{selectedMission.address}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Shifts / Créneaux */}
              {selectedMission.shifts.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Créneaux</h3>
                  <div className="space-y-1.5">
                    {selectedMission.shifts.map((shift) => (
                      <div key={shift.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl">
                        <Clock size={13} className="text-cyan-500 flex-shrink-0" />
                        <span className="text-xs font-semibold text-slate-700">
                          {new Date(shift.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{shift.startTime} - {shift.endTime}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agents */}
              {selectedMission.agents.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Intervenants</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedMission.agents.map((agent) => {
                      const hasCheckedIn = selectedMission.attendances.some((att) => att.agentMatricule === agent.matricule && att.checkInTime);
                      return (
                        <div key={agent.id} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${
                          hasCheckedIn
                            ? 'bg-emerald-50 border border-emerald-200/50'
                            : 'bg-slate-50 border border-slate-200/50'
                        }`}>
                          <User size={13} className={hasCheckedIn ? 'text-emerald-600' : 'text-slate-400'} />
                          <span className={`text-xs font-semibold ${hasCheckedIn ? 'text-emerald-700' : 'text-slate-600'}`}>{agent.matricule}</span>
                          {hasCheckedIn
                            ? <CheckCircle2 size={14} className="text-emerald-600" />
                            : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60"><Clock size={10} />Pas encore</span>
                          }
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Attendances / Pointages */}
              {selectedMission.attendances.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Pointages</h3>
                  <div className="space-y-2">
                    {selectedMission.attendances.map((att) => (
                      <div key={att.id} className="p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-700">{att.agentMatricule}</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(att.date).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                          {att.checkInTime && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Entrée: {new Date(att.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {att.checkOutTime && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Sortie: {new Date(att.checkOutTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {att.hoursWorked != null && (
                            <span className="font-bold text-slate-700">{att.hoursWorked.toFixed(1)}h</span>
                          )}
                        </div>
                        {/* Photos */}
                        {(att.checkInPhotoUrl || att.checkOutPhotoUrl || att.photos.length > 0) && (
                          <div className="flex items-center gap-2 mt-2">
                            {att.checkInPhotoUrl && (
                              <img src={att.checkInPhotoUrl} alt="Entrée" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                            )}
                            {att.checkOutPhotoUrl && (
                              <img src={att.checkOutPhotoUrl} alt="Sortie" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                            )}
                            {att.photos.map((p) => (
                              <img key={p.id} src={p.photoUrl} alt={p.caption || ''} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                            ))}
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Image size={10} /> {(att.checkInPhotoUrl ? 1 : 0) + (att.checkOutPhotoUrl ? 1 : 0) + att.photos.length} photos
                            </span>
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
      )}
    </div>
  );
}
