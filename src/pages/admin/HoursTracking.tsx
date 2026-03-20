import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatTime, formatDuration } from '../../utils/helpers';
import type { Attendance } from '../../types';
import * as XLSX from 'xlsx';
import {
  Search,
  ArrowUpDown,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
  Receipt,
  TrendingDown,
  Calendar,
  Eye,
  MapPin,
  Camera,
  ExternalLink,
  Navigation,
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

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function GpsMiniMap({ lat, lng, isValid }: { lat: number; lng: number; isValid?: boolean }) {
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-100" style={{ height: 150, width: '100%', position: 'relative' }}>
        <MapContainer
          key={`${lat}-${lng}`}
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
          <MapPin size={11} /> Google Maps <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

export default function HoursTracking() {
  const { records, fetchRecords, validateRecord } = useAttendanceStore();
  const { events, fetchEvents } = useEventStore();
  const { users, user: currentUser, fetchUsers } = useAuthStore();

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [refusalReason, setRefusalReason] = useState('');

  const agents = users.filter((u) => u.role === 'agent');

  // Build enriched rows: one per attendance record
  const tableRows = useMemo(() => {
    return records
      .filter((rec) => {
        if (dateFrom && rec.date < dateFrom) return false;
        if (dateTo && rec.date > dateTo) return false;
        return true;
      })
      .map((rec) => {
        const agent = agents.find((a) => a.id === rec.agentId);
        const event = events.find((e) => e.id === rec.eventId);
        // Find planned shift for this date
        const shift = event?.shifts?.find((s) => s.date === rec.date);

        return {
          ...rec,
          agentName: agent ? `${agent.firstName} ${agent.lastName}` : 'Inconnu',
          eventTitle: event?.title || 'N/A',
          client: event?.client || 'N/A',
          plannedStart: shift?.startTime || null,
          plannedEnd: shift?.endTime || null,
          eventAddress: event?.address || '',
        };
      });
  }, [records, events, agents, dateFrom, dateTo]);

  const filteredRows = tableRows
    .filter((r) => {
      if (!searchText) return true;
      const q = searchText.toLowerCase();
      return (
        r.agentName.toLowerCase().includes(q) ||
        r.eventTitle.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const field = sortField;
      let av: any, bv: any;
      if (field === 'agentName') { av = a.agentName; bv = b.agentName; }
      else if (field === 'date') { av = a.date; bv = b.date; }
      else if (field === 'hoursWorked') { av = a.hoursWorked || 0; bv = b.hoursWorked || 0; }
      else if (field === 'status') { av = a.status; bv = b.status; }
      else { av = a.date; bv = b.date; }

      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const totalPointed = filteredRows.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const totalValidated = filteredRows.filter((r) => r.status === 'valide').reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const totalBilled = totalValidated * 0.9;
  const totalGap = totalPointed - totalBilled;

  const getGapColor = (gap: number) => {
    if (Math.abs(gap) < 0.5) return 'text-emerald-600';
    if (Math.abs(gap) < 2) return 'text-amber-600';
    return 'text-rose-600';
  };

  const handleValidate = async (status: 'valide' | 'refuse') => {
    if (!selectedRecord || !currentUser) return;
    try {
      await validateRecord(
        selectedRecord.id,
        status,
        currentUser.id,
        status === 'refuse' ? refusalReason : undefined,
      );
    } catch (err) {
      console.error('Failed to validate', err);
    }
    setShowDetail(false);
    setRefusalReason('');
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'valide': return 'Validé';
      case 'en_attente': return 'En attente';
      case 'suspect': return 'Suspect';
      case 'refuse': return 'Refusé';
      default: return s;
    }
  };

  const exportToExcel = useCallback(() => {
    const data = filteredRows.map((r) => ({
      'Agent': r.agentName,
      'Date': formatDate(r.date),
      'Mission': r.eventTitle,
      'Client': r.client,
      'Entrée prévue': r.plannedStart || '—',
      'Sortie prévue': r.plannedEnd || '—',
      'Entrée réelle': r.checkInTime ? formatTime(r.checkInTime) : '—',
      'Sortie réelle': r.checkOutTime ? formatTime(r.checkOutTime) : '—',
      'Durée (h)': r.hoursWorked ? Number(r.hoursWorked.toFixed(2)) : 0,
      'Durée': r.hoursWorked ? formatDuration(r.hoursWorked) : '—',
      'Statut': statusLabel(r.status),
      'GPS Entrée valide': r.checkInLocationValid ? 'Oui' : 'Non',
      'GPS Sortie valide': r.checkOutLocationValid ? 'Oui' : 'Non',
      'Suspect': r.isSuspect ? 'Oui' : 'Non',
      'Raisons suspect': r.suspectReasons?.join(', ') || '',
      'Adresse': r.eventAddress,
    }));

    // Add totals row
    data.push({
      'Agent': `TOTAL (${filteredRows.length} pointages)`,
      'Date': '',
      'Mission': '',
      'Client': '',
      'Entrée prévue': '',
      'Sortie prévue': '',
      'Entrée réelle': '',
      'Sortie réelle': '',
      'Durée (h)': Number(totalPointed.toFixed(2)),
      'Durée': formatDuration(totalPointed),
      'Statut': '',
      'GPS Entrée valide': '',
      'GPS Sortie valide': '',
      'Suspect': '',
      'Raisons suspect': '',
      'Adresse': '',
    });

    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...data.map((row) => String((row as any)[key] ?? '').length),
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    // Style header row (bold) — xlsx community edition uses basic formatting
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) {
        ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'F1F5F9' } } };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suivi Heures');

    const dateStr = new Date().toISOString().slice(0, 10);
    const filterSuffix = dateFrom || dateTo ? `_${dateFrom || 'debut'}_${dateTo || 'fin'}` : '';
    XLSX.writeFile(wb, `FranClean_Suivi_Heures_${dateStr}${filterSuffix}.xlsx`);
  }, [filteredRows, totalPointed, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Suivi des Heures"
        subtitle="Heures prévues vs réelles — photos & GPS — validation"
        action={
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-medium text-sm shadow-card transition-colors"
          >
            <Download size={16} />
            Exporter Excel
          </button>
        }
      />

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="H. Pointées" value={formatDuration(totalPointed)} icon={Clock} iconBg="bg-slate-50" iconColor="text-slate-600" />
        <StatCard label="H. Validées" value={formatDuration(totalValidated)} icon={FileCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard label="H. Facturées" value={formatDuration(totalBilled)} icon={Receipt} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Écart" value={`${totalGap > 0 ? '+' : ''}${formatDuration(totalGap)}`} icon={TrendingDown} iconBg="bg-orange-50" iconColor="text-orange-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher agent, mission ou client..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              title="Date début"
            />
            <span className="text-xs text-slate-400 font-medium">à</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              title="Date fin"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Tout
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  { key: 'agentName', label: 'Agent', sortable: true },
                  { key: 'date', label: 'Date', sortable: true },
                  { key: 'event', label: 'Mission', sortable: false },
                  { key: 'plannedIn', label: 'Entrée prévue', sortable: false },
                  { key: 'plannedOut', label: 'Sortie prévue', sortable: false },
                  { key: 'actualIn', label: 'Entrée réelle', sortable: false },
                  { key: 'actualOut', label: 'Sortie réelle', sortable: false },
                  { key: 'hoursWorked', label: 'Durée', sortable: true },
                  { key: 'status', label: 'Statut', sortable: true },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable ? toggleSort(col.key) : undefined}
                    className={`text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 select-none ${col.sortable ? 'cursor-pointer hover:text-slate-700' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <ArrowUpDown
                          size={12}
                          className={sortField === col.key ? 'text-primary-500' : 'text-slate-300'}
                        />
                      )}
                    </div>
                  </th>
                ))}
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const hasDelay = row.checkInTime && row.plannedStart && formatTime(row.checkInTime) > row.plannedStart;
                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                      {row.agentName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900 font-medium truncate max-w-[160px]">{row.eventTitle}</p>
                      <p className="text-[11px] text-slate-400">{row.client}</p>
                    </td>
                    {/* Planned entry */}
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {row.plannedStart ? (
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-blue-400" />
                          {row.plannedStart}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Planned exit */}
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {row.plannedEnd ? (
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-blue-400" />
                          {row.plannedEnd}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Actual entry */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.checkInTime ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold ${hasDelay ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {formatTime(row.checkInTime)}
                          </span>
                          {row.checkInPhotoUrl && <Camera size={12} className="text-emerald-400" />}
                          {row.checkInLocationValid === false && <MapPin size={12} className="text-rose-400" />}
                        </div>
                      ) : <span className="text-sm text-slate-300">—</span>}
                    </td>
                    {/* Actual exit */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.checkOutTime ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatTime(row.checkOutTime)}
                          </span>
                          {row.checkOutPhotoUrl && <Camera size={12} className="text-rose-400" />}
                          {row.checkOutLocationValid === false && <MapPin size={12} className="text-rose-400" />}
                        </div>
                      ) : <span className="text-sm text-slate-300">—</span>}
                    </td>
                    {/* Duration */}
                    <td className="px-4 py-3 text-sm font-bold text-primary-600 whitespace-nowrap">
                      {row.hoursWorked ? formatDuration(row.hoursWorked) : '—'}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <StatusBadge status={row.status} />
                        {row.isSuspect && <AlertTriangle size={13} className="text-orange-500" />}
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setSelectedRecord(row); setShowDetail(true); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors"
                        >
                          <Eye size={13} /> Détails
                        </button>
                        {(row.status === 'en_attente' || row.status === 'suspect') && (
                          <>
                            <button
                              onClick={() => { if (currentUser) validateRecord(row.id, 'valide', currentUser.id); }}
                              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
                              title="Valider"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => { setSelectedRecord(row); setShowDetail(true); }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Refuser"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-400">
                    Aucune donnée trouvée
                  </td>
                </tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-3 text-sm font-bold text-slate-900" colSpan={7}>
                    TOTAL ({filteredRows.length} pointage{filteredRows.length > 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-primary-700">
                    {formatDuration(totalPointed)}
                  </td>
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Detail modal */}
      <Modal
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setRefusalReason(''); }}
        title="Détail du pointage"
        size="xl"
      >
        {selectedRecord && (() => {
          const event = events.find((e) => e.id === selectedRecord.eventId);
          const agent = users.find((u) => u.id === selectedRecord.agentId);
          const shift = event?.shifts?.find((s) => s.date === selectedRecord.date);

          return (
            <div className="space-y-5">
              {/* Header info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Agent</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">
                    {agent ? `${agent.firstName} ${agent.lastName}` : 'Inconnu'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Mission</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{event?.title || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Date</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(selectedRecord.date)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Statut</p>
                  <div className="mt-0.5"><StatusBadge status={selectedRecord.status} /></div>
                </div>
              </div>

              {/* Event info */}
              {event && (
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
                  <p className="flex items-center gap-1"><MapPin size={12} /> {event.address}</p>
                  {event.client && <p>Client : {event.client}</p>}
                </div>
              )}

              {/* Planned vs Actual times comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-blue-700 uppercase mb-3 flex items-center gap-1.5">
                    <Clock size={13} /> Horaires prévus
                  </h4>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-[10px] text-blue-500 font-bold uppercase">Entrée</p>
                      <p className="text-lg font-bold text-blue-700">{shift?.startTime || '—'}</p>
                    </div>
                    <div className="text-blue-300">→</div>
                    <div>
                      <p className="text-[10px] text-blue-500 font-bold uppercase">Sortie</p>
                      <p className="text-lg font-bold text-blue-700">{shift?.endTime || '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-emerald-700 uppercase mb-3 flex items-center gap-1.5">
                    <Clock size={13} /> Horaires réels
                  </h4>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">Entrée</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {selectedRecord.checkInTime ? formatTime(selectedRecord.checkInTime) : '—'}
                      </p>
                    </div>
                    <div className="text-emerald-300">→</div>
                    <div>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">Sortie</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {selectedRecord.checkOutTime ? formatTime(selectedRecord.checkOutTime) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Duration */}
              {selectedRecord.hoursWorked != null && (
                <div className="bg-primary-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-primary-600 font-medium">Durée travaillée</p>
                  <p className="text-2xl font-bold text-primary-700 mt-0.5">{formatDuration(selectedRecord.hoursWorked)}</p>
                </div>
              )}

              {/* Suspect warnings */}
              {selectedRecord.isSuspect && selectedRecord.suspectReasons.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-orange-700 flex items-center gap-1 mb-1">
                    <AlertTriangle size={12} /> Alertes
                  </p>
                  {selectedRecord.suspectReasons.map((r, i) => (
                    <p key={i} className="text-xs text-orange-600">• {r}</p>
                  ))}
                </div>
              )}

              {/* Photos + GPS side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Entry */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Camera size={14} className="text-emerald-500" /> Photo d'entrée
                  </h4>
                  {selectedRecord.checkInPhotoUrl ? (
                    <div className="space-y-2">
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <img src={selectedRecord.checkInPhotoUrl} alt="Entrée" className="w-full h-44 object-cover bg-slate-100" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <Clock size={12} /> {formatTime(selectedRecord.checkInTime!)}
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${selectedRecord.checkInLocationValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                          <MapPin size={12} />
                          {selectedRecord.checkInLocationValid ? 'GPS valide' : 'Hors zone'}
                        </span>
                      </div>
                      {selectedRecord.checkInLatitude && selectedRecord.checkInLongitude && (
                        <GpsMiniMap
                          lat={selectedRecord.checkInLatitude}
                          lng={selectedRecord.checkInLongitude}
                          isValid={selectedRecord.checkInLocationValid}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="h-44 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                      <span className="text-sm text-slate-400">Aucune photo</span>
                    </div>
                  )}
                </div>

                {/* Exit */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Camera size={14} className="text-rose-500" /> Photo de sortie
                  </h4>
                  {selectedRecord.checkOutPhotoUrl ? (
                    <div className="space-y-2">
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <img src={selectedRecord.checkOutPhotoUrl} alt="Sortie" className="w-full h-44 object-cover bg-slate-100" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <Clock size={12} /> {formatTime(selectedRecord.checkOutTime!)}
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${selectedRecord.checkOutLocationValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                          <MapPin size={12} />
                          {selectedRecord.checkOutLocationValid ? 'GPS valide' : 'Hors zone'}
                        </span>
                      </div>
                      {selectedRecord.checkOutLatitude && selectedRecord.checkOutLongitude && (
                        <GpsMiniMap
                          lat={selectedRecord.checkOutLatitude}
                          lng={selectedRecord.checkOutLongitude}
                          isValid={selectedRecord.checkOutLocationValid}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="h-44 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                      <span className="text-sm text-slate-400">Aucune photo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Validation actions */}
              {(selectedRecord.status === 'en_attente' || selectedRecord.status === 'suspect') && (
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Motif de refus (optionnel)
                    </label>
                    <textarea
                      value={refusalReason}
                      onChange={(e) => setRefusalReason(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
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
          );
        })()}
      </Modal>
    </div>
  );
}
