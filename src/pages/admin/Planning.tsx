import { useState, useMemo, useRef } from 'react';
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
import { generateId } from '../../utils/helpers';
import type { PlanningEvent, EventStatus, EventShift } from '../../types';
import {
  Plus,
  MapPin,
  User,
  Calendar,
  Clock,
  Trash2,
  Edit3,
  AlertTriangle,
  History,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Briefcase,
} from 'lucide-react';

const statusColors: Record<EventStatus, string> = {
  planifie: '#6366F1',
  en_cours: '#F59E0B',
  termine: '#10B981',
  a_reattribuer: '#EF4444',
  annule: '#94A3B8',
};

export default function Planning() {
  const { events, addEvent, updateEvent, deleteEvent } = useEventStore();
  const { users } = useAuthStore();

  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PlanningEvent | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [showYearView, setShowYearView] = useState(false);
  const [yearViewYear, setYearViewYear] = useState(new Date().getFullYear());
  const calendarRef = useRef<FullCalendar>(null);

  const agents = users.filter((u) => u.role === 'agent' && u.isActive);

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    client: '',
    startDate: '',
    endDate: '',
    address: '',
    latitude: '',
    longitude: '',
    geoRadius: '200',
    assignedAgentId: '',
    status: 'planifie' as EventStatus,
  });

  const [formShifts, setFormShifts] = useState<EventShift[]>([]);

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
            backgroundColor: statusColors[evt.status],
            borderColor: statusColors[evt.status],
          });
        }
      } else {
        result.push({
          id: evt.id,
          title: evt.title,
          start: evt.startDate,
          end: evt.endDate,
          allDay: true,
          backgroundColor: statusColors[evt.status],
          borderColor: statusColors[evt.status],
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
      startDate: '',
      endDate: '',
      address: '',
      latitude: '',
      longitude: '',
      geoRadius: '200',
      assignedAgentId: '',
      status: 'planifie',
    });
    setFormShifts([]);
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
      startDate: selectedEvent.startDate,
      endDate: selectedEvent.endDate,
      address: selectedEvent.address,
      latitude: selectedEvent.latitude?.toString() || '',
      longitude: selectedEvent.longitude?.toString() || '',
      geoRadius: selectedEvent.geoRadius?.toString() || '200',
      assignedAgentId: selectedEvent.assignedAgentId,
      status: selectedEvent.status,
    });
    setFormShifts(selectedEvent.shifts || []);
    setFormMode('edit');
    setShowDetail(false);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const eventData = {
      title: form.title,
      description: form.description,
      client: form.client || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      shifts: formShifts,
      address: form.address,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      geoRadius: form.geoRadius ? parseInt(form.geoRadius) : 200,
      assignedAgentId: form.assignedAgentId,
      status: form.status,
    };

    if (formMode === 'create') {
      const newEvent: PlanningEvent = {
        ...eventData,
        id: generateId('evt'),
        agentResponse: 'pending',
        history: [
          {
            action: 'Création',
            userId: 'admin-1',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addEvent(newEvent);
    } else if (selectedEvent) {
      updateEvent(selectedEvent.id, {
        ...eventData,
        history: [
          ...selectedEvent.history,
          {
            action: 'Modification',
            userId: 'admin-1',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }

    setShowForm(false);
    resetForm();
    setSelectedEvent(null);
  };

  const handleDelete = () => {
    if (selectedEvent && confirm('Supprimer cet événement ?')) {
      deleteEvent(selectedEvent.id);
      setShowDetail(false);
      setSelectedEvent(null);
    }
  };

  const handleEventDrop = (info: { event: { id: string; startStr: string; endStr: string } }) => {
    const evtId = info.event.id.includes('__') ? info.event.id.split('__')[0] : info.event.id;
    const startDate = info.event.startStr.slice(0, 10);
    const endDate = info.event.endStr ? info.event.endStr.slice(0, 10) : startDate;
    updateEvent(evtId, { startDate, endDate });
  };

  const getAgentName = (id: string) => {
    const agent = users.find((u) => u.id === id);
    return agent ? `${agent.firstName} ${agent.lastName}` : 'Non assigné';
  };

  // Shift management helpers
  const addShift = () => {
    const date = form.startDate || new Date().toISOString().slice(0, 10);
    setFormShifts((s) => [
      ...s,
      { id: generateId('sh'), date, startTime: '08:00', endTime: '17:00' },
    ]);
  };

  const updateShift = (index: number, field: keyof EventShift, value: string) => {
    setFormShifts((s) =>
      s.map((sh, i) => (i === index ? { ...sh, [field]: value } : sh)),
    );
  };

  const removeShift = (index: number) => {
    setFormShifts((s) => s.filter((_, i) => i !== index));
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
          <p className="text-slate-500 mt-1">Gestion des événements et interventions</p>
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
          Nouvel événement
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

      {/* Year view toggle */}
      {showYearView ? (
        <YearOverview
          year={yearViewYear}
          events={events}
          onSelectMonth={(month) => {
            setShowYearView(false);
            setTimeout(() => {
              const api = calendarRef.current?.getApi();
              if (api) {
                api.gotoDate(new Date(yearViewYear, month, 1));
                api.changeView('dayGridMonth');
              }
            }, 0);
          }}
          onYearChange={setYearViewYear}
          onClose={() => setShowYearView(false)}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays size={16} className="text-primary-500" />
              <span className="font-medium">{events.length} événement{events.length > 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => setShowYearView(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all hover:shadow-sm"
            >
              <Grid3X3 size={15} />
              Vue Année
            </button>
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
                return (
                  <div className="fc-event-inner">
                    <span className="fc-event-dot" />
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
        title="Détail de l'événement"
        size="lg"
      >
        {selectedEvent && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedEvent.title}</h3>
                <p className="text-slate-500 mt-1">{selectedEvent.description}</p>
              </div>
              <StatusBadge status={selectedEvent.status} size="md" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <User size={18} className="text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Agent assigné</p>
                  <p className="text-sm font-medium text-slate-900">
                    {getAgentName(selectedEvent.assignedAgentId)}
                  </p>
                </div>
                <div className="ml-auto">
                  <StatusBadge status={selectedEvent.agentResponse || 'pending'} />
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
                  <p className="text-xs text-slate-400">Période</p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(selectedEvent.startDate)} → {formatDate(selectedEvent.endDate)}
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
                            {sh.startTime} → {sh.endTime}
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
                      <span className="text-slate-400">—</span>
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

      {/* Event form modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={formMode === 'create' ? 'Nouvel événement' : 'Modifier l\'événement'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description *
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                placeholder="Description détaillée de l'intervention"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Client / Projet
              </label>
              <input
                type="text"
                value={form.client}
                onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Nom du client"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Agent assigné *
              </label>
              <select
                value={form.assignedAgentId}
                onChange={(e) => setForm((f) => ({ ...f, assignedAgentId: e.target.value }))}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="">Sélectionner un agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.firstName} {agent.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Date début *
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Date fin *
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse *</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Adresse complète du lieu d'intervention"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="48.8566"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="2.3522"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Rayon GPS (mètres)
              </label>
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as EventStatus }))
                  }
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

          {/* Shifts / Horaires */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Clock size={16} /> Horaires / Créneaux
              </h4>
              <button
                type="button"
                onClick={addShift}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <Plus size={14} />
                Ajouter un créneau
              </button>
            </div>

            {formShifts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-3">
                Aucun créneau horaire défini. Cliquez sur "Ajouter un créneau" pour définir les heures d'entrée et de sortie.
              </p>
            )}

            <div className="space-y-3">
              {formShifts.map((shift, idx) => (
                <div
                  key={shift.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                >
                  <input
                    type="date"
                    value={shift.date}
                    min={form.startDate}
                    max={form.endDate}
                    onChange={(e) => updateShift(idx, 'date', e.target.value)}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Entrée</label>
                    <input
                      type="time"
                      value={shift.startTime}
                      onChange={(e) => updateShift(idx, 'startTime', e.target.value)}
                      className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Sortie</label>
                    <input
                      type="time"
                      value={shift.endTime}
                      onChange={(e) => updateShift(idx, 'endTime', e.target.value)}
                      className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeShift(idx)}
                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-auto"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Conflict warning */}
          {form.assignedAgentId && form.startDate && form.endDate && (
            <ConflictWarning
              agentId={form.assignedAgentId}
              start={form.startDate}
              end={form.endDate}
              excludeId={selectedEvent?.id}
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/25 transition-all"
            >
              {formMode === 'create' ? 'Créer' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ConflictWarning({
  agentId,
  start,
  end,
  excludeId,
}: {
  agentId: string;
  start: string;
  end: string;
  excludeId?: string;
}) {
  const { getConflicts } = useEventStore();
  const conflicts = getConflicts(agentId, start, end, excludeId);

  if (conflicts.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
        <AlertTriangle size={16} />
        Conflit de planning détecté !
      </div>
      <ul className="space-y-1">
        {conflicts.map((c) => (
          <li key={c.id} className="text-sm text-amber-600">
            • {c.title} ({formatDate(c.startDate)} → {formatDate(c.endDate)})
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
                <span className={`text-xs ${isCurrent ? 'text-white/60' : 'text-slate-300'}`}>—</span>
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
