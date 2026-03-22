import { useState, useEffect, useRef } from 'react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatTime, formatDuration } from '../../utils/helpers';
import type { AttendanceStatus } from '../../types';
import {
  CheckCircle2,
  XCircle,
  Eye,
  MapPin,
  Camera,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  Users,
  List,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Calendar,
  ExternalLink,
  Navigation,
  CalendarDays,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Forces Leaflet to recalculate its size when the container becomes visible */
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    // Small delay to ensure the container is fully rendered
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

/** Mini-map showing agent GPS position at photo time */
function GpsMiniMap({ lat, lng, label, isValid }: { lat: number; lng: number; label: string; isValid?: boolean }) {
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-100" style={{ height: 150, width: '100%', position: 'relative' }}>
        <MapContainer
          key={`${label}-${lat}-${lng}`}
          center={[lat, lng]}
          zoom={16}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          attributionControl={false}
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[lat, lng]} />
          <InvalidateSize />
        </MapContainer>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1.5">
          <Navigation size={12} className={isValid ? 'text-emerald-500' : 'text-rose-500'} />
          <span className={`text-[11px] font-semibold ${isValid ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isValid ? 'Dans la zone' : 'Hors zone'}
          </span>
          <span className="text-[10px] text-slate-400 ml-1">
            ({lat.toFixed(5)}, {lng.toFixed(5)})
          </span>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:underline bg-primary-50 px-2 py-0.5 rounded-full"
        >
          <MapPin size={11} /> Voir sur Google Maps <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

type ViewMode = 'table' | 'par-agent' | 'par-event';

export default function AdminAttendance() {
  const { records, validateRecord, fetchRecords } = useAttendanceStore();
  const { events, fetchEvents } = useEventStore();
  const { users, user: currentUser, fetchUsers } = useAuthStore();

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [refusalReason, setRefusalReason] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);

  const agents = users.filter((u) => u.role === 'agent');

  const filteredRecords = records
    .filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterAgent !== 'all' && r.agentId !== filterAgent) return false;
      if (searchText) {
        const agent = users.find((u) => u.id === r.agentId);
        const event = events.find((e) => e.id === r.eventId);
        const searchLower = searchText.toLowerCase();
        const matches =
          agent?.firstName.toLowerCase().includes(searchLower) ||
          agent?.lastName.toLowerCase().includes(searchLower) ||
          event?.title.toLowerCase().includes(searchLower);
        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const getAgentName = (id: string) => {
    const agent = users.find((u) => u.id === id);
    return agent ? `${agent.firstName} ${agent.lastName}` : 'Inconnu';
  };

  const getEventTitle = (id: string) => {
    const event = events.find((e) => e.id === id);
    return event?.title || 'Événement inconnu';
  };

  const record = records.find((r) => r.id === selectedRecord);

  const handleValidate = async (status: AttendanceStatus) => {
    if (!selectedRecord || !currentUser) return;
    try {
      await validateRecord(
        selectedRecord,
        status,
        currentUser.id,
        status === 'refuse' ? refusalReason : undefined,
      );
    } catch (err) {
      console.error('Failed to validate record', err);
    }
    setShowDetail(false);
    setRefusalReason('');
  };

  const pendingCount = records.filter((r) => r.status === 'en_attente').length;
  const suspectCount = records.filter((r) => r.status === 'suspect').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Validation des Pointages" subtitle="Vérifiez et validez les pointages des agents" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total" value={records.length} icon={Calendar} iconBg="bg-slate-50" iconColor="text-slate-600" />
        <StatCard label="En attente" value={pendingCount} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" alert={pendingCount > 0} />
        <StatCard label="Suspects" value={suspectCount} icon={AlertTriangle} iconBg="bg-orange-50" iconColor="text-orange-600" alert={suspectCount > 0} />
        <StatCard label="Validés" value={records.filter((r) => r.status === 'valide').length} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200/80 p-1.5 shadow-card">
        <button
          onClick={() => setViewMode('table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'table'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <List size={16} /> Liste des pointages
        </button>
        <button
          onClick={() => setViewMode('par-agent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'par-agent'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Users size={16} /> Par agent
        </button>
        <button
          onClick={() => setViewMode('par-event')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'par-event'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <CalendarDays size={16} /> Par événement
        </button>
      </div>

      {viewMode === 'table' && (
        <>
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher agent ou événement..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="all">Tous statuts</option>
              <option value="en_attente">En attente</option>
              <option value="valide">Validé</option>
              <option value="refuse">Refusé</option>
              <option value="suspect">Suspect</option>
            </select>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="all">Tous agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Agent
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Événement
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Date
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Entrée
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Sortie
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Heures
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  GPS
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Statut
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-slate-900">
                      {getAgentName(rec.agentId)}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-slate-600 max-w-[180px] truncate">
                      {getEventTitle(rec.eventId)}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    {formatDate(rec.date)}
                  </td>
                  <td className="px-5 py-3.5">
                    {rec.checkInTime ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-900">
                          {formatTime(rec.checkInTime)}
                        </span>
                        {rec.checkInPhotoUrl && (
                          <Camera size={14} className="text-emerald-500" />
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {rec.checkOutTime ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-900">
                          {formatTime(rec.checkOutTime)}
                        </span>
                        {rec.checkOutPhotoUrl && (
                          <Camera size={14} className="text-emerald-500" />
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-slate-900">
                      {rec.hoursWorked ? formatDuration(rec.hoursWorked) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {rec.checkInLocationValid === false || rec.checkOutLocationValid === false ? (
                      <span className="flex items-center gap-1 text-rose-500">
                        <MapPin size={14} />
                        <span className="text-xs font-medium">Hors zone</span>
                      </span>
                    ) : rec.checkInLatitude ? (
                      <span className="flex items-center gap-1 text-emerald-500">
                        <MapPin size={14} />
                        <span className="text-xs font-medium">OK</span>
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <StatusBadge status={rec.status} />
                      {rec.isSuspect && (
                        <AlertTriangle size={14} className="text-orange-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setSelectedRecord(rec.id);
                          setShowDetail(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        title="Voir détail"
                      >
                        <Eye size={16} />
                      </button>
                      {rec.status === 'en_attente' || rec.status === 'suspect' ? (
                        <>
                          <button
                            onClick={() => {
                              if (currentUser) validateRecord(rec.id, 'valide', currentUser.id);
                            }}
                            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
                            title="Valider"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRecord(rec.id);
                              setShowDetail(true);
                            }}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                            title="Refuser"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-400">
                    Aucun pointage trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Par Agent view */}
      {viewMode === 'par-agent' && (
        <div className="space-y-5">
          {/* Agent selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Sélectionner un agent
            </label>
            <select
              value={selectedAgentId}
              onChange={(e) => { setSelectedAgentId(e.target.value); setExpandedMissionId(null); }}
              className="w-full sm:w-80 px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">— Choisir un agent —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}
                </option>
              ))}
            </select>
          </div>

          {selectedAgentId && (() => {
            const agentRecords = records
              .filter((r) => r.agentId === selectedAgentId)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const agent = users.find((u) => u.id === selectedAgentId);

            return (
              <div className="space-y-4">
                {/* Agent summary */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
                      {agent ? `${agent.firstName[0]}${agent.lastName[0]}` : '?'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {agent ? `${agent.firstName} ${agent.lastName}` : 'Inconnu'}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {agentRecords.length} pointage{agentRecords.length !== 1 ? 's' : ''} enregistré{agentRecords.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Validés</p>
                        <p className="text-lg font-bold text-emerald-600">
                          {agentRecords.filter((r) => r.status === 'valide').length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">En attente</p>
                        <p className="text-lg font-bold text-amber-600">
                          {agentRecords.filter((r) => r.status === 'en_attente').length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Suspects</p>
                        <p className="text-lg font-bold text-orange-600">
                          {agentRecords.filter((r) => r.status === 'suspect').length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mission cards with photos */}
                {agentRecords.length > 0 ? (
                  <div className="space-y-3">
                    {agentRecords.map((rec) => {
                      const evt = events.find((e) => e.id === rec.eventId);
                      const isExpanded = expandedMissionId === rec.id;
                      return (
                        <div key={rec.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <button
                            onClick={() => setExpandedMissionId(isExpanded ? null : rec.id)}
                            className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
                          >
                            {/* Thumbnails preview */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {rec.checkInPhotoUrl ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-emerald-300">
                                  <img src={rec.checkInPhotoUrl} alt="Entrée" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                                  <ImageIcon size={16} className="text-slate-300" />
                                </div>
                              )}
                              {rec.checkOutPhotoUrl ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-rose-300">
                                  <img src={rec.checkOutPhotoUrl} alt="Sortie" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                                  <ImageIcon size={16} className="text-slate-300" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {evt?.title || 'Mission inconnue'}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} /> {formatDate(rec.date)}
                                </span>
                                {rec.checkInTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-emerald-500" />
                                    {formatTime(rec.checkInTime)}
                                  </span>
                                )}
                                {rec.checkOutTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-rose-500" />
                                    {formatTime(rec.checkOutTime)}
                                  </span>
                                )}
                                {rec.hoursWorked && (
                                  <span className="font-semibold text-primary-600">
                                    {formatDuration(rec.hoursWorked)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <StatusBadge status={rec.status} />
                              {rec.isSuspect && <AlertTriangle size={14} className="text-orange-500" />}
                              {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-4 animate-fadeIn">
                              {/* Event details */}
                              {evt && (
                                <div className="bg-slate-50 rounded-lg p-3 mt-3 text-xs text-slate-500 space-y-1">
                                  <p className="flex items-center gap-1">
                                    <MapPin size={12} /> {evt.address}
                                  </p>
                                  {evt.shifts?.filter(s => s.date === rec.date).length > 0 ? (
                                    <p className="flex items-center gap-1">
                                      <Clock size={12} /> {evt.shifts.filter(s => s.date === rec.date).map(s => `${s.startTime}→${s.endTime}`).join(' | ')}
                                    </p>
                                  ) : (
                                    <p className="flex items-center gap-1">
                                      <Clock size={12} /> {evt.shifts?.length || 0} créneau{(evt.shifts?.length || 0) > 1 ? 'x' : ''}
                                    </p>
                                  )}
                                  {evt.client && <p>Client : {evt.client}</p>}
                                </div>
                              )}

                              {/* Photos side by side */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Entry photo */}
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Camera size={14} className="text-emerald-500" /> Photo d'entrée
                                  </h4>
                                  {rec.checkInPhotoUrl ? (
                                    <div className="space-y-2">
                                      <div className="rounded-xl overflow-hidden border border-slate-200">
                                        <img src={rec.checkInPhotoUrl} alt="Photo entrée" className="w-full h-48 object-cover bg-slate-100" />
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                                          <Clock size={12} /> {formatTime(rec.checkInTime!)}
                                        </span>
                                        <span className={`flex items-center gap-1 font-medium ${rec.checkInLocationValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          <MapPin size={12} />
                                          {rec.checkInLocationValid ? 'GPS valide' : 'Hors zone'}
                                        </span>
                                      </div>
                                      {rec.checkInLatitude && rec.checkInLongitude && (
                                        <GpsMiniMap
                                          lat={rec.checkInLatitude}
                                          lng={rec.checkInLongitude}
                                          label="Entrée"
                                          isValid={rec.checkInLocationValid}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-48 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                                      <span className="text-sm text-slate-400">Aucune photo</span>
                                    </div>
                                  )}
                                </div>

                                {/* Exit photo */}
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Camera size={14} className="text-rose-500" /> Photo de clôture
                                  </h4>
                                  {rec.checkOutPhotoUrl ? (
                                    <div className="space-y-2">
                                      <div className="rounded-xl overflow-hidden border border-slate-200">
                                        <img src={rec.checkOutPhotoUrl} alt="Photo sortie" className="w-full h-48 object-cover bg-slate-100" />
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                                          <Clock size={12} /> {formatTime(rec.checkOutTime!)}
                                        </span>
                                        <span className={`flex items-center gap-1 font-medium ${rec.checkOutLocationValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          <MapPin size={12} />
                                          {rec.checkOutLocationValid ? 'GPS valide' : 'Hors zone'}
                                        </span>
                                      </div>
                                      {rec.checkOutLatitude && rec.checkOutLongitude && (
                                        <GpsMiniMap
                                          lat={rec.checkOutLatitude}
                                          lng={rec.checkOutLongitude}
                                          label="Sortie"
                                          isValid={rec.checkOutLocationValid}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-48 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                                      <span className="text-sm text-slate-400">Aucune photo</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Hours + alerts */}
                              <div className="flex items-center gap-4">
                                {rec.hoursWorked && (
                                  <div className="bg-primary-50 rounded-lg px-4 py-2 text-center">
                                    <p className="text-xs text-primary-600">Heures</p>
                                    <p className="text-xl font-bold text-primary-700">{formatDuration(rec.hoursWorked)}</p>
                                  </div>
                                )}
                                {rec.isSuspect && rec.suspectReasons.length > 0 && (
                                  <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-orange-700 flex items-center gap-1 mb-1">
                                      <AlertTriangle size={12} /> Alertes
                                    </p>
                                    {rec.suspectReasons.map((r, i) => (
                                      <p key={i} className="text-xs text-orange-600">• {r}</p>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Validation actions */}
                              {(rec.status === 'en_attente' || rec.status === 'suspect') && (
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                  <button
                                    onClick={() => {
                                      if (currentUser) validateRecord(rec.id, 'valide', currentUser.id);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all"
                                  >
                                    <CheckCircle2 size={14} /> Valider
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedRecord(rec.id);
                                      setShowDetail(true);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-all"
                                  >
                                    <XCircle size={14} /> Refuser
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <Camera size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">Aucun pointage pour cet agent</p>
                  </div>
                )}
              </div>
            );
          })()}

          {!selectedAgentId && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Users size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">Sélectionnez un agent</p>
              <p className="text-xs text-slate-400 mt-1">
                Choisissez un agent pour voir ses photos et horaires par mission
              </p>
            </div>
          )}
        </div>
      )}

      {/* Par Événement view */}
      {viewMode === 'par-event' && (
        <div className="space-y-5">
          {/* Event selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Sélectionner un événement
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => { setSelectedEventId(e.target.value); setExpandedMissionId(null); }}
              className="w-full sm:w-96 px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">— Choisir un événement —</option>
              {events
                .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}{e.client ? ` — ${e.client}` : ''} ({e.startDate})
                  </option>
                ))}
            </select>
          </div>

          {selectedEventId && (() => {
            const evt = events.find((e) => e.id === selectedEventId);
            if (!evt) return null;
            const eventRecords = records
              .filter((r) => r.eventId === selectedEventId)
              .sort((a, b) => {
                const d = new Date(b.date).getTime() - new Date(a.date).getTime();
                if (d !== 0) return d;
                return getAgentName(a.agentId).localeCompare(getAgentName(b.agentId));
              });
            const totalHours = eventRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
            const uniqueAgents = new Set(eventRecords.map((r) => r.agentId)).size;

            return (
              <div className="space-y-4">
                {/* Event summary */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: evt.color || '#6366F1' }}
                    >
                      <CalendarDays size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 truncate">{evt.title}</h3>
                      <p className="text-sm text-slate-500">
                        {evt.client && <span>{evt.client} • </span>}
                        {evt.startDate} → {evt.endDate}
                        {evt.address && <span className="ml-2 text-xs">📍 {evt.address.split(',')[0]}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Pointages</p>
                        <p className="text-lg font-bold text-slate-700">{eventRecords.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Agents</p>
                        <p className="text-lg font-bold text-primary-600">{uniqueAgents}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Heures</p>
                        <p className="text-lg font-bold text-emerald-600">{formatDuration(totalHours)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Validés</p>
                        <p className="text-lg font-bold text-emerald-600">
                          {eventRecords.filter((r) => r.status === 'valide').length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Records by agent */}
                {eventRecords.length > 0 ? (
                  <div className="space-y-3">
                    {eventRecords.map((rec) => {
                      const agent = users.find((u) => u.id === rec.agentId);
                      const isExpanded = expandedMissionId === rec.id;
                      return (
                        <div key={rec.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <button
                            onClick={() => setExpandedMissionId(isExpanded ? null : rec.id)}
                            className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
                          >
                            {/* Agent avatar */}
                            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                              {agent ? `${agent.firstName[0]}${agent.lastName[0]}` : '?'}
                            </div>

                            {/* Thumbnails */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {rec.checkInPhotoUrl ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-emerald-300">
                                  <img src={rec.checkInPhotoUrl} alt="Entrée" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                                  <ImageIcon size={14} className="text-slate-300" />
                                </div>
                              )}
                              {rec.checkOutPhotoUrl ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-rose-300">
                                  <img src={rec.checkOutPhotoUrl} alt="Sortie" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                                  <ImageIcon size={14} className="text-slate-300" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {getAgentName(rec.agentId)}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} /> {formatDate(rec.date)}
                                </span>
                                {rec.checkInTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-emerald-500" />
                                    {formatTime(rec.checkInTime)}
                                  </span>
                                )}
                                {rec.checkOutTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-rose-500" />
                                    {formatTime(rec.checkOutTime)}
                                  </span>
                                )}
                                {rec.hoursWorked && (
                                  <span className="font-semibold text-primary-600">
                                    {formatDuration(rec.hoursWorked)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <StatusBadge status={rec.status} />
                              {rec.isSuspect && <AlertTriangle size={14} className="text-orange-500" />}
                              {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-4 animate-fadeIn">
                              {/* Photos side by side */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                {/* Entry photo */}
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Camera size={14} className="text-emerald-500" /> Photo d'entrée
                                  </h4>
                                  {rec.checkInPhotoUrl ? (
                                    <div className="space-y-2">
                                      <div className="rounded-xl overflow-hidden border border-slate-200">
                                        <img src={rec.checkInPhotoUrl} alt="Photo entrée" className="w-full h-48 object-cover bg-slate-100" />
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                                          <Clock size={12} /> {formatTime(rec.checkInTime!)}
                                        </span>
                                        <span className={`flex items-center gap-1 font-medium ${rec.checkInLocationValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          <MapPin size={12} />
                                          {rec.checkInLocationValid ? 'GPS valide' : 'Hors zone'}
                                        </span>
                                      </div>
                                      {rec.checkInLatitude && rec.checkInLongitude && (
                                        <GpsMiniMap lat={rec.checkInLatitude} lng={rec.checkInLongitude} label="Entrée" isValid={rec.checkInLocationValid} />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-48 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                                      <span className="text-sm text-slate-400">Aucune photo</span>
                                    </div>
                                  )}
                                </div>
                                {/* Exit photo */}
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Camera size={14} className="text-rose-500" /> Photo de clôture
                                  </h4>
                                  {rec.checkOutPhotoUrl ? (
                                    <div className="space-y-2">
                                      <div className="rounded-xl overflow-hidden border border-slate-200">
                                        <img src={rec.checkOutPhotoUrl} alt="Photo sortie" className="w-full h-48 object-cover bg-slate-100" />
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                                          <Clock size={12} /> {formatTime(rec.checkOutTime!)}
                                        </span>
                                        <span className={`flex items-center gap-1 font-medium ${rec.checkOutLocationValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          <MapPin size={12} />
                                          {rec.checkOutLocationValid ? 'GPS valide' : 'Hors zone'}
                                        </span>
                                      </div>
                                      {rec.checkOutLatitude && rec.checkOutLongitude && (
                                        <GpsMiniMap lat={rec.checkOutLatitude} lng={rec.checkOutLongitude} label="Sortie" isValid={rec.checkOutLocationValid} />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-48 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                                      <span className="text-sm text-slate-400">Aucune photo</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Hours + alerts */}
                              <div className="flex items-center gap-4">
                                {rec.hoursWorked && (
                                  <div className="bg-primary-50 rounded-lg px-4 py-2 text-center">
                                    <p className="text-xs text-primary-600">Heures</p>
                                    <p className="text-xl font-bold text-primary-700">{formatDuration(rec.hoursWorked)}</p>
                                  </div>
                                )}
                                {rec.isSuspect && rec.suspectReasons.length > 0 && (
                                  <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-orange-700 flex items-center gap-1 mb-1">
                                      <AlertTriangle size={12} /> Alertes
                                    </p>
                                    {rec.suspectReasons.map((r, i) => (
                                      <p key={i} className="text-xs text-orange-600">• {r}</p>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Validation actions */}
                              {(rec.status === 'en_attente' || rec.status === 'suspect') && (
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                  <button
                                    onClick={() => {
                                      if (currentUser) validateRecord(rec.id, 'valide', currentUser.id);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all"
                                  >
                                    <CheckCircle2 size={14} /> Valider
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedRecord(rec.id);
                                      setShowDetail(true);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-all"
                                  >
                                    <XCircle size={14} /> Refuser
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <Camera size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">Aucun pointage pour cet événement</p>
                  </div>
                )}
              </div>
            );
          })()}

          {!selectedEventId && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CalendarDays size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">Sélectionnez un événement</p>
              <p className="text-xs text-slate-400 mt-1">
                Choisissez un événement pour voir les pointages de tous les agents associés
              </p>
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={showDetail}
        onClose={() => {
          setShowDetail(false);
          setRefusalReason('');
        }}
        title="Détail du pointage"
        size="lg"
      >
        {record && (
          <div className="space-y-6">
            {/* Agent & Event info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Agent</p>
                <p className="text-sm font-semibold text-slate-900">
                  {getAgentName(record.agentId)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Événement</p>
                <p className="text-sm font-semibold text-slate-900">
                  {getEventTitle(record.eventId)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Date</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatDate(record.date)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Statut</p>
                <StatusBadge status={record.status} size="md" />
              </div>
            </div>

            {/* Suspect warnings */}
            {record.isSuspect && record.suspectReasons.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-orange-700 font-semibold text-sm mb-2">
                  <AlertTriangle size={16} />
                  Alertes détectées
                </div>
                <ul className="space-y-1">
                  {record.suspectReasons.map((reason, i) => (
                    <li key={i} className="text-sm text-orange-600">• {reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Check-in / Check-out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Check-in */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock size={14} /> Pointage Entrée
                </h4>
                {record.checkInTime ? (
                  <div className="space-y-3">
                    <p className="text-lg font-bold text-slate-900">
                      {formatTime(record.checkInTime)}
                    </p>
                    {record.checkInPhotoUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <img
                          src={record.checkInPhotoUrl}
                          alt="Photo check-in"
                          className="w-full h-40 object-cover bg-slate-100"
                        />
                      </div>
                    )}
                    {record.checkInLatitude && record.checkInLongitude && (
                      <GpsMiniMap
                        lat={record.checkInLatitude}
                        lng={record.checkInLongitude}
                        label="Entrée"
                        isValid={record.checkInLocationValid}
                      />
                    )}
                    {!record.checkInLatitude && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-400">GPS non disponible</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Pas encore pointé</p>
                )}
              </div>

              {/* Check-out */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock size={14} /> Pointage Sortie
                </h4>
                {record.checkOutTime ? (
                  <div className="space-y-3">
                    <p className="text-lg font-bold text-slate-900">
                      {formatTime(record.checkOutTime)}
                    </p>
                    {record.checkOutPhotoUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <img
                          src={record.checkOutPhotoUrl}
                          alt="Photo check-out"
                          className="w-full h-40 object-cover bg-slate-100"
                        />
                      </div>
                    )}
                    {record.checkOutLatitude && record.checkOutLongitude && (
                      <GpsMiniMap
                        lat={record.checkOutLatitude}
                        lng={record.checkOutLongitude}
                        label="Sortie"
                        isValid={record.checkOutLocationValid}
                      />
                    )}
                    {!record.checkOutLatitude && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-400">GPS non disponible</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Pas encore pointé</p>
                )}
              </div>
            </div>

            {/* Hours worked */}
            {record.hoursWorked && (
              <div className="bg-primary-50 rounded-xl p-4 text-center">
                <p className="text-sm text-primary-600 font-medium">Heures travaillées</p>
                <p className="text-3xl font-bold text-primary-700 mt-1">
                  {formatDuration(record.hoursWorked)}
                </p>
              </div>
            )}

            {/* Validation actions */}
            {(record.status === 'en_attente' || record.status === 'suspect') && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Motif de refus (optionnel)
                  </label>
                  <textarea
                    value={refusalReason}
                    onChange={(e) => setRefusalReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                    placeholder="Indiquer un motif en cas de refus..."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleValidate('valide')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all"
                  >
                    <CheckCircle2 size={16} /> Valider
                  </button>
                  <button
                    onClick={() => handleValidate('refuse')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-sm transition-all"
                  >
                    <XCircle size={16} /> Refuser
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
