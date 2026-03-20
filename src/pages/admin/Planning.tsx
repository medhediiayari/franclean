import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime, formatDate } from '../../utils/helpers';
import type { PlanningEvent, EventStatus, EventShift } from '../../types';
import LocationPicker from '../../components/common/LocationPicker';
import {
  Plus,
  MapPin,
  User,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  Calendar,
  Clock,
  Trash2,
  Edit3,
  AlertTriangle,
  History,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Briefcase,
  Flame,
  Copy,
  Check,
  X,
} from 'lucide-react';

const EVENT_PALETTE = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#84CC16',
  '#0EA5E9', '#D946EF', '#F43F5E', '#A855F7', '#EA580C',
  '#64748B', '#059669', '#DC2626', '#7C3AED', '#DB2777',
];

const statusColors: Record<EventStatus, string> = {
  planifie: '#6366F1',
  en_cours: '#F59E0B',
  termine: '#10B981',
  a_reattribuer: '#EF4444',
  annule: '#94A3B8',
};

export default function Planning() {
  const { events, addEvent, updateEvent, deleteEvent, fetchEvents } = useEventStore();
  const { users, fetchUsers } = useAuthStore();

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PlanningEvent | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [calendarView, setCalendarView] = useState<'calendar' | 'year' | 'heatmap'>('calendar');
  const [yearViewYear, setYearViewYear] = useState(new Date().getFullYear());
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const calendarRef = useRef<FullCalendar>(null);

  const agents = users.filter((u) => u.role === 'agent' && u.isActive);

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    client: '',
    color: EVENT_PALETTE[0],
    startDate: '',
    endDate: '',
    address: '',
    latitude: '',
    longitude: '',
    geoRadius: '200',
    assignedAgentIds: [] as string[],
    status: 'planifie' as EventStatus,
  });

  const [formTab, setFormTab] = useState<'event' | 'agents'>('event');

  // Per-agent shift assignments: agentId -> array of shifts
  const [agentShiftAssignments, setAgentShiftAssignments] = useState<
    Record<string, { date: string; startTime: string; endTime: string }[]>
  >({});

  // Editing agent shifts
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentShiftDates, setAgentShiftDates] = useState<Set<string>>(new Set());
  const [agentTemplateSlots, setAgentTemplateSlots] = useState<{ startTime: string; endTime: string }[]>([
    { startTime: '08:00', endTime: '17:00' },
  ]);
  const [agentSkipDays, setAgentSkipDays] = useState<number[]>([0, 6]);
  const [showResponsesWidget, setShowResponsesWidget] = useState(true);
  const [expandedResponseEventId, setExpandedResponseEventId] = useState<string | null>(null);

  // Compute agent responses grouped by event
  const eventResponsesGrouped = useMemo(() => {
    const nameOf = (id: string) => {
      const u = users.find((u) => u.id === id);
      return u ? `${u.firstName} ${u.lastName}` : 'Non assignÃ©';
    };

    const result: Array<{
      eventId: string;
      eventTitle: string;
      eventColor: string;
      status: EventStatus;
      agents: Array<{ agentId: string; name: string; response: 'accepted' | 'refused' | 'pending' }>;
      counts: { accepted: number; pending: number; refused: number };
    }> = [];

    for (const evt of events) {
      if (evt.status === 'annule' || evt.status === 'termine') continue;
      if (evt.assignedAgentIds.length === 0) continue;
      const responses = evt.agentResponses || {};
      const agentsList = evt.assignedAgentIds.map((agentId) => ({
        agentId,
        name: nameOf(agentId),
        response: (responses[agentId] || 'pending') as 'accepted' | 'refused' | 'pending',
      }));
      const counts = {
        accepted: agentsList.filter(a => a.response === 'accepted').length,
        pending: agentsList.filter(a => a.response === 'pending').length,
        refused: agentsList.filter(a => a.response === 'refused').length,
      };
      result.push({
        eventId: evt.id,
        eventTitle: evt.title,
        eventColor: evt.color,
        status: evt.status,
        agents: agentsList,
        counts,
      });
    }

    // Sort: events with pending first, then by title
    result.sort((a, b) => {
      if (a.counts.pending > 0 && b.counts.pending === 0) return -1;
      if (a.counts.pending === 0 && b.counts.pending > 0) return 1;
      if (a.counts.refused > 0 && b.counts.refused === 0) return -1;
      if (a.counts.refused === 0 && b.counts.refused > 0) return 1;
      return a.eventTitle.localeCompare(b.eventTitle);
    });

    return result;
  }, [events, users]);

  const totalResponseCounts = useMemo(() => {
    return eventResponsesGrouped.reduce(
      (acc, g) => ({
        accepted: acc.accepted + g.counts.accepted,
        pending: acc.pending + g.counts.pending,
        refused: acc.refused + g.counts.refused,
      }),
      { accepted: 0, pending: 0, refused: 0 },
    );
  }, [eventResponsesGrouped]);

  // Generate calendar events from shifts
  const calendarEvents = useMemo(() => {
    const result: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      allDay?: boolean;
      backgroundColor: string;
      borderColor: string;
    }> = [];
    for (const evt of events) {
      if (evt.shifts && evt.shifts.length > 0) {
        for (const shift of evt.shifts) {
          result.push({
            id: `${evt.id}__${shift.id}`,
            title: evt.title,
            start: `${shift.date}T${shift.startTime}:00`,
            end: `${shift.date}T${shift.endTime}:00`,
            backgroundColor: evt.color || statusColors[evt.status],
            borderColor: evt.color || statusColors[evt.status],
          });
        }
      } else {
        result.push({
          id: evt.id,
          title: evt.title,
          start: evt.startDate,
          end: evt.endDate,
          allDay: true,
          backgroundColor: evt.color || statusColors[evt.status],
          borderColor: evt.color || statusColors[evt.status],
        });
      }
    }
    return result;
  }, [events]);

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      client: '',
      color: EVENT_PALETTE[Math.floor(Math.random() * EVENT_PALETTE.length)],
      startDate: '',
      endDate: '',
      address: '',
      latitude: '',
      longitude: '',
      geoRadius: '200',
      assignedAgentIds: [] as string[],
      status: 'planifie',
    });
    setAgentShiftAssignments({});
    setEditingAgentId(null);
    setFormTab('event');
  };

  const handleDateSelect = (info: { startStr: string; endStr: string }) => {
    resetForm();
    const start = info.startStr.slice(0, 10);
    // FullCalendar endStr for day selection is exclusive, so subtract 1 day
    const endDate = new Date(info.endStr);
    endDate.setDate(endDate.getDate() - 1);
    const end = endDate.toISOString().slice(0, 10);
    setForm((f) => ({
      ...f,
      startDate: start,
      endDate: end < start ? start : end,
    }));
    setFormMode('create');
    setShowForm(true);
  };

  const handleEventClick = (info: { event: { id: string } }) => {
    const evtId = info.event.id.includes('__') ? info.event.id.split('__')[0] : info.event.id;
    const evt = events.find((e) => e.id === evtId);
    if (evt) {
      setSelectedEvent(evt);
      setShowDetail(true);
    }
  };

  const handleEdit = () => {
    if (!selectedEvent) return;
    setForm({
      title: selectedEvent.title,
      description: selectedEvent.description,
      client: selectedEvent.client || '',
      color: selectedEvent.color || EVENT_PALETTE[0],
      startDate: selectedEvent.startDate,
      endDate: selectedEvent.endDate,
      address: selectedEvent.address,
      latitude: selectedEvent.latitude?.toString() || '',
      longitude: selectedEvent.longitude?.toString() || '',
      geoRadius: selectedEvent.geoRadius?.toString() || '200',
      assignedAgentIds: selectedEvent.assignedAgentIds,
      status: selectedEvent.status,
    });
    // Build per-agent shift assignments from existing shifts
    const assignments: Record<string, { date: string; startTime: string; endTime: string }[]> = {};
    for (const shift of (selectedEvent.shifts || [])) {
      const aid = shift.agentId || '__shared__';
      if (!assignments[aid]) assignments[aid] = [];
      assignments[aid].push({ date: shift.date, startTime: shift.startTime, endTime: shift.endTime });
    }
    // If shifts have no agentId, replicate them for each assigned agent (legacy compat)
    if (assignments['__shared__'] && selectedEvent.assignedAgentIds.length > 0) {
      for (const agentId of selectedEvent.assignedAgentIds) {
        if (!assignments[agentId]) {
          assignments[agentId] = [...assignments['__shared__']];
        }
      }
      delete assignments['__shared__'];
    }
    setAgentShiftAssignments(assignments);
    setEditingAgentId(null);
    setFormTab('event');
    setFormMode('edit');
    setShowDetail(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build flat shifts array from per-agent assignments
    const allShifts: { date: string; startTime: string; endTime: string; agentId?: string }[] = [];
    const allAgentIds = Object.keys(agentShiftAssignments);
    for (const agentId of allAgentIds) {
      for (const s of agentShiftAssignments[agentId]) {
        allShifts.push({ ...s, agentId });
      }
    }

    const eventData = {
      title: form.title,
      description: form.description,
      client: form.client || undefined,
      color: form.color,
      startDate: form.startDate,
      endDate: form.endDate,
      shifts: allShifts,
      address: form.address,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      geoRadius: form.geoRadius ? parseInt(form.geoRadius) : 200,
      assignedAgentIds: allAgentIds,
      status: form.status,
    };

    try {
      if (formMode === 'create') {
        await addEvent(eventData);
      } else if (selectedEvent) {
        await updateEvent(selectedEvent.id, eventData);
      }
    } catch (err) {
      console.error('Failed to save event', err);
    }

    setShowForm(false);
    resetForm();
    setSelectedEvent(null);
  };

  const handleDelete = async () => {
    if (selectedEvent && confirm('Supprimer cet Ã©vÃ©nement ?')) {
      try {
        await deleteEvent(selectedEvent.id);
      } catch (err) {
        console.error('Failed to delete event', err);
      }
      setShowDetail(false);
      setSelectedEvent(null);
    }
  };

  const handleEventDrop = async (info: { event: { id: string; startStr: string; endStr: string } }) => {
    const evtId = info.event.id.includes('__') ? info.event.id.split('__')[0] : info.event.id;
    const startDate = info.event.startStr.slice(0, 10);
    const endDate = info.event.endStr ? info.event.endStr.slice(0, 10) : startDate;
    try {
      await updateEvent(evtId, { startDate, endDate });
    } catch (err) {
      console.error('Failed to update event', err);
      info.event.id; // FullCalendar handles revert via info.revert() if needed
    }
  };

  const getAgentName = (id: string) => {
    const agent = users.find((u) => u.id === id);
    return agent ? `${agent.firstName} ${agent.lastName}` : 'Non assignÃ©';
  };

  // Helper: get all dates in event range
  const getEventDatesInRange = (skip: number[] = [0, 6]): string[] => {
    if (!form.startDate || !form.endDate) return [];
    const dates: string[] = [];
    const d = new Date(form.startDate + 'T12:00:00');
    const endDate = new Date(form.endDate + 'T12:00:00');
    while (d <= endDate) {
      const iso = d.toISOString().slice(0, 10);
      if (!skip.includes(d.getDay())) {
        dates.push(iso);
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  // Agent assignment helpers
  const addAgentToEvent = (agentId: string) => {
    if (agentShiftAssignments[agentId]) return;
    setAgentShiftAssignments((prev) => ({ ...prev, [agentId]: [] }));
  };

  const removeAgentFromEvent = (agentId: string) => {
    setAgentShiftAssignments((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
    if (editingAgentId === agentId) setEditingAgentId(null);
  };

  const applyAgentShifts = (agentId: string) => {
    const dates = Array.from(agentShiftDates).sort();
    if (dates.length === 0 || agentTemplateSlots.length === 0) return;
    const shifts: { date: string; startTime: string; endTime: string }[] = [];
    for (const date of dates) {
      for (const tpl of agentTemplateSlots) {
        shifts.push({ date, startTime: tpl.startTime, endTime: tpl.endTime });
      }
    }
    setAgentShiftAssignments((prev) => ({ ...prev, [agentId]: shifts }));
    setEditingAgentId(null);
  };

  const startEditingAgent = (agentId: string) => {
    setEditingAgentId(agentId);
    const existing = agentShiftAssignments[agentId] || [];
    setAgentShiftDates(new Set(existing.map((s) => s.date)));
    // Infer template from first date's shifts
    const firstDate = existing[0]?.date;
    if (firstDate) {
      const firstDaySlots = existing.filter((s) => s.date === firstDate);
      setAgentTemplateSlots(firstDaySlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })));
    } else {
      setAgentTemplateSlots([{ startTime: '08:00', endTime: '17:00' }]);
    }
    setAgentSkipDays([0, 6]);
  };

  const selectAllDatesForAgent = () => {
    const dates = getEventDatesInRange(agentSkipDays);
    setAgentShiftDates(new Set(dates));
  };

  const clearDatesForAgent = () => {
    setAgentShiftDates(new Set());
  };

  // Group shifts by date for display
  const groupShiftsByDate = (shifts: EventShift[]) => {
    const grouped: Record<string, EventShift[]> = {};
    for (const shift of shifts) {
      if (!grouped[shift.date]) grouped[shift.date] = [];
      grouped[shift.date].push(shift);
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
          <p className="text-slate-500 mt-1">Gestion des Ã©vÃ©nements et interventions</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setFormMode('create');
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-primary-600/25 transition-all"
        >
          <Plus size={18} />
          Nouvel Ã©vÃ©nement
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {(Object.entries(statusColors) as [EventStatus, string][]).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 backdrop-blur-sm rounded-lg border border-slate-100 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full ring-2 ring-offset-1" style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}20` }} />
            <StatusBadge status={status} />
          </div>
        ))}
      </div>

      {/* Agent Responses Widget â€” grouped by event */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowResponsesWidget(!showResponsesWidget)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-primary-600" />
            <span className="font-semibold text-slate-800 text-sm">RÃ©ponses des agents</span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <UserCheck size={12} /> {totalResponseCounts.accepted}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <Clock size={12} /> {totalResponseCounts.pending}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">
                <UserX size={12} /> {totalResponseCounts.refused}
              </span>
            </div>
          </div>
          {showResponsesWidget ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>

        {showResponsesWidget && (
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {eventResponsesGrouped.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Users size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">Aucun Ã©vÃ©nement actif avec des agents assignÃ©s</p>
              </div>
            ) : (
              eventResponsesGrouped.map((group) => {
                const isExpanded = expandedResponseEventId === group.eventId;
                const allAccepted = group.counts.pending === 0 && group.counts.refused === 0;
                const hasPending = group.counts.pending > 0;
                const hasRefused = group.counts.refused > 0;

                return (
                  <div key={group.eventId}>
                    {/* Event row header */}
                    <button
                      onClick={() => setExpandedResponseEventId(isExpanded ? null : group.eventId)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50/80 transition-colors text-left"
                    >
                      {/* Color dot */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1"
                        style={{ backgroundColor: group.eventColor, boxShadow: `0 0 0 3px ${group.eventColor}20` }}
                      />

                      {/* Event title + status */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">{group.eventTitle}</span>
                          <StatusBadge status={group.status} />
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {group.agents.length} agent{group.agents.length > 1 ? 's' : ''} assignÃ©{group.agents.length > 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Mini response pills */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {group.counts.accepted > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">
                            <UserCheck size={10} /> {group.counts.accepted}
                          </span>
                        )}
                        {group.counts.pending > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 animate-pulse">
                            <Clock size={10} /> {group.counts.pending}
                          </span>
                        )}
                        {group.counts.refused > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
                            <UserX size={10} /> {group.counts.refused}
                          </span>
                        )}
                        {allAccepted && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">
                            <Check size={10} /> Tous OK
                          </span>
                        )}
                      </div>

                      {/* Chevron */}
                      {isExpanded
                        ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
                        : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                      }
                    </button>

                    {/* Expanded agent list */}
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 animate-fadeIn">
                        <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                          {group.agents.map((agent) => (
                            <div
                              key={agent.agentId}
                              className="flex items-center gap-3 px-4 py-2.5"
                            >
                              {/* Agent avatar placeholder */}
                              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                                {agent.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </div>

                              {/* Name */}
                              <span className="flex-1 text-sm font-medium text-slate-700 truncate">{agent.name}</span>

                              {/* Response status */}
                              {agent.response === 'accepted' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-700">
                                  <UserCheck size={13} /> AcceptÃ©
                                </span>
                              )}
                              {agent.response === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-700">
                                  <Clock size={13} /> En attente
                                </span>
                              )}
                              {agent.response === 'refused' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-red-100 text-red-700">
                                  <UserX size={13} /> RefusÃ©
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Quick action: open event detail */}
                        <button
                          onClick={() => {
                            const evt = events.find(e => e.id === group.eventId);
                            if (evt) { setSelectedEvent(evt); setShowDetail(true); }
                          }}
                          className="mt-2.5 w-full text-center text-xs font-semibold text-primary-600 hover:text-primary-700 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                        >
                          Voir le dÃ©tail de l'Ã©vÃ©nement â†’
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
        {[
          { key: 'calendar' as const, label: 'Calendrier', icon: CalendarDays },
          { key: 'year' as const, label: 'AnnÃ©e', icon: Grid3X3 },
          { key: 'heatmap' as const, label: 'Heatmap', icon: Flame },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setCalendarView(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all ${
              calendarView === key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-primary-700 hover:bg-slate-50'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Views */}
      {calendarView === 'year' && (
        <YearOverview
          year={yearViewYear}
          events={events}
          onSelectMonth={(month) => {
            setCalendarView('calendar');
            setTimeout(() => {
              const api = calendarRef.current?.getApi();
              if (api) {
                api.gotoDate(new Date(yearViewYear, month, 1));
                api.changeView('dayGridMonth');
              }
            }, 0);
          }}
          onYearChange={setYearViewYear}
          onClose={() => setCalendarView('calendar')}
        />
      )}

      {calendarView === 'heatmap' && (
        <HeatmapCalendar
          year={heatmapYear}
          events={events}
          onYearChange={setHeatmapYear}
          onDayClick={(date) => {
            setCalendarView('calendar');
            setTimeout(() => {
              const api = calendarRef.current?.getApi();
              if (api) {
                api.gotoDate(date);
                api.changeView('timeGridDay');
              }
            }, 0);
          }}
        />
      )}

      {calendarView === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays size={16} className="text-primary-500" />
              <span className="font-medium">{events.length} Ã©vÃ©nement{events.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView="dayGridMonth"
              locale="fr"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
              }}
              buttonText={{
                today: "Aujourd'hui",
                month: 'Mois',
                week: 'Semaine',
                day: 'Jour',
                list: 'Liste',
              }}
              events={calendarEvents}
              selectable={true}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventContent={(arg) => {
                const timeText = arg.timeText;
                const color = arg.event.backgroundColor || '#6366F1';
                return (
                  <div className="fc-event-inner" style={{ backgroundColor: color }}>
                    <span className="fc-event-dot" style={{ background: 'rgba(255,255,255,0.8)' }} />
                    <span className="fc-event-label">{arg.event.title}</span>
                    {timeText && <span className="fc-event-time-label">{timeText}</span>}
                  </div>
                );
              }}
              editable={true}
              eventDrop={handleEventDrop}
              height="auto"
              dayMaxEvents={3}
              firstDay={1}
              moreLinkContent={(arg) => `+${arg.num} de plus`}
            />
          </div>
        </div>
      )}

      {/* Event detail modal */}
      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title="DÃ©tail de l'Ã©vÃ©nement"
        size="lg"
      >
        {selectedEvent && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: selectedEvent.color, boxShadow: `0 0 0 3px ${selectedEvent.color}30` }}
                />
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedEvent.title}</h3>
                  <p className="text-slate-500 mt-1">{selectedEvent.description}</p>
                </div>
              </div>
              <StatusBadge status={selectedEvent.status} size="md" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl sm:col-span-2">
                <User size={18} className="text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-1">Agents assignÃ©s</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.assignedAgentIds.map((agentId) => (
                      <span key={agentId} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-sm">
                        <span className="font-medium text-slate-900">{getAgentName(agentId)}</span>
                        <StatusBadge status={selectedEvent.agentResponses?.[agentId] || 'pending'} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {selectedEvent.client && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <Calendar size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Client</p>
                    <p className="text-sm font-medium text-slate-900">{selectedEvent.client}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Calendar size={18} className="text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">PÃ©riode</p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(selectedEvent.startDate)} â†’ {formatDate(selectedEvent.endDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <MapPin size={18} className="text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Lieu</p>
                  <p className="text-sm font-medium text-slate-900">{selectedEvent.address}</p>
                  {selectedEvent.geoRadius && (
                    <p className="text-xs text-slate-400">
                      Rayon de contrÃ´le : {selectedEvent.geoRadius}m
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Shifts display */}
            {selectedEvent.shifts && selectedEvent.shifts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock size={16} /> Horaires ({selectedEvent.shifts.length} crÃ©neau{selectedEvent.shifts.length > 1 ? 'x' : ''})
                </h4>
                <div className="space-y-3">
                  {groupShiftsByDate(selectedEvent.shifts).map(([date, shifts]) => (
                    <div key={date} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-slate-500 mb-2">{formatDate(date)}</p>
                      <div className="flex flex-wrap gap-2">
                        {shifts.map((sh) => (
                          <span
                            key={sh.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary-200 text-primary-700 rounded-lg text-sm font-medium"
                          >
                            <Clock size={14} />
                            {sh.startTime} â†’ {sh.endTime}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {selectedEvent.history.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <History size={16} /> Historique
                </h4>
                <div className="space-y-2">
                  {selectedEvent.history.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-sm px-3 py-2 bg-slate-50 rounded-lg"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
                      <span className="font-medium text-slate-700">{h.action}</span>
                      <span className="text-slate-400">â€”</span>
                      <span className="text-slate-500">{getAgentName(h.userId)}</span>
                      <span className="ml-auto text-xs text-slate-400">
                        {formatDateTime(h.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm transition-all"
              >
                <Edit3 size={16} /> Modifier
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl font-medium text-sm transition-all"
              >
                <Trash2 size={16} /> Supprimer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Event form modal â€” 2 tabs: Ã‰vÃ©nement / Affectation */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={formMode === 'create' ? 'Nouvel Ã©vÃ©nement' : 'Modifier l\'Ã©vÃ©nement'}
        size="xl"
      >
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
          {[
            { key: 'event' as const, label: 'Ã‰vÃ©nement', icon: Briefcase },
            { key: 'agents' as const, label: 'Affectation agents', icon: Users },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                formTab === key
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} />
              {label}
              {key === 'agents' && Object.keys(agentShiftAssignments).length > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[11px] font-bold flex items-center justify-center">
                  {Object.keys(agentShiftAssignments).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* TAB 1: Event info */}
          {formTab === 'event' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Titre *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Nom de l'intervention"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                    placeholder="Description dÃ©taillÃ©e"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Client</label>
                  <input
                    type="text"
                    value={form.client}
                    onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Nom du client"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Couleur</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EVENT_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`w-7 h-7 rounded-lg transition-all ${
                          form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date dÃ©but *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date fin *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>

                <LocationPicker
                  address={form.address}
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onUpdate={(fields) => setForm((f) => ({ ...f, ...fields }))}
                />

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Rayon GPS (m)</label>
                  <input
                    type="number"
                    value={form.geoRadius}
                    onChange={(e) => setForm((f) => ({ ...f, geoRadius: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="200"
                  />
                </div>

                {formMode === 'edit' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Statut</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EventStatus }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    >
                      <option value="planifie">PlanifiÃ©</option>
                      <option value="en_cours">En cours</option>
                      <option value="termine">TerminÃ©</option>
                      <option value="a_reattribuer">Ã€ rÃ©attribuer</option>
                      <option value="annule">AnnulÃ©</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <div className="flex gap-2">
                  {form.startDate && form.endDate && (
                    <button
                      type="button"
                      onClick={() => setFormTab('agents')}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl transition-all"
                    >
                      <Users size={16} /> Affecter des agents â†’
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/25 transition-all"
                  >
                    {formMode === 'create' ? 'CrÃ©er' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Agent assignment */}
          {formTab === 'agents' && (
            <div className="space-y-4">
              {(!form.startDate || !form.endDate) ? (
                <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
                  <Calendar size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Renseignez d'abord les dates de l'Ã©vÃ©nement dans l'onglet "Ã‰vÃ©nement".</p>
                </div>
              ) : (
                <>
                  {/* Info banner */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                    <Calendar size={16} className="text-blue-500 flex-shrink-0" />
                    <div className="text-xs text-blue-700">
                      <span className="font-semibold">Plage :</span> {formatDate(form.startDate)} â†’ {formatDate(form.endDate)}
                      <span className="ml-3 text-blue-500">({getEventDatesInRange([]).length} jours)</span>
                    </div>
                  </div>

                  {/* Add agent selector */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Plus size={15} className="text-emerald-500" /> Ajouter un agent
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {agents.filter((a) => !agentShiftAssignments[a.id]).map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => {
                            addAgentToEvent(agent.id);
                            startEditingAgent(agent.id);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                        >
                          <User size={14} className="text-slate-400" />
                          {agent.firstName} {agent.lastName}
                        </button>
                      ))}
                      {agents.filter((a) => !agentShiftAssignments[a.id]).length === 0 && (
                        <p className="text-xs text-slate-400 italic py-1">Tous les agents actifs sont assignÃ©s</p>
                      )}
                    </div>
                  </div>

                  {/* Assigned agents list */}
                  <div className="space-y-3">
                    {Object.entries(agentShiftAssignments).map(([agentId, agentShifts]) => {
                      const agent = users.find((u) => u.id === agentId);
                      const isEditing = editingAgentId === agentId;
                      const shiftCount = agentShifts.length;
                      const dayCount = new Set(agentShifts.map((s) => s.date)).size;

                      // Group shifts by date for summary
                      const shiftsByDate: Record<string, { startTime: string; endTime: string }[]> = {};
                      for (const s of agentShifts) {
                        if (!shiftsByDate[s.date]) shiftsByDate[s.date] = [];
                        shiftsByDate[s.date].push(s);
                      }

                      return (
                        <div key={agentId} className="border border-slate-200 rounded-xl overflow-hidden">
                          {/* Agent header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <User size={14} className="text-primary-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {agent ? `${agent.firstName} ${agent.lastName}` : 'Agent inconnu'}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {shiftCount > 0
                                    ? `${shiftCount} crÃ©neau${shiftCount > 1 ? 'x' : ''} sur ${dayCount} jour${dayCount > 1 ? 's' : ''}`
                                    : 'Aucun crÃ©neau dÃ©fini'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => isEditing ? setEditingAgentId(null) : startEditingAgent(agentId)}
                                className={`p-2 rounded-lg text-sm transition-colors ${
                                  isEditing
                                    ? 'bg-primary-100 text-primary-700'
                                    : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'
                                }`}
                                title="Modifier les crÃ©neaux"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAgentFromEvent(agentId)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                title="Retirer l'agent"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Shift summary (compact, when not editing) */}
                          {!isEditing && shiftCount > 0 && (
                            <div className="px-4 py-2.5 space-y-1 max-h-[200px] overflow-y-auto">
                              {Object.entries(shiftsByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, slots]) => {
                                const d = new Date(date + 'T12:00:00');
                                const dayName = WEEKDAY_NAMES[d.getDay()];
                                const dd = d.getDate().toString().padStart(2, '0');
                                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                                return (
                                  <div key={date} className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-primary-600 w-8">{dayName}</span>
                                    <span className="text-slate-600 font-medium w-12">{dd}/{mm}</span>
                                    <span className="text-slate-500">
                                      {slots.map((s) => `${s.startTime}â€“${s.endTime}`).join(', ')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Editing panel */}
                          {isEditing && (
                            <div className="px-4 py-3 space-y-4 bg-primary-50/30">
                              {/* Skip days */}
                              <div>
                                <p className="text-xs font-semibold text-slate-600 mb-1.5">Jours Ã  exclure</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {WEEKDAY_NAMES.map((name, i) => {
                                    const isSkipped = agentSkipDays.includes(i);
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => setAgentSkipDays(
                                          isSkipped ? agentSkipDays.filter((d) => d !== i) : [...agentSkipDays, i]
                                        )}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                                          isSkipped
                                            ? 'bg-amber-100 border-amber-300 text-amber-700'
                                            : 'bg-white border-slate-200 text-slate-500'
                                        }`}
                                      >
                                        {isSkipped && 'âœ• '}{name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Date selection */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-xs font-semibold text-slate-600">Dates de travail</p>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={selectAllDatesForAgent}
                                      className="text-[11px] font-medium text-primary-600 hover:text-primary-700 px-2 py-0.5 rounded bg-primary-50 hover:bg-primary-100 transition-colors"
                                    >
                                      Tout sÃ©lectionner
                                    </button>
                                    <button
                                      type="button"
                                      onClick={clearDatesForAgent}
                                      className="text-[11px] font-medium text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
                                    >
                                      Tout effacer
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto">
                                  {getEventDatesInRange(agentSkipDays).map((date) => {
                                    const d = new Date(date + 'T12:00:00');
                                    const dayName = WEEKDAY_NAMES[d.getDay()];
                                    const dd = d.getDate().toString().padStart(2, '0');
                                    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                                    const isSelected = agentShiftDates.has(date);
                                    return (
                                      <button
                                        key={date}
                                        type="button"
                                        onClick={() => {
                                          const next = new Set(agentShiftDates);
                                          if (next.has(date)) next.delete(date);
                                          else next.add(date);
                                          setAgentShiftDates(next);
                                        }}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                          isSelected
                                            ? 'bg-primary-100 border-primary-300 text-primary-800'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                        }`}
                                      >
                                        {isSelected && <Check size={11} />}
                                        <span className="font-bold">{dayName}</span> {dd}/{mm}
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {agentShiftDates.size} jour{agentShiftDates.size > 1 ? 's' : ''} sÃ©lectionnÃ©{agentShiftDates.size > 1 ? 's' : ''}
                                </p>
                              </div>

                              {/* Time slots template */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-xs font-semibold text-slate-600">CrÃ©neaux horaires</p>
                                  <button
                                    type="button"
                                    onClick={() => setAgentTemplateSlots((prev) => [...prev, { startTime: '08:00', endTime: '17:00' }])}
                                    className="text-[11px] font-medium text-primary-600 hover:text-primary-700 flex items-center gap-0.5"
                                  >
                                    <Plus size={12} /> Ajouter
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {agentTemplateSlots.map((slot, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <input
                                        type="time"
                                        value={slot.startTime}
                                        onChange={(e) =>
                                          setAgentTemplateSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, startTime: e.target.value } : s)))
                                        }
                                        className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                      />
                                      <span className="text-slate-300 text-xs">â†’</span>
                                      <input
                                        type="time"
                                        value={slot.endTime}
                                        onChange={(e) =>
                                          setAgentTemplateSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, endTime: e.target.value } : s)))
                                        }
                                        className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                      />
                                      {agentTemplateSlots.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => setAgentTemplateSlots((prev) => prev.filter((_, i) => i !== idx))}
                                          className="p-1.5 text-rose-400 hover:text-rose-600 rounded transition-colors"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Apply button */}
                              <button
                                type="button"
                                onClick={() => applyAgentShifts(agentId)}
                                disabled={agentShiftDates.size === 0}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-all"
                              >
                                <Check size={16} />
                                Appliquer {agentTemplateSlots.length} crÃ©neau{agentTemplateSlots.length > 1 ? 'x' : ''} Ã  {agentShiftDates.size} jour{agentShiftDates.size > 1 ? 's' : ''}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {Object.keys(agentShiftAssignments).length === 0 && (
                      <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
                        <Users size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400">Aucun agent affectÃ©. Ajoutez un agent ci-dessus.</p>
                      </div>
                    )}
                  </div>

                  {/* Conflict warning */}
                  {Object.keys(agentShiftAssignments).length > 0 && form.startDate && form.endDate && (
                    <ConflictWarning
                      agentIds={Object.keys(agentShiftAssignments)}
                      start={form.startDate}
                      end={form.endDate}
                      excludeId={selectedEvent?.id}
                    />
                  )}
                </>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormTab('event')}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  â† Ã‰vÃ©nement
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/25 transition-all"
                >
                  {formMode === 'create' ? 'CrÃ©er' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

const WEEKDAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];


function ConflictWarning({
  agentIds,
  start,
  end,
  excludeId,
}: {
  agentIds: string[];
  start: string;
  end: string;
  excludeId?: string;
}) {
  const { getConflicts } = useEventStore();
  const [allConflicts, setAllConflicts] = useState<PlanningEvent[]>([]);

  useEffect(() => {
    if (!agentIds.length || !start || !end) {
      setAllConflicts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const seen = new Set<string>();
      const results: PlanningEvent[] = [];
      for (const agentId of agentIds) {
        const conflicts = await getConflicts(agentId, start, end, excludeId);
        for (const c of conflicts) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            results.push(c);
          }
        }
      }
      if (!cancelled) setAllConflicts(results);
    })();
    return () => { cancelled = true; };
  }, [agentIds, start, end, excludeId, getConflicts]);

  if (allConflicts.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
        <AlertTriangle size={16} />
        Conflit de planning dÃ©tectÃ© !
      </div>
      <ul className="space-y-1">
        {allConflicts.map((c) => (
          <li key={c.id} className="text-sm text-amber-600">
            â€¢ {c.title} ({formatDate(c.startDate)} â†’ {formatDate(c.endDate)})
          </li>
        ))}
      </ul>
    </div>
  );
}

const MONTH_NAMES = [
  'Janvier', 'FÃ©vrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'AoÃ»t', 'Septembre', 'Octobre', 'Novembre', 'DÃ©cembre',
];

function YearOverview({
  year,
  events,
  onSelectMonth,
  onYearChange,
  onClose,
}: {
  year: number;
  events: PlanningEvent[];
  onSelectMonth: (month: number) => void;
  onYearChange: (year: number) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const currentMonth = today.getFullYear() === year ? today.getMonth() : -1;

  const eventsPerMonth = useMemo(() => {
    const counts = new Array(12).fill(0);
    for (const evt of events) {
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate);
      if (start.getFullYear() <= year && end.getFullYear() >= year) {
        const startMonth = start.getFullYear() < year ? 0 : start.getMonth();
        const endMonth = end.getFullYear() > year ? 11 : end.getMonth();
        for (let m = startMonth; m <= endMonth; m++) {
          counts[m]++;
        }
      }
    }
    return counts;
  }, [events, year]);

  const maxCount = Math.max(...eventsPerMonth, 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-500">
        <button
          onClick={() => onYearChange(year - 1)}
          className="p-2 hover:bg-white/15 rounded-xl transition-colors"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
        <h2 className="text-xl font-extrabold text-white tracking-tight">{year}</h2>
        <button
          onClick={() => onYearChange(year + 1)}
          className="p-2 hover:bg-white/15 rounded-xl transition-colors"
        >
          <ChevronRight size={20} className="text-white" />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-5">
        {MONTH_NAMES.map((name, idx) => {
          const count = eventsPerMonth[idx];
          const isCurrent = idx === currentMonth;
          const intensity = count > 0 ? Math.max(0.08, count / maxCount * 0.3) : 0;
          return (
            <button
              key={name}
              onClick={() => onSelectMonth(idx)}
              className={`group relative flex flex-col items-center justify-center gap-2 py-7 px-3 rounded-2xl transition-all duration-200 text-center ${
                isCurrent
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25 scale-[1.02]'
                  : 'bg-white border border-slate-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-1'
              }`}
              style={!isCurrent && count > 0 ? { backgroundColor: `rgba(99, 102, 241, ${intensity})` } : undefined}
            >
              <span className={`text-base font-bold tracking-tight ${
                isCurrent ? 'text-white' : 'text-slate-800 group-hover:text-primary-700'
              }`}>
                {name}
              </span>
              {count > 0 ? (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isCurrent
                    ? 'bg-white/25 text-white'
                    : 'bg-primary-100 text-primary-700'
                }`}>
                  <Briefcase size={11} />
                  {count}
                </span>
              ) : (
                <span className={`text-xs ${isCurrent ? 'text-white/60' : 'text-slate-300'}`}>â€”</span>
              )}
              {isCurrent && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full shadow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-center px-5 pb-5">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all hover:shadow-sm"
        >
          <CalendarDays size={16} />
          Retour au calendrier
        </button>
      </div>
    </div>
  );
}

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const HEATMAP_MONTH_NAMES = [
  'Sept', 'Oct', 'Nov', 'DÃ©c', 'Janv', 'FÃ©v',
  'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'AoÃ»t',
];

interface HeatmapEventInfo {
  id: string;
  title: string;
  client: string;
  color: string;
  status: EventStatus;
  address: string;
  shifts: EventShift[];
}

function HeatmapCalendar({
  year,
  events,
  onYearChange,
  onDayClick,
}: {
  year: number;
  events: PlanningEvent[];
  onYearChange: (y: number) => void;
  onDayClick: (date: string) => void;
}) {
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    x: number;
    y: number;
  } | null>(null);

  // Build a map: date -> array of event colors for that date
  const dateMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const evt of events) {
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate);
      const d = new Date(start);
      while (d <= end) {
        const key = d.toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(evt.color || statusColors[evt.status]);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  // Build a map: date -> array of event details
  const dateEventsMap = useMemo(() => {
    const map: Record<string, HeatmapEventInfo[]> = {};
    for (const evt of events) {
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate);
      const d = new Date(start);
      while (d <= end) {
        const key = d.toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push({
          id: evt.id,
          title: evt.title,
          client: evt.client || '',
          color: evt.color || statusColors[evt.status],
          status: evt.status,
          address: evt.address || '',
          shifts: evt.shifts?.filter((s) => s.date === key) || [],
        });
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  // Build the 12 months (Sept year-1 to Aug year) as columns
  const months = useMemo(() => {
    const result: Array<{
      label: string;
      days: Array<{ date: string; dayOfMonth: number; dayOfWeek: number } | null>;
    }> = [];

    for (let i = 0; i < 12; i++) {
      // Sept(year-1)=8, Oct=9, Nov=10, Dec=11, Jan(year)=0...
      const monthIdx = (8 + i) % 12;
      const yearForMonth = i < 4 ? year - 1 : year;
      const daysInMonth = new Date(yearForMonth, monthIdx + 1, 0).getDate();

      const days: Array<{ date: string; dayOfMonth: number; dayOfWeek: number } | null> = [];
      for (let d = 1; d <= 31; d++) {
        if (d <= daysInMonth) {
          const dateObj = new Date(yearForMonth, monthIdx, d);
          const dow = dateObj.getDay(); // 0=Sun
          const adjustedDow = dow === 0 ? 6 : dow - 1; // 0=Mon...6=Sun
          days.push({
            date: dateObj.toISOString().slice(0, 10),
            dayOfMonth: d,
            dayOfWeek: adjustedDow,
          });
        } else {
          days.push(null);
        }
      }

      result.push({ label: HEATMAP_MONTH_NAMES[i], days });
    }
    return result;
  }, [year]);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Get color for a day cell
  const getCellStyle = (date: string): React.CSSProperties => {
    const colors = dateMap[date];
    if (!colors || colors.length === 0) return {};
    const color = colors[0];
    const count = colors.length;
    const opacity = Math.min(0.4 + count * 0.2, 1);
    return { backgroundColor: color, opacity };
  };

  // Get multiple color bars for days with multiple events
  const getCellColors = (date: string): string[] => {
    const colors = dateMap[date];
    if (!colors || colors.length === 0) return [];
    // Deduplicate
    return [...new Set(colors)];
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700">
        <button
          onClick={() => onYearChange(year - 1)}
          className="p-2 hover:bg-white/15 rounded-xl transition-colors"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Sept {year - 1} â€” AoÃ»t {year}
          </h2>
          <p className="text-white/70 text-xs font-medium mt-0.5">Calendrier Heatmap</p>
        </div>
        <button
          onClick={() => onYearChange(year + 1)}
          className="p-2 hover:bg-white/15 rounded-xl transition-colors"
        >
          <ChevronRight size={20} className="text-white" />
        </button>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px] p-4">
          <table className="w-full border-collapse heatmap-table">
            <thead>
              <tr>
                <th className="w-8" />
                {months.map((m) => (
                  <th key={m.label} className="text-xs font-bold text-slate-600 pb-2 text-center">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 31 }, (_, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="text-right pr-2">
                    <span className="text-[10px] font-bold text-slate-400">{rowIdx + 1}</span>
                  </td>
                  {months.map((m) => {
                    const day = m.days[rowIdx];
                    if (!day) {
                      return <td key={`${m.label}-${rowIdx}`} className="heatmap-cell heatmap-empty" />;
                    }
                    const isToday = day.date === todayStr;
                    const hasEvents = dateMap[day.date] && dateMap[day.date].length > 0;
                    const isSunday = day.dayOfWeek === 6;
                    const isSaturday = day.dayOfWeek === 5;
                    const cellColors = getCellColors(day.date);
                    const dayEvts = dateEventsMap[day.date] || [];
                    return (
                      <td
                        key={`${m.label}-${rowIdx}`}
                        onClick={() => onDayClick(day.date)}
                        onMouseEnter={(e) => {
                          if (dayEvts.length > 0) {
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            setHoveredCell({ date: day.date, x: rect.left + rect.width / 2, y: rect.bottom + 4 });
                          }
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`heatmap-cell cursor-pointer transition-all ${
                          isToday ? 'ring-2 ring-primary-500 ring-offset-1 z-10 relative rounded' : ''
                        } ${
                          isSunday ? 'heatmap-sunday' : isSaturday ? 'heatmap-saturday' : ''
                        }`}
                      >
                        <div className="heatmap-cell-inner">
                          {cellColors.length === 1 ? (
                            <div className="heatmap-bar" style={getCellStyle(day.date)} />
                          ) : cellColors.length > 1 ? (
                            <div className="heatmap-multi-bar">
                              {cellColors.map((c, ci) => (
                                <div
                                  key={ci}
                                  className="heatmap-bar-segment"
                                  style={{ backgroundColor: c, flex: 1 }}
                                />
                              ))}
                            </div>
                          ) : null}
                          <span className={`heatmap-day-letter ${
                            isToday ? 'font-extrabold text-primary-700' :
                            isSunday ? 'text-rose-400' :
                            isSaturday ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {DAY_LETTERS[day.dayOfWeek]}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredCell && dateEventsMap[hoveredCell.date] && (
        <div
          className="fixed z-[9999] pointer-events-none animate-fadeIn"
          style={{
            left: hoveredCell.x,
            top: hoveredCell.y,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-3 min-w-[220px] max-w-[300px]">
            {/* Date header */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
              <Calendar size={13} className="text-primary-500" />
              <span className="text-xs font-bold text-slate-700">
                {new Date(hoveredCell.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            {/* Events list */}
            <div className="space-y-2">
              {dateEventsMap[hoveredCell.date].map((evt) => (
                <div key={evt.id} className="flex gap-2">
                  <span
                    className="w-1 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: evt.color, minHeight: 28 }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{evt.title}</p>
                    {evt.client && (
                      <p className="text-[10px] text-slate-400 truncate">{evt.client}</p>
                    )}
                    {evt.shifts.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={10} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[10px] text-slate-500 font-medium">
                          {evt.shifts.map((s) => `${s.startTime}â€“${s.endTime}`).join(' / ')}
                        </span>
                      </div>
                    )}
                    {evt.address && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[10px] text-slate-400 truncate">{evt.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge status={evt.status} />
                  </div>
                </div>
              ))}
            </div>
            {/* Arrow */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45" />
          </div>
        </div>
      )}

      {/* Event color legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-5 pb-4">
        {events.slice(0, 10).map((evt) => (
          <div key={evt.id} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: evt.color }} />
            <span className="text-xs text-slate-500 truncate max-w-[120px]">{evt.title}</span>
          </div>
        ))}
        {events.length > 10 && (
          <span className="text-xs text-slate-400">+{events.length - 10} autres</span>
        )}
        <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-200">
          <span className="w-3 h-3 rounded-sm bg-slate-200" />
          <span className="text-xs text-slate-400">Sam.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-300" />
          <span className="text-xs text-slate-400">Dim.</span>
        </div>
      </div>
    </div>
  );
}
