import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/helpers';
import type { PlanningEvent } from '../../types';
import {
  MapPin,
  User,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  UserPlus,
  Calendar,
  Clock,
  Edit3,
  Briefcase,
  ListFilter,
  Search,
  X,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';

/* ── helpers to generate date range ── */
function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (d <= last) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

type ShiftRow = { date: string; startTime: string; endTime: string };

export default function Gestion() {
  const { events, fetchEvents, updateEvent } = useEventStore();
  const { users, fetchUsers } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Filters ──
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');

  // ── Assignment modal ──
  const [assignModalEvent, setAssignModalEvent] = useState<PlanningEvent | null>(null);
  const [assignAgentIds, setAssignAgentIds] = useState<string[]>([]);
  const [agentShifts, setAgentShifts] = useState<Record<string, ShiftRow[]>>({});
  const [addAgentDropdown, setAddAgentDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Conflict confirmation ──
  type ConflictInfo = {
    agentId: string;
    agentName: string;
    conflicts: { eventTitle: string; eventId: string; date: string; startTime: string; endTime: string }[];
  };
  const [conflictPopup, setConflictPopup] = useState<ConflictInfo | null>(null);

  const agents = users.filter((u) => u.role === 'agent' && u.isActive);

  // ── Filtered events ──
  const filteredEvents = useMemo(() => {
    let result = [...events];
    if (dateFrom) result = result.filter(e => e.endDate >= dateFrom);
    if (dateTo) result = result.filter(e => e.startDate <= dateTo);
    if (selectedEventId) result = result.filter(e => e.id === selectedEventId);
    if (filterUnassigned) {
      result = result.filter(e => {
        const hasAssignment = e.shifts && e.shifts.some(s => s.agentId);
        return !hasAssignment || e.assignedAgentIds.length === 0;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.client || '').toLowerCase().includes(q) ||
        e.address.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    return result;
  }, [events, dateFrom, dateTo, filterUnassigned, search, selectedEventId]);

  // ── Helpers ──
  const getAgentName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u ? `${u.firstName} ${u.lastName}` : 'Inconnu';
  };

  const getResponseStats = (evt: PlanningEvent) => {
    const responses = evt.agentResponses || {};
    const agentIds = evt.assignedAgentIds || [];
    let accepted = 0, refused = 0, pending = 0;
    for (const aid of agentIds) {
      const r = responses[aid] || 'pending';
      if (r === 'accepted') accepted++;
      else if (r === 'refused') refused++;
      else pending++;
    }
    return { accepted, refused, pending, total: agentIds.length };
  };

  const getShiftStats = (evt: PlanningEvent) => {
    const shifts = evt.shifts || [];
    const withoutAgent = shifts.filter(s => !s.agentId);
    const uniqueDates = new Set(shifts.map(s => s.date)).size;
    return { total: shifts.length, unassigned: withoutAgent.length, days: uniqueDates };
  };

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setFilterUnassigned(false); setSearch(''); setSelectedEventId('');
  };
  const hasFilters = dateFrom || dateTo || filterUnassigned || search || selectedEventId;

  // ── Conflict detection ──
  const detectConflicts = (agentId: string, eventId: string, shiftDates: string[]) => {
    const conflicts: ConflictInfo['conflicts'] = [];
    for (const evt of events) {
      if (evt.id === eventId) continue; // skip the current event
      // Check if agent is assigned to this other event
      const agentAssigned = evt.assignedAgentIds.includes(agentId);
      const agentSpecificShifts = (evt.shifts || []).filter(s => s.agentId === agentId);
      if (!agentAssigned && agentSpecificShifts.length === 0) continue;

      // Collect shifts that apply to this agent (agent-specific OR shared/unassigned)
      const relevantShifts = agentSpecificShifts.length > 0
        ? agentSpecificShifts
        : (evt.shifts || []).filter(s => !s.agentId); // shared shifts

      if (relevantShifts.length > 0) {
        // Match by date
        for (const shift of relevantShifts) {
          if (shiftDates.includes(shift.date)) {
            conflicts.push({
              eventTitle: evt.title,
              eventId: evt.id,
              date: shift.date,
              startTime: shift.startTime,
              endTime: shift.endTime,
            });
          }
        }
      } else if (agentAssigned) {
        // Agent assigned but no shifts at all — check event date range overlap
        const evtDates = generateDateRange(evt.startDate, evt.endDate);
        for (const d of shiftDates) {
          if (evtDates.includes(d)) {
            conflicts.push({
              eventTitle: evt.title,
              eventId: evt.id,
              date: d,
              startTime: '',
              endTime: '',
            });
          }
        }
      }
    }
    return conflicts;
  };

  // ── Open assignment modal ──
  const openAssignModal = (evt: PlanningEvent) => {
    setAssignModalEvent(evt);
    setAssignAgentIds([...evt.assignedAgentIds]);
    // Build per-agent shifts from existing shifts
    const map: Record<string, ShiftRow[]> = {};
    for (const shift of (evt.shifts || [])) {
      const aid = shift.agentId || '__unassigned__';
      if (!map[aid]) map[aid] = [];
      map[aid].push({ date: shift.date, startTime: shift.startTime, endTime: shift.endTime });
    }
    // If there are unassigned shifts, distribute to each assigned agent who has none
    if (map['__unassigned__'] && evt.assignedAgentIds.length > 0) {
      for (const agentId of evt.assignedAgentIds) {
        if (!map[agentId]) {
          map[agentId] = map['__unassigned__'].map(s => ({ ...s }));
        }
      }
      delete map['__unassigned__'];
    }
    // Ensure every assigned agent has an entry
    for (const agentId of evt.assignedAgentIds) {
      if (!map[agentId]) map[agentId] = [];
    }
    setAgentShifts(map);
    setAddAgentDropdown(false);
    setSaving(false);
  };

  const closeAssignModal = () => {
    setAssignModalEvent(null);
    setAssignAgentIds([]);
    setAgentShifts({});
  };

  // ── Add agent (with conflict check) ──
  const addAgent = (agentId: string) => {
    if (assignAgentIds.includes(agentId)) return;
    if (!assignModalEvent) return;

    const dates = generateDateRange(assignModalEvent.startDate, assignModalEvent.endDate);
    const conflicts = detectConflicts(agentId, assignModalEvent.id, dates);

    if (conflicts.length > 0) {
      // Show conflict popup — agent won't be added until confirmed
      setConflictPopup({
        agentId,
        agentName: getAgentName(agentId),
        conflicts,
      });
      setAddAgentDropdown(false);
      return;
    }

    // No conflict — add directly
    confirmAddAgent(agentId);
  };

  const confirmAddAgent = (agentId: string) => {
    if (!assignModalEvent) return;
    setAssignAgentIds(prev => [...prev, agentId]);
    const dates = generateDateRange(assignModalEvent.startDate, assignModalEvent.endDate);
    setAgentShifts(prev => ({
      ...prev,
      [agentId]: dates.map(d => ({ date: d, startTime: '08:00', endTime: '17:00' })),
    }));
    setAddAgentDropdown(false);
    setConflictPopup(null);
  };

  const removeAgent = (agentId: string) => {
    setAssignAgentIds(prev => prev.filter(id => id !== agentId));
    setAgentShifts(prev => {
      const copy = { ...prev };
      delete copy[agentId];
      return copy;
    });
  };

  // ── Shift management per agent ──
  const addShiftRow = (agentId: string) => {
    const defaultDate = assignModalEvent?.startDate || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
    setAgentShifts(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), { date: defaultDate, startTime: '08:00', endTime: '17:00' }],
    }));
  };

  const updateShiftRow = (agentId: string, idx: number, field: keyof ShiftRow, value: string) => {
    setAgentShifts(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  const removeShiftRow = (agentId: string, idx: number) => {
    setAgentShifts(prev => ({
      ...prev,
      [agentId]: (prev[agentId] || []).filter((_, i) => i !== idx),
    }));
  };

  // ── Save ──
  const saveAssignment = async () => {
    if (!assignModalEvent) return;
    setSaving(true);
    try {
      // Build shifts array
      const shifts: { date: string; startTime: string; endTime: string; agentId?: string }[] = [];
      for (const agentId of assignAgentIds) {
        const rows = agentShifts[agentId] || [];
        for (const row of rows) {
          shifts.push({ date: row.date, startTime: row.startTime, endTime: row.endTime, agentId });
        }
      }
      // Also keep unassigned shifts from agents not in the list
      const unassigned = agentShifts['__unassigned__'] || [];
      for (const row of unassigned) {
        shifts.push({ date: row.date, startTime: row.startTime, endTime: row.endTime });
      }

      await updateEvent(assignModalEvent.id, {
        assignedAgentIds: assignAgentIds,
        shifts,
      });
      closeAssignModal();
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
    } finally {
      setSaving(false);
    }
  };

  // Available dates for the current event
  const eventDates = useMemo(() => {
    if (!assignModalEvent) return [];
    return generateDateRange(assignModalEvent.startDate, assignModalEvent.endDate);
  }, [assignModalEvent]);

  const availableAgents = agents.filter(a => !assignAgentIds.includes(a.id));

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Gestion des affectations" subtitle="Créneaux et assignation des agents" />

      {/* Filters bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <ListFilter size={16} className="text-primary-500" />
          <h3 className="text-sm font-bold text-slate-900">Filtres</h3>
          <span className="text-xs text-slate-400 ml-auto">
            {filteredEvents.length} événement{filteredEvents.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher titre, client, adresse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div className="min-w-[180px]">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white text-slate-700"
              title="Filtrer par événement"
            >
              <option value="">Tous les événements</option>
              {events.slice().sort((a, b) => a.title.localeCompare(b.title)).map(evt => (
                <option key={evt.id} value={evt.id}>{evt.title}</option>
              ))}
            </select>
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" title="Date début" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" title="Date fin" />
          <button type="button" onClick={() => setFilterUnassigned(!filterUnassigned)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${filterUnassigned ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <UserMinus size={14} /> Sans affectation
          </button>
          {hasFilters && (
            <button type="button" onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
              <X size={14} /> Effacer
            </button>
          )}
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-3">
        {filteredEvents.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-10 text-center">
            <ListFilter size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Aucun événement trouvé avec ces filtres.</p>
          </div>
        )}

        {filteredEvents.map((evt) => {
          const responseStats = getResponseStats(evt);
          const shiftStats = getShiftStats(evt);
          const hasNoAssignment = !evt.shifts?.some(s => s.agentId) || evt.assignedAgentIds.length === 0;

          return (
            <div key={evt.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-card-hover transition-all overflow-hidden">
              <div className="flex items-stretch">
                <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: evt.color }} />
                <div className="flex-1 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{evt.title}</h3>
                        <StatusBadge status={evt.status} />
                        {hasNoAssignment && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Sans affectation</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                        {evt.client && <span className="flex items-center gap-1"><Briefcase size={11} /> {evt.client}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {formatDate(evt.startDate)}{evt.startDate !== evt.endDate ? ` → ${formatDate(evt.endDate)}` : ''}
                        </span>
                        {evt.address && <span className="flex items-center gap-1 truncate max-w-[200px]"><MapPin size={11} /> {evt.address.split(',')[0]}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => navigate('/admin/planning', { state: { viewEvent: evt.id } })}
                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Voir détail">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => openAssignModal(evt)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl transition-colors"
                        title="Gérer l'affectation">
                        <Users size={13} /> Affecter
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {responseStats.total > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl text-xs">
                        <span className="font-semibold text-slate-700">{responseStats.total} agent{responseStats.total > 1 ? 's' : ''}</span>
                        <span className="text-slate-300">|</span>
                        {responseStats.accepted > 0 && <span className="flex items-center gap-1 text-emerald-600 font-medium"><UserCheck size={12} /> {responseStats.accepted}</span>}
                        {responseStats.pending > 0 && <span className="flex items-center gap-1 text-amber-600 font-medium"><Clock size={12} /> {responseStats.pending}</span>}
                        {responseStats.refused > 0 && <span className="flex items-center gap-1 text-rose-600 font-medium"><UserX size={12} /> {responseStats.refused}</span>}
                      </div>
                    )}
                    {shiftStats.total > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl text-xs text-slate-600">
                        <Clock size={12} className="text-slate-400" />
                        {shiftStats.total} créneau{shiftStats.total > 1 ? 'x' : ''} / {shiftStats.days} jour{shiftStats.days > 1 ? 's' : ''}
                        {shiftStats.unassigned > 0 && (
                          <span className="text-amber-600 font-medium ml-1">({shiftStats.unassigned} non affecté{shiftStats.unassigned > 1 ? 's' : ''})</span>
                        )}
                      </div>
                    )}
                    {responseStats.total > 0 && responseStats.total <= 5 && (
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-xl text-xs text-slate-500">
                        <User size={12} className="text-slate-400" />
                        {evt.assignedAgentIds.map(id => getAgentName(id)).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Assignment Modal ── */}
      <Modal
        isOpen={!!assignModalEvent}
        onClose={closeAssignModal}
        title={`Affectation — ${assignModalEvent?.title || ''}`}
        size="xl"
      >
        {assignModalEvent && (
          <div className="space-y-5">
            {/* Event summary */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pb-3 border-b border-slate-100">
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(assignModalEvent.startDate)}{assignModalEvent.startDate !== assignModalEvent.endDate ? ` → ${formatDate(assignModalEvent.endDate)}` : ''}</span>
              {assignModalEvent.client && <span className="flex items-center gap-1"><Briefcase size={12} /> {assignModalEvent.client}</span>}
              {assignModalEvent.address && <span className="flex items-center gap-1"><MapPin size={12} /> {assignModalEvent.address.split(',')[0]}</span>}
            </div>

            {/* Add agent */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users size={15} className="text-primary-500" />
                Agents affectés ({assignAgentIds.length})
              </h3>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAddAgentDropdown(!addAgentDropdown)}
                  disabled={availableAgents.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus size={13} /> Ajouter un agent
                  <ChevronDown size={12} />
                </button>
                {addAgentDropdown && availableAgents.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 w-64 max-h-48 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg z-20">
                    {availableAgents.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => addAgent(a.id)}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-center gap-2"
                      >
                        <User size={13} className="text-slate-400" />
                        {a.firstName} {a.lastName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Agent list with shifts */}
            {assignAgentIds.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                <UserMinus size={28} className="mx-auto mb-2 text-slate-300" />
                Aucun agent affecté. Cliquez sur "Ajouter un agent" pour commencer.
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {assignAgentIds.map(agentId => {
                  const shifts = agentShifts[agentId] || [];
                  const response = assignModalEvent.agentResponses?.[agentId];
                  return (
                    <div key={agentId} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      {/* Agent header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
                            <User size={13} className="text-primary-600" />
                          </div>
                          <span className="text-sm font-semibold text-slate-800">{getAgentName(agentId)}</span>
                          {response && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              response === 'accepted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : response === 'refused' ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}>
                              {response === 'accepted' ? 'Accepté' : response === 'refused' ? 'Refusé' : 'En attente'}
                            </span>
                          )}
                        </div>
                        <button type="button" onClick={() => removeAgent(agentId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Retirer l'agent">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Shifts */}
                      <div className="p-3 space-y-2">
                        {shifts.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-2">Aucun créneau — ajoutez-en un ci-dessous</p>
                        )}
                        {shifts.map((shift, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-2">
                            <select
                              value={shift.date}
                              onChange={(e) => updateShiftRow(agentId, idx, 'date', e.target.value)}
                              className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-primary-500 outline-none"
                            >
                              {eventDates.map(d => (
                                <option key={d} value={d}>{formatDate(d)}</option>
                              ))}
                            </select>
                            <input type="time" value={shift.startTime}
                              onChange={(e) => updateShiftRow(agentId, idx, 'startTime', e.target.value)}
                              className="w-24 px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 outline-none" />
                            <span className="text-xs text-slate-400">→</span>
                            <input type="time" value={shift.endTime}
                              onChange={(e) => updateShiftRow(agentId, idx, 'endTime', e.target.value)}
                              className="w-24 px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 outline-none" />
                            <button type="button" onClick={() => removeShiftRow(agentId, idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addShiftRow(agentId)}
                          className="flex items-center gap-1.5 w-full justify-center py-2 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-dashed border-primary-200">
                          <Plus size={13} /> Ajouter un créneau
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary + Save */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {assignAgentIds.length} agent{assignAgentIds.length > 1 ? 's' : ''} ·{' '}
                {Object.values(agentShifts).reduce((sum, rows) => sum + rows.length, 0)} créneau{Object.values(agentShifts).reduce((sum, rows) => sum + rows.length, 0) > 1 ? 'x' : ''}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeAssignModal}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  Annuler
                </button>
                <button type="button" onClick={saveAssignment} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm disabled:opacity-60">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Conflict Confirmation Popup ── */}
      {conflictPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConflictPopup(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Conflit de planning détecté</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">{conflictPopup.agentName}</span> est déjà affecté(e) à d'autres missions aux mêmes dates.
                </p>
              </div>
              <button onClick={() => setConflictPopup(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg ml-auto">
                <X size={16} />
              </button>
            </div>

            {/* Conflict details */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 max-h-60 overflow-y-auto space-y-2">
              {conflictPopup.conflicts.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-amber-800 font-medium min-w-0">
                    <Calendar size={13} className="flex-shrink-0 text-amber-600" />
                    <span>{formatDate(c.date)}</span>
                  </div>
                  <span className="text-amber-400">•</span>
                  <div className="flex items-center gap-1.5 text-amber-700 min-w-0 truncate">
                    <Briefcase size={13} className="flex-shrink-0 text-amber-500" />
                    <span className="truncate font-medium">{c.eventTitle}</span>
                  </div>
                  {c.startTime && c.endTime && (
                    <>
                      <span className="text-amber-400">•</span>
                      <span className="flex items-center gap-1 text-amber-700 text-xs font-semibold flex-shrink-0 bg-amber-100/60 px-2 py-0.5 rounded-md">
                        <Clock size={12} className="text-amber-500" />
                        {c.startTime} → {c.endTime}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConflictPopup(null)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => confirmAddAgent(conflictPopup.agentId)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm"
              >
                <AlertTriangle size={14} />
                Affecter quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
