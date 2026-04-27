import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatTime, formatDuration } from '../../utils/helpers';
import type { Attendance } from '../../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Search,
  ArrowUpDown,
  Download,
  FileText,
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
  ImagePlus,
  CalendarDays,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { useMonthlySummaryStore } from '../../store/monthlySummaryStore';

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

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

function GpsMiniMap({ lat, lng, isValid }: { lat: number; lng: number; isValid?: boolean | null }) {
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
          <Navigation size={12} className={isValid === true ? 'text-emerald-500' : isValid === false ? 'text-rose-500' : 'text-slate-400'} />
          <span className={`text-[11px] font-semibold ${isValid === true ? 'text-emerald-600' : isValid === false ? 'text-rose-600' : 'text-slate-500'}`}>
            {isValid === true ? 'Dans la zone' : isValid === false ? 'Hors zone' : 'GPS non configuré'}
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
  const { adminSummaries, fetchAdminSummaries } = useMonthlySummaryStore();

  const [adminTab, setAdminTab] = useState<'pointages' | 'confirmations'>('pointages');
  const now = new Date();
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    if (adminTab === 'confirmations') fetchAdminSummaries(summaryYear, summaryMonth);
  }, [adminTab, summaryYear, summaryMonth, fetchAdminSummaries]);

  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterMission, setFilterMission] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [refusalReason, setRefusalReason] = useState('');
  const [billedHours, setBilledHours] = useState<number | null>(null);
  const [showQuickValidate, setShowQuickValidate] = useState(false);
  const [quickRecord, setQuickRecord] = useState<Attendance | null>(null);
  const [quickAction, setQuickAction] = useState<'valide' | 'refuse'>('valide');
  const [quickBilledHours, setQuickBilledHours] = useState<number | null>(null);
  const [quickRefusalReason, setQuickRefusalReason] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Column resize (Excel-like drag) ─────────────────
  const defaultColWidths: Record<string, number> = {
    agentName: 8.5, date: 6.5, event: 13, plannedIn: 5.5, plannedOut: 5.5,
    actualIn: 6, actualOut: 6, totalPlanned: 5.5, totalReal: 5.5,
    hoursWorked: 5.5, billedHours: 5.5, gps: 5, status: 7, actions: 14.5,
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(defaultColWidths);
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const onResizeStart = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key, startX: e.clientX, startW: colWidths[key] };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const tableEl = document.querySelector('[data-hours-table]') as HTMLElement | null;
      const tableW = tableEl?.offsetWidth || 1400;
      const diffPct = ((ev.clientX - resizingRef.current.startX) / tableW) * 100;
      const newW = Math.max(3, resizingRef.current.startW + diffPct);
      setColWidths((prev) => ({ ...prev, [resizingRef.current!.key]: newW }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths]);

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
        // Find planned shift for this date + agent (fallback to any shift on the date)
        const shifts = event?.shifts?.filter((s) => s.date === rec.date) || [];
        const shift = shifts.find((s) => s.agentId === rec.agentId) || shifts[0];

        return {
          ...rec,
          agentName: agent ? `${agent.firstName} ${agent.lastName}` : 'Inconnu',
          eventTitle: event?.title || 'N/A',
          client: event?.client || 'N/A',
          plannedStart: shift?.startTime || null,
          plannedEnd: shift?.endTime || null,
          eventAddress: event?.address || '',
          breakHours: event?.breakHours || 0,
        };
      });
  }, [records, events, agents, dateFrom, dateTo]);

  // Unique lists for filter dropdowns
  const uniqueAgents = useMemo(() => {
    const names = [...new Set(tableRows.map((r) => r.agentName))].filter(Boolean).sort();
    return names;
  }, [tableRows]);
  const uniqueClients = useMemo(() => {
    const clients = [...new Set(tableRows.map((r) => r.client))].filter((c) => c && c !== 'N/A').sort();
    return clients;
  }, [tableRows]);
  const uniqueMissions = useMemo(() => {
    const missions = [...new Set(tableRows.map((r) => r.eventTitle))].filter((m) => m && m !== 'N/A').sort();
    return missions;
  }, [tableRows]);
  const uniqueSites = useMemo(() => {
    const sites = [...new Set(tableRows.map((r) => r.eventAddress))].filter(Boolean).sort();
    return sites;
  }, [tableRows]);

  const filteredRows = tableRows
    .filter((r) => {
      if (filterAgent && r.agentName !== filterAgent) return false;
      if (filterClient && r.client !== filterClient) return false;
      if (filterMission && r.eventTitle !== filterMission) return false;
      if (filterSite && r.eventAddress !== filterSite) return false;
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
  const totalValidated = filteredRows.filter((r) => r.status === 'valide').reduce((sum, r) => sum + (r.billedHours || r.hoursWorked || 0), 0);
  const totalBilled = filteredRows.filter((r) => r.status === 'valide').reduce((sum, r) => sum + (r.billedHours || 0), 0);
  const totalGap = totalPointed - totalBilled;

  // Heures prévues (from planned shifts) & heures réelles (from check-in/check-out)
  const totalPlanned = filteredRows.reduce((sum, r) => {
    if (r.plannedStart && r.plannedEnd) {
      const [sh, sm] = r.plannedStart.split(':').map(Number);
      const [eh, em] = r.plannedEnd.split(':').map(Number);
      return sum + ((eh * 60 + em - (sh * 60 + sm)) / 60) - (r.breakHours || 0);
    }
    return sum;
  }, 0);
  const totalReal = filteredRows.reduce((sum, r) => {
    if (r.checkInTime && r.checkOutTime) {
      const diff = (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 3600000;
      return sum + Math.max(0, diff);
    }
    return sum;
  }, 0);

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
        status === 'valide' && billedHours != null ? billedHours : undefined,
      );
    } catch (err) {
      console.error('Failed to validate', err);
    }
    setShowDetail(false);
    setRefusalReason('');
    setBilledHours(null);
  };

  const handleQuickValidate = async () => {
    if (!quickRecord || !currentUser) return;
    const status = quickAction;
    try {
      await validateRecord(
        quickRecord.id,
        status,
        currentUser.id,
        status === 'refuse' ? quickRefusalReason : undefined,
        status === 'valide' && quickBilledHours != null ? quickBilledHours : undefined,
      );
    } catch (err) {
      console.error('Failed to validate', err);
    }
    setShowQuickValidate(false);
    setQuickRecord(null);
    setQuickBilledHours(null);
    setQuickRefusalReason('');
  };

  const openQuickValidate = (row: Attendance, action: 'valide' | 'refuse') => {
    setQuickRecord(row);
    setQuickAction(action);
    setQuickBilledHours(null);
    setQuickRefusalReason('');
    setShowQuickValidate(true);
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
      'GPS Entrée valide': r.checkInLocationValid === true ? 'Oui' : r.checkInLocationValid === false ? 'Non' : 'N/A',
      'GPS Sortie valide': r.checkOutLocationValid === true ? 'Oui' : r.checkOutLocationValid === false ? 'Non' : 'N/A',
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

    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const filterSuffix = dateFrom || dateTo ? `_${dateFrom || 'debut'}_${dateTo || 'fin'}` : '';
    XLSX.writeFile(wb, `Bipbip_Suivi_Heures_${dateStr}${filterSuffix}.xlsx`);
  }, [filteredRows, totalPointed, dateFrom, dateTo]);

  const exportToPdf = useCallback(() => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // ── Header band ──
    doc.setFillColor(27, 58, 92); // primary navy
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Bipbip - Suivi des Heures', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Filter summary line
    const filterParts: string[] = [];
    if (dateFrom || dateTo) filterParts.push(`Periode: ${dateFrom || '...'} au ${dateTo || '...'}`);
    if (filterAgent) filterParts.push(`Agent: ${filterAgent}`);
    if (filterClient) filterParts.push(`Client: ${filterClient}`);
    if (filterMission) filterParts.push(`Mission: ${filterMission}`);
    if (filterSite) filterParts.push(`Site: ${filterSite}`);
    const filterLine = filterParts.length > 0 ? filterParts.join(' | ') : 'Tous les pointages';
    doc.text(filterLine, 14, 20);

    // Generation date
    const now = new Date();
    doc.text(
      `Genere le ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} a ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      pageW - 14, 20, { align: 'right' },
    );

    doc.setTextColor(0, 0, 0);

    // ── Table ──
    const head = [[
      'Agent', 'Date', 'Mission', 'Client',
      'Entree prevue', 'Sortie prevue', 'Entree reelle', 'Sortie reelle',
      'H. Prevues', 'H. Reelles', 'Duree', 'H. Facturees',
      'GPS E', 'GPS S', 'Statut',
    ]];

    const body = filteredRows.map((r) => {
      let plannedH = '';
      if (r.plannedStart && r.plannedEnd) {
        const [sh, sm] = r.plannedStart.split(':').map(Number);
        const [eh, em] = r.plannedEnd.split(':').map(Number);
        plannedH = formatDuration(((eh * 60 + em - (sh * 60 + sm)) / 60) - (r.breakHours || 0));
      }
      let realH = '';
      if (r.checkInTime && r.checkOutTime) {
        realH = formatDuration(Math.max(0, (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 3600000));
      }
      const sLabel: Record<string, string> = { valide: 'Valide', en_attente: 'En attente', suspect: 'Suspect', refuse: 'Refuse' };

      return [
        r.agentName,
        formatDate(r.date),
        r.eventTitle,
        r.client,
        r.plannedStart || '-',
        r.plannedEnd || '-',
        r.checkInTime ? formatTime(r.checkInTime) : '-',
        r.checkOutTime ? formatTime(r.checkOutTime) : '-',
        plannedH || '-',
        realH || '-',
        r.hoursWorked ? formatDuration(r.hoursWorked) : '-',
        r.status === 'valide' && r.billedHours ? formatDuration(r.billedHours) : '-',
        r.checkInLocationValid === true ? 'OK' : r.checkInLocationValid === false ? 'Hors zone' : '-',
        r.checkOutLocationValid === true ? 'OK' : r.checkOutLocationValid === false ? 'Hors zone' : '-',
        sLabel[r.status] || r.status,
      ];
    });

    // Totals row
    body.push([
      `TOTAL (${filteredRows.length})`, '', '', '',
      '', '', '', '',
      formatDuration(totalPlanned), formatDuration(totalReal), formatDuration(totalPointed), formatDuration(totalBilled),
      '', '', '',
    ]);

    autoTable(doc, {
      startY: 30,
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [27, 58, 92], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 18 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 14 },
        5: { cellWidth: 14 },
        6: { cellWidth: 14 },
        7: { cellWidth: 14 },
        8: { cellWidth: 16 },
        9: { cellWidth: 16 },
        10: { cellWidth: 14 },
        11: { cellWidth: 16 },
        12: { cellWidth: 14 },
        13: { cellWidth: 14 },
        14: { cellWidth: 18 },
      },
      didParseCell: (data) => {
        // Style totals row
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
        // Color GPS cells
        if (data.section === 'body' && (data.column.index === 12 || data.column.index === 13)) {
          const val = String(data.cell.raw);
          if (val === 'Hors zone') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
          else if (val === 'OK') { data.cell.styles.textColor = [22, 163, 74]; }
        }
        // Color status
        if (data.section === 'body' && data.column.index === 14) {
          const val = String(data.cell.raw);
          if (val === 'Valide') data.cell.styles.textColor = [22, 163, 74];
          else if (val === 'Suspect') data.cell.styles.textColor = [234, 88, 12];
          else if (val === 'Refuse') data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    // ── Footer summary ──
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    if (finalY + 20 < doc.internal.pageSize.getHeight()) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `H. Prevues: ${formatDuration(totalPlanned)} | H. Reelles: ${formatDuration(totalReal)} | Duree pointee: ${formatDuration(totalPointed)} | H. Facturees: ${formatDuration(totalBilled)}`,
        14, finalY + 8,
      );
    }

    const d2 = new Date();
    const dateStr2 = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`;
    const filterSuffix2 = dateFrom || dateTo ? `_${dateFrom || 'debut'}_${dateTo || 'fin'}` : '';
    doc.save(`Bipbip_Suivi_Heures_${dateStr2}${filterSuffix2}.pdf`);
  }, [filteredRows, totalPlanned, totalReal, totalPointed, totalBilled, dateFrom, dateTo, filterAgent, filterClient, filterMission, filterSite]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Suivi des Heures"
        subtitle="Heures prévues vs réelles — photos & GPS — validation"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={exportToPdf}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-xl font-medium text-sm transition-colors"
            >
              <FileText size={16} />
              Exporter PDF
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-xl font-medium text-sm transition-colors"
            >
              <Download size={16} />
              Exporter Excel
            </button>
          </div>
        }
      />

      {/* Main tab toggle */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1 max-w-sm">
        {(['pointages', 'confirmations'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setAdminTab(tab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              adminTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'pointages' ? <Clock size={15} /> : <CalendarDays size={15} />}
            {tab === 'pointages' ? 'Pointages' : 'Récap mensuel'}
          </button>
        ))}
      </div>

      {/* ═══ CONFIRMATIONS TAB ═══ */}
      {adminTab === 'confirmations' && (
        <div className="space-y-5">
          {/* Month/year picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={summaryMonth}
              onChange={(e) => setSummaryMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {MONTHS_FR.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={summaryYear}
              onChange={(e) => setSummaryYear(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {Array.from({ length: 4 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {/* Summary counters */}
            {adminSummaries.length > 0 && (
              <div className="flex items-center gap-3 ml-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">
                    {adminSummaries.filter((s) => s.confirmedByAgent).length} confirmé{adminSummaries.filter((s) => s.confirmedByAgent).length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full">
                  <Clock size={13} className="text-amber-500" />
                  <span className="text-xs font-bold text-amber-600">
                    {adminSummaries.filter((s) => !s.confirmedByAgent).length} en attente
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Agents table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            {adminSummaries.length === 0 ? (
              <div className="py-16 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-slate-50 mb-3">
                  <CalendarDays size={28} className="text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Aucun agent actif trouvé</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Agent</th>
                    <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">H. Effectuées</th>
                    <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">H. Validées</th>
                    <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Confirmation</th>
                    <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date / Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {adminSummaries.map((s) => (
                    <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${
                      s.confirmedByAgent ? 'bg-emerald-50/20' : ''
                    }`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-black">
                            {s.agent?.firstName?.[0]}{s.agent?.lastName?.[0]}
                          </div>
                          <span className="font-semibold text-slate-800">{s.agent?.firstName} {s.agent?.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-slate-700">{formatDuration(s.totalHours)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-emerald-700">{formatDuration(s.validatedHours)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {s.confirmedByAgent ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-700">Confirmé</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full">
                            <Clock size={13} className="text-amber-500" />
                            <span className="text-xs font-bold text-amber-600">En attente</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.confirmedByAgent && s.confirmedAt ? (
                          <div>
                            <p className="text-xs text-slate-600 font-semibold">
                              {new Date(s.confirmedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                            {s.agentNote && (
                              <p className="text-xs text-slate-400 italic mt-0.5">"{s.agentNote}"</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ POINTAGES TAB ═══ */}
      {adminTab === 'pointages' && (<>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="H. Prévues" value={formatDuration(totalPlanned)} icon={Calendar} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatCard label="H. Réelles" value={formatDuration(totalReal)} icon={Clock} iconBg="bg-cyan-50" iconColor="text-cyan-600" />
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
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-w-[160px]"
          >
            <option value="">Tous les agents</option>
            {uniqueAgents.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-w-[160px]"
          >
            <option value="">Tous les clients</option>
            {uniqueClients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterMission}
            onChange={(e) => setFilterMission(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-w-[180px]"
          >
            <option value="">Toutes les missions</option>
            {uniqueMissions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-w-[200px]"
          >
            <option value="">Tous les sites</option>
            {uniqueSites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(dateFrom || dateTo || filterAgent || filterClient || filterMission || filterSite) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setFilterAgent(''); setFilterClient(''); setFilterMission(''); setFilterSite(''); }}
              className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table data-hours-table style={{ tableLayout: 'fixed', width: '100%' }} className="text-xs">
            <colgroup>
              {Object.entries(colWidths).map(([key, w]) => (
                <col key={key} style={{ width: `${w}%` }} />
              ))}
            </colgroup>
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
                  { key: 'totalPlanned', label: 'Total prévu', sortable: true },
                  { key: 'totalReal', label: 'Total réel', sortable: true },
                  { key: 'hoursWorked', label: 'Durée', sortable: true },
                  { key: 'billedHours', label: 'H. Facturées', sortable: true },
                  { key: 'gps', label: 'GPS', sortable: false },
                  { key: 'status', label: 'Statut', sortable: true },
                  { key: 'actions', label: 'Actions', sortable: false },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable ? toggleSort(col.key) : undefined}
                    className={`relative text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-2.5 select-none overflow-hidden ${col.sortable ? 'cursor-pointer hover:text-slate-700' : ''} ${col.key === 'actions' ? 'text-right' : ''}`}
                  >
                    <div className="flex items-center gap-1 truncate">
                      {col.label}
                      {col.sortable && (
                        <ArrowUpDown
                          size={12}
                          className={sortField === col.key ? 'text-primary-500' : 'text-slate-300'}
                        />
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => onResizeStart(col.key, e)}
                      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-primary-400/40 active:bg-primary-500/50 z-10"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const hasDelay = row.checkInTime && row.plannedStart && formatTime(row.checkInTime) > row.plannedStart;
                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-2.5 text-xs font-medium text-slate-900 truncate">
                      {row.agentName}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-slate-600 truncate">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-2 py-2.5 overflow-hidden">
                      <p className="text-xs text-slate-900 font-medium truncate">{row.eventTitle}</p>
                      <p className="text-[10px] text-slate-400 truncate">{row.client}</p>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-slate-500 truncate">
                      {row.plannedStart ? (
                        <span className="flex items-center gap-0.5">
                          <Clock size={11} className="text-blue-400 shrink-0" />
                          {row.plannedStart}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-slate-500 truncate">
                      {row.plannedEnd ? (
                        <span className="flex items-center gap-0.5">
                          <Clock size={11} className="text-blue-400 shrink-0" />
                          {row.plannedEnd}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 truncate">
                      {row.checkInTime ? (
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-semibold ${hasDelay ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {formatTime(row.checkInTime)}
                          </span>
                          {row.checkInPhotoUrl && <Camera size={11} className="text-emerald-400 shrink-0" />}
                        </div>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 truncate">
                      {row.checkOutTime ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-slate-900">
                            {formatTime(row.checkOutTime)}
                          </span>
                          {row.checkOutPhotoUrl && <Camera size={11} className="text-rose-400 shrink-0" />}
                        </div>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 text-xs font-semibold text-indigo-600 truncate">
                      {row.plannedStart && row.plannedEnd ? (() => {
                        const [sh, sm] = row.plannedStart!.split(':').map(Number);
                        const [eh, em] = row.plannedEnd!.split(':').map(Number);
                        return formatDuration((eh * 60 + em - (sh * 60 + sm)) / 60);
                      })() : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-xs font-semibold text-cyan-600 truncate">
                      {row.checkInTime && row.checkOutTime ? formatDuration(
                        Math.max(0, (new Date(row.checkOutTime).getTime() - new Date(row.checkInTime).getTime()) / 3600000)
                      ) : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-xs font-bold text-primary-600 truncate">
                      {row.hoursWorked ? formatDuration(row.hoursWorked) : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-xs font-semibold text-amber-600 truncate">
                      {row.status === 'valide' && row.billedHours ? formatDuration(row.billedHours) : '—'}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1">
                        <span title="Entrée" className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold ${
                          row.checkInLocationValid === true ? 'bg-emerald-100 text-emerald-700' :
                          row.checkInLocationValid === false ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-400'
                        }`}>E</span>
                        <span title="Sortie" className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold ${
                          row.checkOutLocationValid === true ? 'bg-emerald-100 text-emerald-700' :
                          row.checkOutLocationValid === false ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-400'
                        }`}>S</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1">
                        <StatusBadge status={row.status} />
                        {row.isSuspect && <AlertTriangle size={12} className="text-orange-500" />}
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => { setSelectedRecord(row); setShowDetail(true); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors"
                        >
                          <Eye size={13} /> Détails
                        </button>
                        {(row.status === 'en_attente' || row.status === 'suspect') && (
                          <>
                            <button
                              onClick={() => openQuickValidate(row, 'valide')}
                              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
                              title="Valider"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => openQuickValidate(row, 'refuse')}
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
                  <td colSpan={14} className="px-4 py-10 text-center text-xs text-slate-400">
                    Aucune donnée trouvée
                  </td>
                </tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-2 py-2.5 text-xs font-bold text-slate-900" colSpan={7}>
                    TOTAL ({filteredRows.length} pointage{filteredRows.length > 1 ? 's' : ''})
                  </td>
                  <td className="px-2 py-2.5 text-xs font-bold text-indigo-700 truncate">
                    {formatDuration(totalPlanned)}
                  </td>
                  <td className="px-2 py-2.5 text-xs font-bold text-cyan-700 truncate">
                    {formatDuration(totalReal)}
                  </td>
                  <td className="px-2 py-2.5 text-xs font-bold text-primary-700 truncate">
                    {formatDuration(totalPointed)}
                  </td>
                  <td className="px-2 py-2.5 text-xs font-bold text-amber-700 truncate">
                    {formatDuration(totalBilled)}
                  </td>
                  <td className="px-2 py-2.5" colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Quick validation popup */}
      <Modal
        isOpen={showQuickValidate}
        onClose={() => { setShowQuickValidate(false); setQuickRecord(null); setQuickBilledHours(null); setQuickRefusalReason(''); }}
        title={quickAction === 'valide' ? 'Valider le pointage' : 'Refuser le pointage'}
        size="md"
      >
        {quickRecord && (() => {
          const ev = events.find((e) => e.id === quickRecord.eventId);
          const ag = users.find((u) => u.id === quickRecord.agentId);
          const shForDate = ev?.shifts?.filter((s) => s.date === quickRecord.date) || [];
          const sh = shForDate.find((s) => s.agentId === quickRecord.agentId) || shForDate[0];

          let qPlanned = 0;
          if (sh?.startTime && sh?.endTime) {
            const [sH, sM] = sh.startTime.split(':').map(Number);
            const [eH, eM] = sh.endTime.split(':').map(Number);
            qPlanned = ((eH * 60 + eM - (sH * 60 + sM)) / 60) - (ev?.breakHours || 0);
          }
          let qReal = 0;
          if (quickRecord.checkInTime && quickRecord.checkOutTime) {
            qReal = Math.max(0, (new Date(quickRecord.checkOutTime).getTime() - new Date(quickRecord.checkInTime).getTime()) / 3600000);
          }
          const qWorked = quickRecord.hoursWorked || 0;

          let delayMin = 0;
          if (sh?.startTime && quickRecord.checkInTime) {
            const [pH2, pM2] = sh.startTime.split(':').map(Number);
            const ci = new Date(quickRecord.checkInTime);
            delayMin = ci.getHours() * 60 + ci.getMinutes() - (pH2 * 60 + pM2);
          }
          const isLate = delayMin > 0;

          const gpsInBad = quickRecord.checkInLocationValid === false;
          const gpsOutBad = quickRecord.checkOutLocationValid === false;
          const hasGpsIssue = gpsInBad || gpsOutBad;

          return (
            <div className="space-y-4">
              {/* Agent + Mission */}
              <div className="flex items-center gap-3 text-sm">
                <span className="font-bold text-slate-900">{ag ? `${ag.firstName} ${ag.lastName}` : 'Inconnu'}</span>
                <span className="text-slate-400">—</span>
                <span className="text-slate-600 break-words">{ev?.title || '—'}</span>
              </div>

              {/* Alerts: Late + GPS */}
              {(isLate || hasGpsIssue || quickRecord.isSuspect) && (
                <div className="flex flex-wrap gap-2">
                  {isLate && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                      <AlertTriangle size={12} />
                      Retard {delayMin >= 60 ? `${Math.floor(delayMin / 60)}h${String(delayMin % 60).padStart(2, '0')}` : `${delayMin} min`}
                    </span>
                  )}
                  {gpsInBad && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                      <MapPin size={12} /> Entrée hors zone
                    </span>
                  )}
                  {gpsOutBad && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                      <MapPin size={12} /> Sortie hors zone
                    </span>
                  )}
                  {quickRecord.isSuspect && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                      <AlertTriangle size={12} /> Suspect
                    </span>
                  )}
                </div>
              )}

              {/* Duration indicators */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-indigo-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-indigo-500 font-bold uppercase">H. Prévues</p>
                  <p className="text-lg font-bold text-indigo-700">{qPlanned > 0 ? formatDuration(qPlanned) : '—'}</p>
                </div>
                <div className="bg-cyan-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-cyan-500 font-bold uppercase">H. Réelles</p>
                  <p className="text-lg font-bold text-cyan-700">{qReal > 0 ? formatDuration(qReal) : '—'}</p>
                </div>
                <div className="bg-primary-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-primary-500 font-bold uppercase">Durée</p>
                  <p className="text-lg font-bold text-primary-700">{qWorked > 0 ? formatDuration(qWorked) : '—'}</p>
                </div>
              </div>

              {/* Billed hours chooser (only for validation) */}
              {quickAction === 'valide' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Heures à facturer</label>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {qPlanned > 0 && (
                      <button
                        type="button"
                        onClick={() => setQuickBilledHours(Math.round(qPlanned * 100) / 100)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          quickBilledHours != null && Math.abs(quickBilledHours - qPlanned) < 0.01
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        Prévues — {formatDuration(qPlanned)}
                      </button>
                    )}
                    {qReal > 0 && (
                      <button
                        type="button"
                        onClick={() => setQuickBilledHours(Math.round(qReal * 100) / 100)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          quickBilledHours != null && Math.abs(quickBilledHours - qReal) < 0.01
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
                        }`}
                      >
                        Réelles — {formatDuration(qReal)}
                      </button>
                    )}
                    {qWorked > 0 && Math.abs(qWorked - qReal) > 0.02 && (
                      <button
                        type="button"
                        onClick={() => setQuickBilledHours(Math.round(qWorked * 100) / 100)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          quickBilledHours != null && Math.abs(quickBilledHours - qWorked) < 0.01
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100'
                        }`}
                      >
                        Durée — {formatDuration(qWorked)}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={quickBilledHours ?? ''}
                      onChange={(e) => setQuickBilledHours(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-28 px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      placeholder="0.00"
                    />
                    <span className="text-xs text-slate-500">heures</span>
                    {quickBilledHours != null && (
                      <span className="text-sm font-bold text-primary-700 ml-1">= {formatDuration(quickBilledHours)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Refusal reason (only for refuse) */}
              {quickAction === 'refuse' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Motif de refus</label>
                  <textarea
                    value={quickRefusalReason}
                    onChange={(e) => setQuickRefusalReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                    placeholder="Indiquer un motif..."
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                {quickAction === 'valide' ? (
                  <button
                    onClick={handleQuickValidate}
                    disabled={quickBilledHours == null}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      quickBilledHours != null
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 size={16} /> Valider ({quickBilledHours != null ? formatDuration(quickBilledHours) : '—'})
                  </button>
                ) : (
                  <button
                    onClick={handleQuickValidate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-sm transition-all"
                  >
                    <XCircle size={16} /> Refuser
                  </button>
                )}
                <button
                  onClick={() => { setShowQuickValidate(false); setQuickRecord(null); setQuickBilledHours(null); setQuickRefusalReason(''); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Detail modal */}
      <Modal
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setRefusalReason(''); setBilledHours(null); }}
        title="Détail du pointage"
        size="xl"
      >
        {selectedRecord && (() => {
          const event = events.find((e) => e.id === selectedRecord.eventId);
          const agent = users.find((u) => u.id === selectedRecord.agentId);
          const shiftsForDate = event?.shifts?.filter((s) => s.date === selectedRecord.date) || [];
          const shift = shiftsForDate.find((s) => s.agentId === selectedRecord.agentId) || shiftsForDate[0];

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
                  <p className="text-sm font-semibold text-slate-900 mt-0.5 break-words">{event?.title || '—'}</p>
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
                {(() => {
                  // Compute delay (local time)
                  let delayMin = 0;
                  if (shift?.startTime && selectedRecord.checkInTime) {
                    const [ph, pm] = shift.startTime.split(':').map(Number);
                    const ci = new Date(selectedRecord.checkInTime);
                    const actualMin = ci.getHours() * 60 + ci.getMinutes();
                    delayMin = actualMin - (ph * 60 + pm);
                  }
                  const isLate = delayMin > 0;
                  const borderColor = isLate ? 'border-orange-200' : 'border-emerald-100';
                  const bgColor = isLate ? 'bg-orange-50/60' : 'bg-emerald-50/60';

                  return (
                    <div className={`${bgColor} border ${borderColor} rounded-xl p-4`}>
                      <h4 className={`text-xs font-bold uppercase mb-3 flex items-center gap-1.5 ${isLate ? 'text-orange-700' : 'text-emerald-700'}`}>
                        <Clock size={13} /> Horaires réels
                        {isLate && (
                          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">
                            <AlertTriangle size={11} />
                            Retard {delayMin >= 60 ? `${Math.floor(delayMin / 60)}h${String(delayMin % 60).padStart(2, '0')}` : `${delayMin} min`}
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-6">
                        <div>
                          <p className={`text-[10px] font-bold uppercase ${isLate ? 'text-orange-500' : 'text-emerald-500'}`}>Entrée</p>
                          <p className={`text-lg font-bold ${isLate ? 'text-orange-700' : 'text-emerald-700'}`}>
                            {selectedRecord.checkInTime ? formatTime(selectedRecord.checkInTime) : '—'}
                          </p>
                        </div>
                        <div className={isLate ? 'text-orange-300' : 'text-emerald-300'}>→</div>
                        <div>
                          <p className={`text-[10px] font-bold uppercase ${isLate ? 'text-orange-500' : 'text-emerald-500'}`}>Sortie</p>
                          <p className={`text-lg font-bold ${isLate ? 'text-orange-700' : 'text-emerald-700'}`}>
                            {selectedRecord.checkOutTime ? formatTime(selectedRecord.checkOutTime) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Duration indicators */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-indigo-600 font-medium">H. Prévues</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-0.5">
                    {shift?.startTime && shift?.endTime ? (() => {
                      const [sh, sm] = shift.startTime.split(':').map(Number);
                      const [eh, em] = shift.endTime.split(':').map(Number);
                      return formatDuration(((eh * 60 + em - (sh * 60 + sm)) / 60) - (event?.breakHours || 0));
                    })() : '—'}
                  </p>
                </div>
                <div className="bg-cyan-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-cyan-600 font-medium">H. Réelles</p>
                  <p className="text-2xl font-bold text-cyan-700 mt-0.5">
                    {selectedRecord.checkInTime && selectedRecord.checkOutTime
                      ? formatDuration(Math.max(0, (new Date(selectedRecord.checkOutTime).getTime() - new Date(selectedRecord.checkInTime).getTime()) / 3600000))
                      : '—'}
                  </p>
                </div>
                <div className="bg-primary-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-primary-600 font-medium">Durée travaillée</p>
                  <p className="text-2xl font-bold text-primary-700 mt-0.5">
                    {selectedRecord.hoursWorked != null ? formatDuration(selectedRecord.hoursWorked) : '—'}
                  </p>
                </div>
              </div>

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
                      <div className="rounded-xl overflow-hidden border border-slate-200 cursor-pointer" onClick={() => setLightboxUrl(selectedRecord.checkInPhotoUrl!)}>
                        <img src={selectedRecord.checkInPhotoUrl} alt="Entrée" className="w-full h-44 object-cover bg-slate-100" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <Clock size={12} /> {formatTime(selectedRecord.checkInTime!)}
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${selectedRecord.checkInLocationValid === true ? 'text-emerald-600' : selectedRecord.checkInLocationValid === false ? 'text-rose-600' : 'text-slate-500'}`}>
                          <MapPin size={12} />
                          {selectedRecord.checkInLocationValid === true ? 'GPS validé' : selectedRecord.checkInLocationValid === false ? 'Hors zone' : 'GPS non configuré'}
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
                      <div className="rounded-xl overflow-hidden border border-slate-200 cursor-pointer" onClick={() => setLightboxUrl(selectedRecord.checkOutPhotoUrl!)}>
                        <img src={selectedRecord.checkOutPhotoUrl} alt="Sortie" className="w-full h-44 object-cover bg-slate-100" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <Clock size={12} /> {formatTime(selectedRecord.checkOutTime!)}
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${selectedRecord.checkOutLocationValid === true ? 'text-emerald-600' : selectedRecord.checkOutLocationValid === false ? 'text-rose-600' : 'text-slate-500'}`}>
                          <MapPin size={12} />
                          {selectedRecord.checkOutLocationValid === true ? 'GPS validé' : selectedRecord.checkOutLocationValid === false ? 'Hors zone' : 'GPS non configuré'}
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

              {/* Work photos */}
              {(selectedRecord.photos || []).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <ImagePlus size={14} className="text-violet-500" /> Photos de travail
                    <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                      {selectedRecord.photos.length}
                    </span>
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {selectedRecord.photos.map((photo) => (
                      <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 cursor-pointer" onClick={() => setLightboxUrl(photo.photoUrl)}>
                        <img src={photo.photoUrl} alt="Travail" className="w-full h-24 object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                          <span className="text-[10px] text-white font-medium">
                            {new Date(photo.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {photo.caption && (
                            <span className="text-[9px] text-white/80 block truncate">{photo.caption}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation actions */}
              {(selectedRecord.status === 'en_attente' || selectedRecord.status === 'suspect') && (() => {
                // Compute planned & real hours for quick-pick
                let plannedHrs = 0;
                if (shift?.startTime && shift?.endTime) {
                  const [sh, sm] = shift.startTime.split(':').map(Number);
                  const [eh, em] = shift.endTime.split(':').map(Number);
                  plannedHrs = ((eh * 60 + em - (sh * 60 + sm)) / 60) - (event?.breakHours || 0);
                }
                let realHrs = 0;
                if (selectedRecord.checkInTime && selectedRecord.checkOutTime) {
                  realHrs = Math.max(0, (new Date(selectedRecord.checkOutTime).getTime() - new Date(selectedRecord.checkInTime).getTime()) / 3600000);
                }
                const workedHrs = selectedRecord.hoursWorked || 0;

                return (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    {/* Hours to bill chooser */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Heures à facturer pour cet agent
                      </label>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {plannedHrs > 0 && (
                          <button
                            type="button"
                            onClick={() => setBilledHours(Math.round(plannedHrs * 100) / 100)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              billedHours != null && Math.abs(billedHours - plannedHrs) < 0.01
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            H. Prévues — {formatDuration(plannedHrs)}
                          </button>
                        )}
                        {realHrs > 0 && (
                          <button
                            type="button"
                            onClick={() => setBilledHours(Math.round(realHrs * 100) / 100)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              billedHours != null && Math.abs(billedHours - realHrs) < 0.01
                                ? 'bg-cyan-600 text-white border-cyan-600'
                                : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
                            }`}
                          >
                            H. Réelles — {formatDuration(realHrs)}
                          </button>
                        )}
                        {workedHrs > 0 && Math.abs(workedHrs - realHrs) > 0.02 && (
                          <button
                            type="button"
                            onClick={() => setBilledHours(Math.round(workedHrs * 100) / 100)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              billedHours != null && Math.abs(billedHours - workedHrs) < 0.01
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100'
                            }`}
                          >
                            Durée travaillée — {formatDuration(workedHrs)}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={billedHours ?? ''}
                          onChange={(e) => setBilledHours(e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-32 px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          placeholder="0.00"
                        />
                        <span className="text-xs text-slate-500">heures (personnalisé)</span>
                        {billedHours != null && (
                          <span className="text-sm font-bold text-primary-700 ml-2">
                            = {formatDuration(billedHours)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Refusal reason */}
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

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleValidate('valide')}
                        disabled={billedHours == null}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                          billedHours != null
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle2 size={16} /> Valider ({billedHours != null ? formatDuration(billedHours) : '—'})
                      </button>
                      <button
                        onClick={() => handleValidate('refuse')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-sm transition-all"
                      >
                        <XCircle size={16} /> Refuser
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </Modal>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <a
              href={lightboxUrl}
              download={`photo-${Date.now()}.jpg`}
              onClick={(e) => e.stopPropagation()}
              className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
            >
              <Download size={20} className="text-white" />
            </a>
            <button
              className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
              onClick={() => setLightboxUrl(null)}
            >
              <XCircle size={24} className="text-white" />
            </button>
          </div>
          <img
            src={lightboxUrl}
            alt="Agrandie"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      </>)}
    </div>
  );
}
