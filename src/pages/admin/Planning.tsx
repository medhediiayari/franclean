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
import type { PlanningEvent, EventStatus, EventShift, EventDraftVersion } from '../../types';
import LocationPicker from '../../components/common/LocationPicker';
import ClientCombobox from '../../components/common/ClientCombobox';
import TimeInput24 from '../../components/common/TimeInput24';
import { useClientStore } from '../../store/clientStore';
import { generatePlanningPDF, type PDFExportFilters } from '../../utils/pdfExport';
import {
  Plus,
  MapPin,
  User,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  UserPlus,
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
  Save,
  FileDown,
  Repeat,
  Send,
  FileEdit,
  RotateCcw,
  Eye,
  Archive,
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
  const { events, addEvent, updateEvent, deleteEvent, fetchEvents, duplicateWeek, repeatEvent, publishEvent, restoreVersion } = useEventStore();
  const { users, fetchUsers } = useAuthStore();
  const { clients: dbClients, fetchClients, addClient, addSite } = useClientStore();

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchClients(); }, [fetchClients]);

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
    clientPhone: '',
    site: '',
    color: EVENT_PALETTE[0],
    startDate: '',
    endDate: '',
    address: '',
    latitude: '',
    longitude: '',
    geoRadius: '500',
    hourlyRate: '',
    breakHours: '0',
    assignedAgentIds: [] as string[],
    status: 'planifie' as EventStatus,
  });

  const [formTab, setFormTab] = useState<'event' | 'agents'>('event');
  const [formError, setFormError] = useState<string | null>(null);

  // ── Inline client / site creation ───────────────────
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '', email: '', phone: '', address: '', siret: '', notes: '',
  });
  const [showNewSiteForm, setShowNewSiteForm] = useState(false);
  const [newSiteForm, setNewSiteForm] = useState({
    name: '', hourlyRate: '', notes: '',
  });

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
  const [perDateSlots, setPerDateSlots] = useState<Record<string, { startTime: string; endTime: string }[]>>({});
  const [showResponsesWidget, setShowResponsesWidget] = useState(true);
  const [expandedResponseEventId, setExpandedResponseEventId] = useState<string | null>(null);

  // Conflict detection for agent assignment
  type PlanningConflictInfo = {
    agentId: string;
    agentName: string;
    conflicts: { eventTitle: string; date: string; startTime: string; endTime: string }[];
  };
  const [conflictPopup, setConflictPopup] = useState<PlanningConflictInfo | null>(null);

  // PDF export dialog
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [pdfPeriod, setPdfPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [pdfFilterAgent, setPdfFilterAgent] = useState<string>('');
  const [pdfFilterClient, setPdfFilterClient] = useState<string>('');
  const [pdfFilterSite, setPdfFilterSite] = useState<string>('');
  // Draft version history panel
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Duplicate week modal
  const [showDuplicateWeek, setShowDuplicateWeek] = useState(false);
  const [dupWeekSource, setDupWeekSource] = useState('');
  const [dupWeekTarget, setDupWeekTarget] = useState('');
  const [dupWeekLoading, setDupWeekLoading] = useState(false);
  const [dupWeekMsg, setDupWeekMsg] = useState<string | null>(null);

  // Repeat event modal
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [repeatSkipWeekends, setRepeatSkipWeekends] = useState(true);
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [repeatMsg, setRepeatMsg] = useState<string | null>(null);

  // Compute agent responses grouped by event
  const eventResponsesGrouped = useMemo(() => {
    const nameOf = (id: string) => {
      const u = users.find((u) => u.id === id);
      return u ? `${u.firstName} ${u.lastName}` : 'Non assigné';
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
      if (evt.isDraft) continue; // Draft events: agents not notified yet, skip responses widget
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

  // Unique clients & sites for PDF filter dropdowns
  const uniqueClients = useMemo(() => {
    const clients = new Set(events.map(e => e.client).filter(Boolean));
    return Array.from(clients).sort();
  }, [events]);

  const uniqueSites = useMemo(() => {
    const sites = new Set(events.map(e => e.site).filter(Boolean));
    return Array.from(sites).sort();
  }, [events]);

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
      extendedProps?: { shiftsInfo: string };
    }> = [];
    for (const evt of events) {
      if (evt.shifts && evt.shifts.length > 0) {
        // Group shifts by date to show one entry per event per day
        const shiftsByDate: Record<string, EventShift[]> = {};
        for (const shift of evt.shifts) {
          const d = shift.date;
          if (!shiftsByDate[d]) shiftsByDate[d] = [];
          shiftsByDate[d].push(shift);
        }
        for (const [date, dayShifts] of Object.entries(shiftsByDate)) {
          const earliest = dayShifts.reduce((a, b) => (a.startTime < b.startTime ? a : b));
          const latest = dayShifts.reduce((a, b) => (a.endTime > b.endTime ? a : b));
          const shiftsInfo = dayShifts.map(s => `${s.startTime}-${s.endTime}`).join(' / ');
          const draftPrefix = evt.isDraft ? '📝 ' : '';
          result.push({
            id: `${evt.id}__${date}`,
            title: `${draftPrefix}${evt.title}`,
            start: `${date}T${earliest.startTime}:00`,
            end: `${date}T${latest.endTime}:00`,
            backgroundColor: evt.isDraft ? '#94A3B8' : (evt.color || statusColors[evt.status]),
            borderColor: evt.isDraft ? '#64748B' : (evt.color || statusColors[evt.status]),
            extendedProps: { shiftsInfo },
          });
        }
      } else {
        const draftPrefix = evt.isDraft ? '📝 ' : '';
        result.push({
          id: evt.id,
          title: `${draftPrefix}${evt.title}`,
          start: evt.startDate,
          end: evt.endDate,
          allDay: true,
          backgroundColor: evt.isDraft ? '#94A3B8' : (evt.color || statusColors[evt.status]),
          borderColor: evt.isDraft ? '#64748B' : (evt.color || statusColors[evt.status]),
        });
      }
    }
    return result;
  }, [events]);

  // ── Alertes événements non attribués ──────────────────
  const alertData = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000);
    const in7Str = in7Days.toISOString().slice(0, 10);

    const activeUpcoming = events.filter((e) =>
      e.status !== 'termine' && e.status !== 'annule' && e.startDate <= in7Str
    );

    const fullyUnassigned = activeUpcoming.filter((e) => {
      if (e.assignedAgentIds.length > 0) return false;
      const shifts = e.shifts || [];
      return shifts.length === 0 || shifts.every((s) => !s.agentId);
    });

    const partiallyUnassigned = activeUpcoming.filter((e) => {
      const shifts = e.shifts || [];
      if (shifts.length <= 1) return false;
      const withAgent = shifts.filter((s) => s.agentId);
      return withAgent.length > 0 && withAgent.length < shifts.length;
    }).map((e) => {
      const unassignedDates = [...new Set(
        (e.shifts || []).filter((s) => !s.agentId).map((s) => s.date)
      )].sort();
      return { event: e, unassignedDates };
    });

    return { fullyUnassigned, partiallyUnassigned };
  }, [events]);

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      client: '',
      clientPhone: '',
      site: '',
      color: EVENT_PALETTE[Math.floor(Math.random() * EVENT_PALETTE.length)],
      startDate: '',
      endDate: '',
      address: '',
      latitude: '',
      longitude: '',
      geoRadius: '500',
      hourlyRate: '',
      breakHours: '0',
      assignedAgentIds: [] as string[],
      status: 'planifie',
    });
    setAgentShiftAssignments({});
    setPerDateSlots({});
    setEditingAgentId(null);
    setFormTab('event');
    setFormError(null);
    setSelectedEvent(null);
    setShowNewClientForm(false);
    setNewClientForm({ name: '', email: '', phone: '', address: '', siret: '', notes: '' });
    setShowNewSiteForm(false);
    setNewSiteForm({ name: '', hourlyRate: '', notes: '' });
  };

  const handleDateSelect = (info: { startStr: string; endStr: string }) => {
    resetForm();
    const start = info.startStr.slice(0, 10);
    // FullCalendar endStr for day selection is exclusive, so subtract 1 day
    const endDate = new Date(info.endStr);
    endDate.setDate(endDate.getDate() - 1);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
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
      clientPhone: selectedEvent.clientPhone || '',
      site: selectedEvent.site || '',
      color: selectedEvent.color || EVENT_PALETTE[0],
      startDate: selectedEvent.startDate,
      endDate: selectedEvent.endDate,
      address: selectedEvent.address,
      latitude: selectedEvent.latitude?.toString() || '',
      longitude: selectedEvent.longitude?.toString() || '',
      geoRadius: selectedEvent.geoRadius?.toString() || '500',
      hourlyRate: selectedEvent.hourlyRate?.toString() || '',
      breakHours: selectedEvent.breakHours?.toString() || '0',
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
    // Ensure agents without shifts still appear in assignments
    for (const agentId of selectedEvent.assignedAgentIds) {
      if (!assignments[agentId]) {
        assignments[agentId] = [];
      }
    }
    setAgentShiftAssignments(assignments);
    setEditingAgentId(null);
    setFormTab('event');
    setFormMode('edit');
    setShowDetail(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    setFormError(null);

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setFormError('La date de fin ne peut pas être avant la date de début.');
      return;
    }

    if (!form.hourlyRate || parseFloat(form.hourlyRate) <= 0) {
      setFormError('Le prix HT / heure est obligatoire.');
      return;
    }

    // ── Inline client creation ────────────────────────
    let clientName = form.client;
    let resolvedClientId: string | null = null;

    if (showNewClientForm) {
      if (!newClientForm.name.trim()) {
        setFormError('Le nom du client est obligatoire.');
        return;
      }
      try {
        const created = await addClient({
          name: newClientForm.name.trim().toUpperCase(),
          email: newClientForm.email || undefined,
          phone: newClientForm.phone || undefined,
          address: newClientForm.address || undefined,
          siret: newClientForm.siret || undefined,
          notes: newClientForm.notes || undefined,
        });
        clientName = created.name;
        resolvedClientId = created.id;
      } catch (err: any) {
        setFormError(err?.message || 'Erreur lors de la création du client.');
        return;
      }
    } else {
      const match = dbClients.find((c) => c.name === clientName);
      if (match) resolvedClientId = match.id;
    }

    // ── Inline site creation ──────────────────────────
    let siteName = form.site;

    if (showNewSiteForm && resolvedClientId) {
      if (!newSiteForm.name.trim()) {
        setFormError('Le nom du site est obligatoire.');
        return;
      }
      try {
        const created = await addSite(resolvedClientId, {
          name: newSiteForm.name.trim(),
          address: form.address || undefined,
          hourlyRate: newSiteForm.hourlyRate ? parseFloat(newSiteForm.hourlyRate) : undefined,
          notes: newSiteForm.notes || undefined,
        });
        siteName = created.name;
      } catch (err: any) {
        setFormError(err?.message || 'Erreur lors de la création du site.');
        return;
      }
    }

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
      client: clientName || undefined,
      clientPhone: (showNewClientForm ? newClientForm.phone : form.clientPhone) || undefined,
      site: siteName || undefined,
      color: form.color,
      startDate: form.startDate,
      endDate: form.endDate,
      shifts: allShifts,
      address: form.address,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      geoRadius: form.geoRadius ? parseInt(form.geoRadius) : 500,
      hourlyRate: parseFloat(form.hourlyRate),
      breakHours: form.breakHours ? parseFloat(form.breakHours) : 0,
      assignedAgentIds: allAgentIds,
      status: form.status,
      isDraft: saveAsDraft,
    };

    try {
      if (formMode === 'create') {
        await addEvent(eventData);
      } else if (selectedEvent) {
        await updateEvent(selectedEvent.id, eventData);
      }
    } catch (err) {
      console.error('Failed to save event', err);
      setFormError('Erreur lors de la sauvegarde de l\'événement.');
      return;
    }

    setShowForm(false);
    resetForm();
    setSelectedEvent(null);
  };

  const handleDelete = async () => {
    if (selectedEvent && confirm('Supprimer cet événement ?')) {
      try {
        await deleteEvent(selectedEvent.id);
      } catch (err) {
        console.error('Failed to delete event', err);
      }
      setShowDetail(false);
      setSelectedEvent(null);
    }
  };

  const handleEventDrop = async (info: any) => {
    const evtId = info.event.id.includes('__') ? info.event.id.split('__')[0] : info.event.id;
    const evt = events.find((e) => e.id === evtId);
    const startDate = info.event.startStr.slice(0, 10);
    const endDate = info.event.endStr ? info.event.endStr.slice(0, 10) : startDate;
    try {
      const updateData: any = { startDate, endDate };
      if (evt && evt.shifts && evt.shifts.length > 0 && evt.startDate) {
        const oldStart = new Date(evt.startDate + 'T12:00:00');
        const newStart = new Date(startDate + 'T12:00:00');
        const dayOffset = Math.round((newStart.getTime() - oldStart.getTime()) / 86400000);
        updateData.shifts = evt.shifts.map((s) => {
          const d = new Date(s.date + 'T12:00:00');
          d.setDate(d.getDate() + dayOffset);
          const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return { date: newDate, startTime: s.startTime, endTime: s.endTime, agentId: s.agentId || undefined };
        });
      }
      await updateEvent(evtId, updateData);
    } catch (err) {
      console.error('Failed to update event', err);
      info.revert();
    }
  };

  const getAgentName = (id: string) => {
    const agent = users.find((u) => u.id === id);
    return agent ? `${agent.firstName} ${agent.lastName}` : 'Non assigné';
  };

  // ── Version diff helper ──────────────────────────────────
  const FIELD_LABELS: Record<string, string> = {
    title: 'Titre',
    description: 'Description',
    client: 'Client',
    clientPhone: 'Tél. client',
    site: 'Site',
    color: 'Couleur',
    startDate: 'Date début',
    endDate: 'Date fin',
    address: 'Adresse',
    latitude: 'Latitude',
    longitude: 'Longitude',
    geoRadius: 'Rayon géo.',
    hourlyRate: 'Taux horaire',
    breakHours: 'Heures de pause',
    status: 'Statut',
    isDraft: 'Brouillon',
  };

  type FieldChange = { field: string; label: string; before: string; after: string };

  const formatFieldValue = (key: string, val: any): string => {
    if (val === null || val === undefined || val === '') return '—';
    if (key === 'isDraft') return val ? 'Oui' : 'Non';
    if (key === 'hourlyRate') return `${val} €/h`;
    if (key === 'breakHours') return `${val}h`;
    if (key === 'geoRadius') return `${val} m`;
    if (key === 'status') {
      const statusLabels: Record<string, string> = { planifie: 'Planifié', en_cours: 'En cours', termine: 'Terminé', a_reattribuer: 'À réattribuer', annule: 'Annulé' };
      return statusLabels[val] || val;
    }
    return String(val);
  };

  const computeFieldChanges = (before: any, after: any): FieldChange[] => {
    if (!before || !after) return [];
    const changes: FieldChange[] = [];

    // Compare scalar fields
    for (const key of Object.keys(FIELD_LABELS)) {
      const bVal = before[key] ?? null;
      const aVal = after[key] ?? null;
      if (String(bVal ?? '') !== String(aVal ?? '')) {
        changes.push({
          field: key,
          label: FIELD_LABELS[key],
          before: formatFieldValue(key, bVal),
          after: formatFieldValue(key, aVal),
        });
      }
    }

    // Compare agents
    const bAgents = (before.assignedAgentIds || []).slice().sort();
    const aAgents = (after.assignedAgentIds || []).slice().sort();
    if (JSON.stringify(bAgents) !== JSON.stringify(aAgents)) {
      changes.push({
        field: 'assignedAgentIds',
        label: 'Agents',
        before: bAgents.length > 0 ? bAgents.map((id: string) => getAgentName(id)).join(', ') : '—',
        after: aAgents.length > 0 ? aAgents.map((id: string) => getAgentName(id)).join(', ') : '—',
      });
    }

    // Compare shifts count / content
    const bShifts = before.shifts || [];
    const aShifts = after.shifts || [];
    const shiftStr = (s: any) => `${s.date} ${s.startTime}-${s.endTime}`;
    const bShiftStr = bShifts.map(shiftStr).sort().join(' | ');
    const aShiftStr = aShifts.map(shiftStr).sort().join(' | ');
    if (bShiftStr !== aShiftStr) {
      changes.push({
        field: 'shifts',
        label: 'Créneaux',
        before: bShifts.length > 0 ? `${bShifts.length} créneau(x)` : '—',
        after: aShifts.length > 0 ? `${aShifts.length} créneau(x)` : '—',
      });
    }

    return changes;
  };

  /** Build a snapshot-like object from the current selectedEvent for diff comparison */
  const currentEventAsSnapshot = (ev: PlanningEvent) => ({
    title: ev.title,
    description: ev.description,
    client: ev.client,
    clientPhone: ev.clientPhone,
    site: ev.site,
    color: ev.color,
    startDate: ev.startDate,
    endDate: ev.endDate,
    address: ev.address,
    latitude: ev.latitude,
    longitude: ev.longitude,
    geoRadius: ev.geoRadius,
    hourlyRate: ev.hourlyRate,
    breakHours: ev.breakHours,
    status: ev.status,
    isDraft: ev.isDraft,
    shifts: ev.shifts.map(s => ({ date: s.date, startTime: s.startTime, endTime: s.endTime, agentId: s.agentId })),
    assignedAgentIds: ev.assignedAgentIds,
  });

  // Helper: get all dates in event range
  const getEventDatesInRange = (skip: number[] = [0, 6]): string[] => {
    if (!form.startDate || !form.endDate) return [];
    const dates: string[] = [];
    const d = new Date(form.startDate + 'T12:00:00');
    const endDate = new Date(form.endDate + 'T12:00:00');
    while (d <= endDate) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!skip.includes(d.getDay())) {
        dates.push(iso);
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  // Agent assignment helpers
  const detectAgentConflicts = (agentId: string) => {
    if (!form.startDate || !form.endDate) return [];
    const eventId = selectedEvent?.id || '';
    const shiftDates = getEventDatesInRange([]);
    const conflicts: PlanningConflictInfo['conflicts'] = [];
    for (const evt of events) {
      if (evt.id === eventId) continue;
      const agentAssigned = evt.assignedAgentIds.includes(agentId);
      const agentSpecificShifts = (evt.shifts || []).filter(s => s.agentId === agentId);
      if (!agentAssigned && agentSpecificShifts.length === 0) continue;
      const relevantShifts = agentSpecificShifts.length > 0
        ? agentSpecificShifts
        : (evt.shifts || []).filter(s => !s.agentId);
      if (relevantShifts.length > 0) {
        for (const shift of relevantShifts) {
          if (shiftDates.includes(shift.date)) {
            conflicts.push({ eventTitle: evt.title, date: shift.date, startTime: shift.startTime, endTime: shift.endTime });
          }
        }
      } else if (agentAssigned) {
        const start = new Date(evt.startDate + 'T00:00:00');
        const end = new Date(evt.endDate + 'T00:00:00');
        const evtDates: string[] = [];
        const d = new Date(start);
        while (d <= end) { evtDates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); d.setDate(d.getDate()+1); }
        for (const dt of shiftDates) {
          if (evtDates.includes(dt)) {
            conflicts.push({ eventTitle: evt.title, date: dt, startTime: '', endTime: '' });
          }
        }
      }
    }
    return conflicts;
  };

  const addAgentToEvent = (agentId: string) => {
    if (agentShiftAssignments[agentId]) return;
    const conflicts = detectAgentConflicts(agentId);
    if (conflicts.length > 0) {
      setConflictPopup({
        agentId,
        agentName: getAgentName(agentId),
        conflicts,
      });
      return;
    }
    confirmAddAgentToEvent(agentId);
    startEditingAgent(agentId);
  };

  const confirmAddAgentToEvent = (agentId: string) => {
    setAgentShiftAssignments((prev) => ({ ...prev, [agentId]: [] }));
    setConflictPopup(null);
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
    const shifts: { date: string; startTime: string; endTime: string }[] = [];
    for (const [date, slots] of Object.entries(perDateSlots)) {
      for (const slot of slots) {
        shifts.push({ date, startTime: slot.startTime, endTime: slot.endTime });
      }
    }
    if (shifts.length === 0) return;
    setAgentShiftAssignments((prev) => ({ ...prev, [agentId]: shifts }));
    setEditingAgentId(null);
  };

  const applyTemplateToSelectedDates = () => {
    const dates = Array.from(agentShiftDates).sort();
    const newPerDateSlots: Record<string, { startTime: string; endTime: string }[]> = {};
    for (const date of dates) {
      newPerDateSlots[date] = agentTemplateSlots.map(s => ({ ...s }));
    }
    setPerDateSlots(newPerDateSlots);
  };

  const startEditingAgent = (agentId: string) => {
    setEditingAgentId(agentId);
    const existing = agentShiftAssignments[agentId] || [];
    setAgentShiftDates(new Set(existing.map((s) => s.date)));
    // Build per-date slots from existing assignments
    const dateSlots: Record<string, { startTime: string; endTime: string }[]> = {};
    for (const s of existing) {
      if (!dateSlots[s.date]) dateSlots[s.date] = [];
      dateSlots[s.date].push({ startTime: s.startTime, endTime: s.endTime });
    }
    setPerDateSlots(dateSlots);
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
    setPerDateSlots(prev => {
      const next = { ...prev };
      for (const date of dates) {
        if (!next[date]) {
          next[date] = agentTemplateSlots.map(s => ({ ...s }));
        }
      }
      return next;
    });
  };

  const clearDatesForAgent = () => {
    setAgentShiftDates(new Set());
    setPerDateSlots({});
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

  // Get Monday of a given date
  const getMondayOf = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  };

  // Handle duplicate week
  const handleDuplicateWeek = async () => {
    if (!dupWeekSource || !dupWeekTarget) return;
    setDupWeekLoading(true);
    setDupWeekMsg(null);
    try {
      const sourceMonday = getMondayOf(dupWeekSource);
      const targetMonday = getMondayOf(dupWeekTarget);
      const result = await duplicateWeek(sourceMonday, targetMonday);
      setDupWeekMsg(`✅ ${result.count} événement(s) dupliqué(s) avec succès !`);
      setTimeout(() => { setShowDuplicateWeek(false); setDupWeekMsg(null); }, 2000);
    } catch (err: any) {
      setDupWeekMsg(`❌ ${err.message || 'Erreur lors de la duplication.'}`);
    } finally {
      setDupWeekLoading(false);
    }
  };

  // Handle PDF export with filters
  const handleExportPDF = () => {
    const filters: PDFExportFilters = {};
    if (pdfFilterAgent) filters.agentId = pdfFilterAgent;
    if (pdfFilterClient) filters.client = pdfFilterClient;
    if (pdfFilterSite) filters.site = pdfFilterSite;
    generatePlanningPDF(events, users, new Date(), pdfPeriod, Object.keys(filters).length > 0 ? filters : undefined);
    setShowPdfDialog(false);
    // Reset filters
    setPdfFilterAgent('');
    setPdfFilterClient('');
    setPdfFilterSite('');
  };

  // Handle repeat event
  const handleRepeatEvent = async () => {
    if (!selectedEvent || !repeatEndDate) return;
    setRepeatLoading(true);
    setRepeatMsg(null);
    try {
      const result = await repeatEvent(selectedEvent.id, repeatFrequency, repeatEndDate, repeatSkipWeekends);
      setRepeatMsg(`✅ ${result.count} événement(s) créé(s) !`);
      setTimeout(() => { setShowRepeatModal(false); setRepeatMsg(null); setShowDetail(false); }, 2000);
    } catch (err: any) {
      setRepeatMsg(`❌ ${err.message || 'Erreur lors de la répétition.'}`);
    } finally {
      setRepeatLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between bg-[#0E2137] rounded-xl px-6 py-4 shadow-lg">
        <div>
          <h1 className="text-xl font-bold text-white">Planification</h1>
          <p className="text-slate-300 mt-0.5 text-sm">Gestion des événements et interventions</p>
        </div>
        <div className="flex items-center gap-2">
          {/* PDF Export */}
          <button
            onClick={() => setShowPdfDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-medium text-sm transition-all"
          >
            <FileDown size={16} />
            Exporter PDF
          </button>
          <button
            onClick={() => {
              setDupWeekSource('');
              setDupWeekTarget('');
              setDupWeekMsg(null);
              setShowDuplicateWeek(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-medium text-sm transition-all"
          >
            <Repeat size={16} />
            Dupliquer semaine
          </button>
          <button
            onClick={() => {
              resetForm();
              setFormMode('create');
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-primary-600/25 transition-all"
          >
            <Plus size={18} />
            Nouvel événement
          </button>
        </div>
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

      {/* Agent Responses Widget — grouped by event */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowResponsesWidget(!showResponsesWidget)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-primary-600" />
            <span className="font-semibold text-slate-800 text-sm">Réponses des agents</span>
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
                <p className="text-sm text-slate-400">Aucun événement actif avec des agents assignés</p>
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
                          {group.agents.length} agent{group.agents.length > 1 ? 's' : ''} assigné{group.agents.length > 1 ? 's' : ''}
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
                                  <UserCheck size={13} /> Accepté
                                </span>
                              )}
                              {agent.response === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-700">
                                  <Clock size={13} /> En attente
                                </span>
                              )}
                              {agent.response === 'refused' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-red-100 text-red-700">
                                  <UserX size={13} /> Refusé
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
                          Voir le détail de l'événement →
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
          { key: 'year' as const, label: 'Année', icon: Grid3X3 },
          { key: 'heatmap' as const, label: 'Activité annuelle', icon: Flame },
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
        <>
        {/* Alertes attribution */}
        {(alertData.fullyUnassigned.length > 0 || alertData.partiallyUnassigned.length > 0) && (
          <div className="space-y-2">
            {alertData.fullyUnassigned.length > 0 && (
              <div className="bg-red-50/60 border border-red-100 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <UserX className="text-red-400 flex-shrink-0" size={16} />
                  <p className="text-xs text-red-600 font-medium">
                    {alertData.fullyUnassigned.length} événement(s) sans agent attribué à moins de 7 jours
                  </p>
                </div>
                <div className="mt-2 space-y-1 pl-7">
                  {alertData.fullyUnassigned.map((e) => {
                    const daysLeft = Math.ceil((new Date(e.startDate).getTime() - Date.now()) / 86400000);
                    return (
                      <button
                        key={e.id}
                        className="text-xs text-red-500 flex items-center gap-2 hover:text-red-700 transition-colors cursor-pointer"
                        onClick={() => { setSelectedEvent(e); setShowDetail(true); }}
                      >
                        <span className="font-semibold underline">{e.title}</span>
                        <span className="text-red-400">—</span>
                        <span>{daysLeft <= 0 ? 'Déjà commencé' : daysLeft === 1 ? 'Demain' : `Dans ${daysLeft}j`} ({e.startDate})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {alertData.partiallyUnassigned.length > 0 && (
              <div className="bg-amber-50/60 border border-amber-100 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-amber-500 flex-shrink-0" size={16} />
                  <p className="text-xs text-amber-700 font-medium">
                    {alertData.partiallyUnassigned.length} événement(s) avec des créneaux non attribués
                  </p>
                </div>
                <div className="mt-2 space-y-1 pl-7">
                  {alertData.partiallyUnassigned.map(({ event: e, unassignedDates }) => (
                    <button
                      key={e.id}
                      className="text-xs text-amber-600 flex items-center gap-2 hover:text-amber-800 transition-colors cursor-pointer flex-wrap"
                      onClick={() => { setSelectedEvent(e); setShowDetail(true); }}
                    >
                      <span className="font-semibold underline">{e.title}</span>
                      <span className="text-amber-400">—</span>
                      <span>{unassignedDates.length} jour(s) : {unassignedDates.join(', ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays size={16} className="text-primary-500" />
              <span className="font-medium">{events.length} événement{events.length > 1 ? 's' : ''}</span>
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
              editable={true}
              eventDrop={handleEventDrop}
              height="auto"
              dayMaxEvents={3}
              firstDay={1}
              moreLinkContent={(arg) => `+${arg.num} de plus`}
            />
          </div>
        </div>
        </>
      )}
      <Modal
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setShowVersionHistory(false); }}
        title="Détail de l'événement"
        size="lg"
      >
        {selectedEvent && (
          <div className="space-y-6">
            {/* Draft banner */}
            {selectedEvent.isDraft && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileEdit size={18} className="text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Brouillon non publié</p>
                    <p className="text-xs text-amber-600">Les agents ne voient pas encore cette mission. Publiez pour envoyer les notifications.</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    // Check if all agents have at least one shift
                    const agentsWithoutShifts = selectedEvent.assignedAgentIds.filter(
                      (agentId) => !selectedEvent.shifts.some((s) => s.agentId === agentId)
                    );
                    if (agentsWithoutShifts.length > 0) {
                      const names = agentsWithoutShifts.map((id) => getAgentName(id)).join(', ');
                      alert(`Impossible de publier : les agents suivants n'ont aucun créneau attribué :\n\n${names}\n\nVeuillez modifier la mission et attribuer au moins un créneau à chaque agent avant de publier.`);
                      return;
                    }
                    if (!confirm('Publier ce brouillon ? Les agents seront notifiés.')) return;
                    setPublishingId(selectedEvent.id);
                    try {
                      const updated = await publishEvent(selectedEvent.id);
                      setSelectedEvent(updated);
                    } catch (err) { console.error(err); }
                    setPublishingId(null);
                  }}
                  disabled={publishingId === selectedEvent.id}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl font-medium text-sm transition-all whitespace-nowrap"
                >
                  <Send size={14} />
                  {publishingId === selectedEvent.id ? 'Publication...' : 'Publier'}
                </button>
              </div>
            )}

            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: selectedEvent.color, boxShadow: `0 0 0 3px ${selectedEvent.color}30` }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">{selectedEvent.title}</h3>
                    {selectedEvent.isDraft && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 rounded-full">
                        Brouillon
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 mt-1">{selectedEvent.description}</p>
                </div>
              </div>
              <StatusBadge status={selectedEvent.status} size="md" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl sm:col-span-2">
                <User size={18} className="text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-1">Agents assignés</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.assignedAgentIds.map((agentId) => {
                      const hasShift = selectedEvent.shifts.some(s => s.agentId === agentId);
                      return (
                        <span key={agentId} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-sm">
                          <span className="font-medium text-slate-900">{getAgentName(agentId)}</span>
                          {selectedEvent.isDraft ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-500">
                              <FileEdit size={10} /> Non notifié
                            </span>
                          ) : (
                            <StatusBadge status={selectedEvent.agentResponses?.[agentId] || 'pending'} />
                          )}
                          {!hasShift && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                              <AlertTriangle size={10} /> Sans créneau
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {selectedEvent.client && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <Calendar size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Client</p>
                    <p className="text-sm font-medium text-slate-900">
                      {selectedEvent.client}
                      {selectedEvent.clientPhone && (
                        <a href={`tel:${selectedEvent.clientPhone}`} className="ml-2 text-primary-600 hover:text-primary-700 font-normal text-xs">
                          📞 {selectedEvent.clientPhone}
                        </a>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {selectedEvent.site && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <MapPin size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Site</p>
                    <p className="text-sm font-medium text-slate-900">{selectedEvent.site}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Calendar size={18} className="text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Période</p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(selectedEvent.startDate)} →  {formatDate(selectedEvent.endDate)}
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
                      Rayon de contrôle : {selectedEvent.geoRadius}m
                    </p>
                  )}
                </div>
              </div>

              {selectedEvent.hourlyRate != null && selectedEvent.hourlyRate > 0 && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                  <span className="text-lg">💶</span>
                  <div>
                    <p className="text-xs text-slate-400">Prix unitaire HT</p>
                    <p className="text-sm font-bold text-emerald-700">{selectedEvent.hourlyRate.toFixed(2)} € / heure</p>
                  </div>
                </div>
              )}

              {(selectedEvent.breakHours ?? 0) > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                  <span className="text-lg">⏱</span>
                  <div>
                    <p className="text-xs text-slate-400">Heures de pause</p>
                    <p className="text-sm font-bold text-amber-700">{selectedEvent.breakHours}h de pause (déduites du total)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Shifts display */}
            {selectedEvent.shifts && selectedEvent.shifts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock size={16} /> Horaires ({selectedEvent.shifts.length} créneau{selectedEvent.shifts.length > 1 ? 'x' : ''})
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
                            {sh.startTime} →  {sh.endTime}
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
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{getAgentName(h.userId)}</span>
                      <span className="ml-auto text-xs text-slate-400">
                        {formatDateTime(h.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Version History */}
            {selectedEvent.draftVersions && selectedEvent.draftVersions.length > 0 && (
              <div>
                <button
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-primary-600 transition-colors mb-3"
                >
                  <Archive size={16} />
                  Historique des versions ({selectedEvent.draftVersions.length})
                  {showVersionHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showVersionHistory && (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {selectedEvent.draftVersions.map((v, idx, arr) => {
                      let parsed: any = null;
                      try { parsed = JSON.parse(v.snapshot); } catch {}

                      // Compute diff: compare this version's snapshot with the NEXT version (or current event for the latest)
                      let changes: FieldChange[] = [];
                      if (parsed) {
                        if (idx === 0) {
                          // Latest version → compare with current event state
                          changes = computeFieldChanges(parsed, currentEventAsSnapshot(selectedEvent));
                        } else {
                          // Compare with the version above (more recent)
                          let nextParsed: any = null;
                          try { nextParsed = JSON.parse(arr[idx - 1].snapshot); } catch {}
                          if (nextParsed) changes = computeFieldChanges(parsed, nextParsed);
                        }
                      }

                      return (
                        <div key={v.id} className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                                  v{v.versionNum}
                                </span>
                                <span className="text-xs font-medium text-slate-700 truncate">{v.label}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-400">{getAgentName(v.createdBy)}</span>
                                <span className="text-[10px] text-slate-300">·</span>
                                <span className="text-[10px] text-slate-400">{formatDateTime(v.createdAt)}</span>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                if (!confirm(`Restaurer la version ${v.versionNum} ?\nL'état actuel sera sauvegardé automatiquement avant la restauration.`)) return;
                                setRestoringVersionId(v.id);
                                try {
                                  const restored = await restoreVersion(selectedEvent.id, v.id);
                                  setSelectedEvent(restored);
                                } catch (err) { console.error(err); }
                                setRestoringVersionId(null);
                              }}
                              disabled={restoringVersionId === v.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 disabled:bg-slate-100 disabled:text-slate-400 border border-primary-200 rounded-lg transition-all whitespace-nowrap"
                            >
                              <RotateCcw size={12} />
                              {restoringVersionId === v.id ? 'Restauration...' : 'Restaurer'}
                            </button>
                          </div>

                          {/* Field-level diff */}
                          {changes.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {changes.map((c) => (
                                <div key={c.field} className="flex items-start gap-1.5 text-[11px] leading-tight">
                                  <span className="font-semibold text-slate-500 whitespace-nowrap min-w-[80px]">{c.label} :</span>
                                  <span className="text-red-500 line-through break-all">{c.before}</span>
                                  <span className="text-slate-300">→</span>
                                  <span className="text-emerald-600 font-medium break-all">{c.after}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-[10px] text-slate-400 italic">
                              {idx === 0 ? 'Identique à l\'état actuel' : 'Aucune différence détectée'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
              {selectedEvent.isDraft && (
                <button
                  onClick={async () => {
                    // Check if all agents have at least one shift
                    const agentsWithoutShifts = selectedEvent.assignedAgentIds.filter(
                      (agentId) => !selectedEvent.shifts.some((s) => s.agentId === agentId)
                    );
                    if (agentsWithoutShifts.length > 0) {
                      const names = agentsWithoutShifts.map((id) => getAgentName(id)).join(', ');
                      alert(`Impossible de publier : les agents suivants n'ont aucun créneau attribué :\n\n${names}\n\nVeuillez modifier la mission et attribuer au moins un créneau à chaque agent avant de publier.`);
                      return;
                    }
                    if (!confirm('Publier ce brouillon ? Les agents seront notifiés.')) return;
                    setPublishingId(selectedEvent.id);
                    try {
                      const updated = await publishEvent(selectedEvent.id);
                      setSelectedEvent(updated);
                    } catch (err) { console.error(err); }
                    setPublishingId(null);
                  }}
                  disabled={publishingId === selectedEvent.id}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-medium text-sm transition-all"
                >
                  <Send size={16} /> {publishingId === selectedEvent.id ? 'Publication...' : 'Publier'}
                </button>
              )}
              <button
                onClick={() => {
                  setRepeatFrequency('weekly');
                  setRepeatEndDate('');
                  setRepeatSkipWeekends(true);
                  setRepeatMsg(null);
                  setShowRepeatModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded-xl font-medium text-sm transition-all"
              >
                <Repeat size={16} /> Répéter
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

      {/* Event form modal — 2 tabs: Événement / Affectation */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={formMode === 'create' ? 'Nouvel événement' : 'Modifier l\'événement'}
        size="xl"
      >
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
          {[
            { key: 'event' as const, label: 'Événement', icon: Briefcase },
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

        <form onSubmit={(e) => handleSubmit(e, false)}>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              {formError}
            </div>
          )}

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
                    placeholder="Description détaillée"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Client</label>
                  {showNewClientForm ? (
                    <div className="space-y-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Plus size={12} /> Nouveau client
                        </span>
                        <button type="button" onClick={() => { setShowNewClientForm(false); setNewClientForm({ name: '', email: '', phone: '', address: '', siret: '', notes: '' }); }}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white transition-all">
                          <X size={14} />
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
                        <input type="text" value={newClientForm.name}
                          onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="NOM DU CLIENT" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                          <input type="email" value={newClientForm.email}
                            onChange={(e) => setNewClientForm((f) => ({ ...f, email: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="email@client.fr" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
                          <input type="tel" value={newClientForm.phone}
                            onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="+33 6 ..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
                        <input type="text" value={newClientForm.address}
                          onChange={(e) => setNewClientForm((f) => ({ ...f, address: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Adresse du siège" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">SIRET</label>
                          <input type="text" value={newClientForm.siret}
                            onChange={(e) => setNewClientForm((f) => ({ ...f, siret: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="14 chiffres" maxLength={14} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                          <input type="text" value={newClientForm.notes}
                            onChange={(e) => setNewClientForm((f) => ({ ...f, notes: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="Notes..." />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ClientCombobox
                      value={form.client}
                      onChange={(v) => {
                        const matchedClient = dbClients.find((c) => c.name === v);
                        setShowNewClientForm(false);
                        setShowNewSiteForm(false);
                        setNewSiteForm({ name: '', hourlyRate: '', notes: '' });
                        setForm((f) => ({
                          ...f,
                          client: v,
                          clientPhone: matchedClient?.phone || '',
                          site: '',
                        }));
                      }}
                      onCreateNew={(name) => {
                        setShowNewClientForm(true);
                        setNewClientForm({ name, email: '', phone: '', address: '', siret: '', notes: '' });
                        setForm((f) => ({ ...f, client: '', site: '' }));
                      }}
                      existingClients={events.map((e) => e.client).filter(Boolean) as string[]}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Tél. Client</label>
                  <input
                    type="tel"
                    value={showNewClientForm ? newClientForm.phone : form.clientPhone}
                    onChange={(e) => {
                      if (showNewClientForm) {
                        setNewClientForm((f) => ({ ...f, phone: e.target.value }));
                      } else {
                        setForm((f) => ({ ...f, clientPhone: e.target.value }));
                      }
                    }}
                    placeholder="Rempli automatiquement ou saisir"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Site</label>
                  {showNewSiteForm ? (
                    <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Plus size={12} /> Nouveau site
                        </span>
                        <button type="button" onClick={() => { setShowNewSiteForm(false); setNewSiteForm({ name: '', hourlyRate: '', notes: '' }); }}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white transition-all">
                          <X size={14} />
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Nom du site *</label>
                        <input type="text" value={newSiteForm.name}
                          onChange={(e) => setNewSiteForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder="Nom du site" />
                      </div>
                      {form.address && (
                        <p className="text-[11px] text-blue-600 flex items-center gap-1.5 px-1">
                          <MapPin size={11} /> L'adresse de l'événement sera utilisée : <span className="font-semibold truncate">{form.address}</span>
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Tarif HT/h (€)</label>
                          <input type="number" step="0.01" min="0" value={newSiteForm.hourlyRate}
                            onChange={(e) => setNewSiteForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="0.00" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                          <input type="text" value={newSiteForm.notes}
                            onChange={(e) => setNewSiteForm((f) => ({ ...f, notes: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Notes..." />
                        </div>
                      </div>
                    </div>
                  ) : (() => {
                    const selectedClient = showNewClientForm ? null : dbClients.find((c) => c.name === form.client);
                    const sites = selectedClient?.sites || [];
                    if (sites.length > 0) {
                      return (
                        <div className="space-y-2">
                          <select
                            value={form.site}
                            onChange={(e) => {
                              const siteName = e.target.value;
                              if (siteName === '__NEW__') {
                                setShowNewSiteForm(true);
                                setForm((f) => ({ ...f, site: '' }));
                                return;
                              }
                              setForm((f) => ({ ...f, site: siteName }));
                              const site = sites.find((s) => s.name === siteName);
                              if (site) {
                                setForm((f) => ({
                                  ...f,
                                  site: siteName,
                                  address: site.address || f.address,
                                  latitude: site.latitude != null ? String(site.latitude) : f.latitude,
                                  longitude: site.longitude != null ? String(site.longitude) : f.longitude,
                                  geoRadius: site.geoRadius ? String(site.geoRadius) : f.geoRadius,
                                }));
                              }
                            }}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                          >
                            <option value="">Sélectionner un site</option>
                            {sites.map((s) => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                            <option value="__NEW__">＋ Nouveau site...</option>
                          </select>
                        </div>
                      );
                    }
                    // No existing sites — show text input + "create site" button
                    return (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={form.site}
                          onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))}
                          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          placeholder="Nom du site"
                        />
                        {(form.client || showNewClientForm) && (
                          <button type="button" onClick={() => setShowNewSiteForm(true)}
                            className="flex-shrink-0 px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-all flex items-center gap-1">
                            <Plus size={13} /> Site
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Couleur</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                    />
                    <span className="text-sm text-slate-500 font-mono uppercase">{form.color}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date début *</label>
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
                    min={form.startDate}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>

                <LocationPicker
                  address={form.address}
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onUpdate={(fields) => setForm((f) => ({ ...f, ...fields }))}
                />

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Prix HT / heure (€) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={form.hourlyRate}
                      onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${!form.hourlyRate ? 'border-rose-300 bg-rose-50/50' : 'border-slate-300'}`}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {formMode === 'edit' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Statut</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EventStatus }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    >
                      <option value="planifie">Planifié</option>
                      <option value="en_cours">En cours</option>
                      <option value="termine">Terminé</option>
                      <option value="a_reattribuer">À réattribuer</option>
                      <option value="annule">Annulé</option>
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
                      <Users size={16} /> Affecter des agents →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e as any, true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all"
                  >
                    <FileEdit size={16} />
                    {formMode === 'create' ? 'Brouillon' : 'Sauvegarder brouillon'}
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/25 transition-all"
                  >
                    <Send size={16} />
                    {formMode === 'create' ? 'Créer & publier' : 'Enregistrer & publier'}
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
                  <p className="text-sm text-slate-500">Renseignez d'abord les dates de l'événement dans l'onglet "Événement".</p>
                </div>
              ) : (
                <>
                  {/* Info banner */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                    <Calendar size={16} className="text-blue-500 flex-shrink-0" />
                    <div className="text-xs text-blue-700">
                      <span className="font-semibold">Plage :</span> {formatDate(form.startDate)} →  {formatDate(form.endDate)}
                      <span className="ml-3 text-blue-500">({getEventDatesInRange([]).length} jours)</span>
                    </div>
                  </div>

                  {/* Break hours */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Heures de pause (appliquées à tous les créneaux)</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={form.breakHours}
                          onChange={(e) => setForm((f) => ({ ...f, breakHours: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Durée déduite du total prévu par jour (ex : 1h de pause sur un créneau 8h–14h = 5h effectives)</p>
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
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                        >
                          <User size={14} className="text-slate-400" />
                          {agent.firstName} {agent.lastName}
                        </button>
                      ))}
                      {agents.filter((a) => !agentShiftAssignments[a.id]).length === 0 && (
                        <p className="text-xs text-slate-400 italic py-1">Tous les agents actifs sont assignés</p>
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
                                    ? `${shiftCount} créneau${shiftCount > 1 ? 'x' : ''} sur ${dayCount} jour${dayCount > 1 ? 's' : ''}`
                                    : 'Aucun créneau défini'}
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
                                title="Modifier les créneaux"
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
                                      {slots.map((s) => `${s.startTime}→${s.endTime}`).join(', ')}
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
                                <p className="text-xs font-semibold text-slate-600 mb-1.5">Jours à exclure</p>
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
                                        {isSkipped && '✕ '}{name}
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
                                      Tout sélectionner
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
                                          if (next.has(date)) {
                                            next.delete(date);
                                            setPerDateSlots(prev => { const n = { ...prev }; delete n[date]; return n; });
                                          } else {
                                            next.add(date);
                                            setPerDateSlots(prev => ({ ...prev, [date]: agentTemplateSlots.map(s => ({ ...s })) }));
                                          }
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
                                  {agentShiftDates.size} jour{agentShiftDates.size > 1 ? 's' : ''} sélectionné{agentShiftDates.size > 1 ? 's' : ''}
                                </p>
                              </div>

                              {/* Template for bulk apply */}
                              <div className="bg-white/60 rounded-xl border border-slate-200 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-slate-600">Modèle horaire (appliquer en masse)</p>
                                  <button
                                    type="button"
                                    onClick={() => setAgentTemplateSlots((prev) => [...prev, { startTime: '08:00', endTime: '17:00' }])}
                                    className="text-[11px] font-medium text-primary-600 hover:text-primary-700 flex items-center gap-0.5"
                                  >
                                    <Plus size={12} /> Ajouter
                                  </button>
                                </div>
                                <div className="space-y-2 mb-2">
                                  {agentTemplateSlots.map((slot, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <TimeInput24
                                        value={slot.startTime}
                                        onChange={(v) =>
                                          setAgentTemplateSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, startTime: v } : s)))
                                        }
                                      />
                                      <span className="text-slate-300 text-xs">→</span>
                                      <TimeInput24
                                        value={slot.endTime}
                                        onChange={(v) =>
                                          setAgentTemplateSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, endTime: v } : s)))
                                        }
                                      />
                                      {agentTemplateSlots.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => setAgentTemplateSlots((prev) => prev.filter((_, i) => i !== idx))}
                                          className="p-1 text-rose-400 hover:text-rose-600 rounded transition-colors"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={applyTemplateToSelectedDates}
                                  disabled={agentShiftDates.size === 0}
                                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 rounded-lg transition-all"
                                >
                                  <Copy size={12} />
                                  Appliquer ce modèle à {agentShiftDates.size} jour{agentShiftDates.size > 1 ? 's' : ''}
                                </button>
                              </div>

                              {/* Per-date time slot editing */}
                              {agentShiftDates.size > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-600 mb-2">Horaires par jour</p>
                                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                                    {Array.from(agentShiftDates).sort().map((date) => {
                                      const dateObj = new Date(date + 'T12:00:00');
                                      const dayName = WEEKDAY_NAMES[dateObj.getDay()];
                                      const dd = dateObj.getDate().toString().padStart(2, '0');
                                      const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                                      const dateSlots = perDateSlots[date] || [];
                                      return (
                                        <div key={date} className="bg-white rounded-lg border border-slate-200 p-2.5">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-primary-700">{dayName} {dd}/{mm}</span>
                                            <button
                                              type="button"
                                              onClick={() => setPerDateSlots(prev => ({
                                                ...prev,
                                                [date]: [...(prev[date] || []), { startTime: '08:00', endTime: '17:00' }]
                                              }))}
                                              className="text-[10px] font-medium text-primary-600 hover:text-primary-700 flex items-center gap-0.5"
                                            >
                                              <Plus size={10} /> Créneau
                                            </button>
                                          </div>
                                          {dateSlots.length === 0 && (
                                            <p className="text-[10px] text-slate-400 italic">Aucun créneau — cliquez + pour ajouter</p>
                                          )}
                                          <div className="space-y-1.5">
                                            {dateSlots.map((slot, slotIdx) => (
                                              <div key={slotIdx} className="flex items-center gap-2">
                                                <TimeInput24
                                                  value={slot.startTime}
                                                  onChange={(v) => setPerDateSlots(prev => ({
                                                    ...prev,
                                                    [date]: (prev[date] || []).map((s, i) => i === slotIdx ? { ...s, startTime: v } : s)
                                                  }))}
                                                />
                                                <span className="text-slate-400 text-xs">→</span>
                                                <TimeInput24
                                                  value={slot.endTime}
                                                  onChange={(v) => setPerDateSlots(prev => ({
                                                    ...prev,
                                                    [date]: (prev[date] || []).map((s, i) => i === slotIdx ? { ...s, endTime: v } : s)
                                                  }))}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => setPerDateSlots(prev => ({
                                                    ...prev,
                                                    [date]: (prev[date] || []).filter((_, i) => i !== slotIdx)
                                                  }))}
                                                  className="p-0.5 text-rose-400 hover:text-rose-600 rounded transition-colors"
                                                >
                                                  <X size={12} />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Confirm button */}
                              <button
                                type="button"
                                onClick={() => applyAgentShifts(agentId)}
                                disabled={Object.values(perDateSlots).every(slots => slots.length === 0)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-all"
                              >
                                <Check size={16} />
                                Confirmer les créneaux
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {Object.keys(agentShiftAssignments).length === 0 && (
                      <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
                        <Users size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400">Aucun agent affecté. Ajoutez un agent ci-dessus.</p>
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
                  ← Événement
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e as any, true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all"
                  >
                    <FileEdit size={16} />
                    {formMode === 'create' ? 'Brouillon' : 'Sauvegarder brouillon'}
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/25 transition-all"
                  >
                    <Send size={16} />
                    {formMode === 'create' ? 'Créer & publier' : 'Enregistrer & publier'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ── Conflict Confirmation Popup ── */}
      {conflictPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConflictPopup(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-fadeIn">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Conflit de planning détecté</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">{conflictPopup.agentName}</span> est déjà affecté(e) à d’autres missions aux mêmes dates.
                </p>
              </div>
              <button onClick={() => setConflictPopup(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg ml-auto">
                <X size={16} />
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 max-h-60 overflow-y-auto space-y-2">
              {conflictPopup.conflicts.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                    <Calendar size={13} className="flex-shrink-0 text-amber-600" />
                    <span>{formatDate(c.date)}</span>
                  </div>
                  <span className="text-amber-400">•</span>
                  <div className="flex items-center gap-1.5 text-amber-700 truncate">
                    <Briefcase size={13} className="flex-shrink-0 text-amber-500" />
                    <span className="truncate font-medium">{c.eventTitle}</span>
                  </div>
                  {c.startTime && c.endTime && (
                    <>
                      <span className="text-amber-400">•</span>
                      <span className="flex items-center gap-1 text-amber-700 text-xs font-semibold bg-amber-100/60 px-2 py-0.5 rounded-md flex-shrink-0">
                        <Clock size={12} className="text-amber-500" />
                        {c.startTime} → {c.endTime}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setConflictPopup(null)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Annuler
              </button>
              <button type="button" onClick={() => { confirmAddAgentToEvent(conflictPopup.agentId); startEditingAgent(conflictPopup.agentId); }}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm">
                <AlertTriangle size={14} /> Affecter quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Dialog */}
      <Modal
        isOpen={showPdfDialog}
        onClose={() => setShowPdfDialog(false)}
        title="Exporter le planning en PDF"
        size="md"
      >
        <div className="space-y-5">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700">
            <FileDown size={14} className="inline mr-1.5 -mt-0.5" />
            Sélectionnez la période et les filtres optionnels pour générer un PDF du planning.
          </div>

          {/* Period Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Période</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPdfPeriod('day')}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                  pdfPeriod === 'day'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Calendar size={16} className="inline mr-1.5 -mt-0.5" />
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => setPdfPeriod('week')}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                  pdfPeriod === 'week'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <CalendarDays size={16} className="inline mr-1.5 -mt-0.5" />
                Semaine
              </button>
              <button
                type="button"
                onClick={() => setPdfPeriod('month')}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                  pdfPeriod === 'month'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Grid3X3 size={16} className="inline mr-1.5 -mt-0.5" />
                Mois
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Filtres optionnels</p>

            {/* Agent Filter */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Agent</label>
              <select
                value={pdfFilterAgent}
                onChange={(e) => setPdfFilterAgent(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
              >
                <option value="">Tous les agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.firstName} {agent.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Client Filter */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Client</label>
              <select
                value={pdfFilterClient}
                onChange={(e) => setPdfFilterClient(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
              >
                <option value="">Tous les clients</option>
                {uniqueClients.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>
            </div>

            {/* Site Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Site</label>
              <select
                value={pdfFilterSite}
                onChange={(e) => setPdfFilterSite(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
              >
                <option value="">Tous les sites</option>
                {uniqueSites.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowPdfDialog(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
            >
              <FileDown size={16} />
              Générer le PDF
            </button>
          </div>
        </div>
      </Modal>

      {/* Duplicate Week Modal */}
      <Modal
        isOpen={showDuplicateWeek}
        onClose={() => setShowDuplicateWeek(false)}
        title="Dupliquer une semaine"
        size="md"
      >
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            <Repeat size={14} className="inline mr-1.5 -mt-0.5" />
            Tous les événements de la semaine source seront dupliqués vers la semaine cible, avec les mêmes agents, horaires et paramètres.
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Semaine source (choisir un jour de la semaine)</label>
            <input
              type="date"
              value={dupWeekSource}
              onChange={(e) => setDupWeekSource(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            {dupWeekSource && (
              <p className="text-xs text-slate-500 mt-1">
                Semaine du lundi {getMondayOf(dupWeekSource)} au dimanche {(() => { const d = new Date(getMondayOf(dupWeekSource)); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })()}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Semaine cible (choisir un jour de la semaine)</label>
            <input
              type="date"
              value={dupWeekTarget}
              onChange={(e) => setDupWeekTarget(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            {dupWeekTarget && (
              <p className="text-xs text-slate-500 mt-1">
                Semaine du lundi {getMondayOf(dupWeekTarget)} au dimanche {(() => { const d = new Date(getMondayOf(dupWeekTarget)); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })()}
              </p>
            )}
          </div>

          {dupWeekMsg && (
            <p className={`text-sm font-medium ${dupWeekMsg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-600'}`}>{dupWeekMsg}</p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowDuplicateWeek(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDuplicateWeek}
              disabled={!dupWeekSource || !dupWeekTarget || dupWeekLoading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Repeat size={16} />
              {dupWeekLoading ? 'Duplication...' : 'Dupliquer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Repeat Event Modal */}
      <Modal
        isOpen={showRepeatModal}
        onClose={() => setShowRepeatModal(false)}
        title="Répéter l'événement"
        size="md"
      >
        {selectedEvent && (
          <div className="space-y-5">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700">
              <Repeat size={14} className="inline mr-1.5 -mt-0.5" />
              L'événement <strong>« {selectedEvent.title} »</strong> sera dupliqué selon la fréquence choisie, avec les mêmes agents et horaires.
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fréquence</label>
              <div className="flex gap-2">
                {[
                  { value: 'weekly' as const, label: 'Chaque semaine' },
                  { value: 'daily' as const, label: 'Chaque jour' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRepeatFrequency(value)}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all ${
                      repeatFrequency === value
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {repeatFrequency === 'daily' && (
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repeatSkipWeekends}
                  onChange={(e) => setRepeatSkipWeekends(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                Exclure les week-ends (samedi & dimanche)
              </label>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Répéter jusqu'au</label>
              <input
                type="date"
                value={repeatEndDate}
                onChange={(e) => setRepeatEndDate(e.target.value)}
                min={selectedEvent.endDate}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            {repeatEndDate && selectedEvent && (
              <p className="text-xs text-slate-500">
                {(() => {
                  const srcStart = new Date(selectedEvent.startDate);
                  const end = new Date(repeatEndDate);
                  const step = repeatFrequency === 'weekly' ? 7 : 1;
                  let count = 0;
                  let offset = step;
                  while (count < 200) {
                    const d = new Date(srcStart);
                    d.setDate(d.getDate() + offset);
                    if (d > end) break;
                    if (repeatSkipWeekends && repeatFrequency === 'daily' && (d.getDay() === 0 || d.getDay() === 6)) {
                      offset += 1;
                      continue;
                    }
                    count++;
                    offset += step;
                  }
                  return `≈ ${count} événement(s) seront créés`;
                })()}
              </p>
            )}

            {repeatMsg && (
              <p className={`text-sm font-medium ${repeatMsg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-600'}`}>{repeatMsg}</p>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowRepeatModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRepeatEvent}
                disabled={!repeatEndDate || repeatLoading}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Repeat size={16} />
                {repeatLoading ? 'Création...' : 'Créer les répétitions'}
              </button>
            </div>
          </div>
        )}
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
        Conflit de planning détecté !
      </div>
      <ul className="space-y-1">
        {allConflicts.map((c) => (
          <li key={c.id} className="text-sm text-amber-600">
            ⬢ {c.title} ({formatDate(c.startDate)} →  {formatDate(c.endDate)})
          </li>
        ))}
      </ul>
    </div>
  );
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
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
                <span className={`text-xs ${isCurrent ? 'text-white/60' : 'text-slate-300'}`}>·</span>
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
  'Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Fév',
  'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août',
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
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
            date: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`,
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

  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

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
            Sept {year - 1} → Août {year}
          </h2>
          <p className="text-white/70 text-xs font-medium mt-0.5">Activité annuelle</p>
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
                          {evt.shifts.map((s) => `${s.startTime}→${s.endTime}`).join(' / ')}
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

