import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import { useClientStore } from '../../store/clientStore';
import { usePaymentStore, type AgentPaymentEntry } from '../../store/paymentStore';
import PageHeader from '../../components/common/PageHeader';
import { formatDuration } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import {
  Users,
  Building2,
  Calendar,
  Filter,
  TrendingUp,
  DollarSign,
  Clock,
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ArrowUpDown,
  Table2,
  CheckCircle2,
  AlertTriangle,
  History,
  Plus,
  Trash2,
  Banknote,
} from 'lucide-react';

type TabView = 'tableau' | 'agents' | 'clients';
type SortField = 'name' | 'hours' | 'total';
type SortDir = 'asc' | 'desc';

export default function Recap() {
  const navigate = useNavigate();
  const { records, fetchRecords } = useAttendanceStore();
  const { events, fetchEvents } = useEventStore();
  const { users, fetchUsers } = useAuthStore();
  const { clients, fetchClients } = useClientStore();
  const { payments, fetchPayments, addPayment, deletePayment, fetchAgentPayments } = usePaymentStore();

  useEffect(() => {
    fetchRecords();
    fetchEvents();
    fetchUsers();
    fetchClients();
  }, [fetchRecords, fetchEvents, fetchUsers, fetchClients]);

  // Date range filter — default: current month
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [tab, setTab] = useState<TabView>('tableau');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [txHoraire, setTxHoraire] = useState(8.75);

  // Fetch payments when period changes
  useEffect(() => {
    fetchPayments(startDate, endDate);
  }, [startDate, endDate, fetchPayments]);

  // ─── Payment history modal state ─────────────────
  const [historyModalAgent, setHistoryModalAgent] = useState<string | null>(null);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentNote, setNewPaymentNote] = useState('');
  const [newPaymentType, setNewPaymentType] = useState<'virement' | 'acompte'>('virement');
  const [agentAllPayments, setAgentAllPayments] = useState<AgentPaymentEntry[]>([]);

  // Computed agentPayments from DB data (for the current period)
  const agentPayments = useMemo(() => {
    const result: Record<string, { virementFait: number; acompte: number }> = {};
    for (const p of payments) {
      if (!result[p.agentId]) result[p.agentId] = { virementFait: 0, acompte: 0 };
      if (p.type === 'virement') result[p.agentId].virementFait += p.amount;
      else if (p.type === 'acompte') result[p.agentId].acompte += p.amount;
    }
    return result;
  }, [payments]);

  // Open history modal — fetch all payments for this agent
  const openHistoryModal = useCallback(async (agentId: string) => {
    setHistoryModalAgent(agentId);
    setNewPaymentType('virement');
    const all = await fetchAgentPayments(agentId);
    setAgentAllPayments(all);
  }, [fetchAgentPayments]);

  const handleAddPayment = useCallback(async (agentId: string) => {
    const amount = parseFloat(newPaymentAmount);
    if (!amount || amount <= 0) return;
    await addPayment({
      agentId,
      type: newPaymentType,
      amount,
      date: new Date().toISOString().slice(0, 10),
      periodStart: startDate,
      periodEnd: endDate,
      note: newPaymentNote.trim() || undefined,
    });
    setNewPaymentAmount('');
    setNewPaymentNote('');
    // Refresh agent all payments for modal
    const all = await fetchAgentPayments(agentId);
    setAgentAllPayments(all);
    // Refresh period payments
    fetchPayments(startDate, endDate);
  }, [newPaymentAmount, newPaymentType, newPaymentNote, startDate, endDate, addPayment, fetchAgentPayments, fetchPayments]);

  const handleDeletePayment = useCallback(async (agentId: string, paymentId: string) => {
    await deletePayment(paymentId);
    const all = await fetchAgentPayments(agentId);
    setAgentAllPayments(all);
    fetchPayments(startDate, endDate);
  }, [deletePayment, fetchAgentPayments, fetchPayments, startDate, endDate]);

  const getAgentHistoryForPeriod = useCallback((agentId: string) => {
    return agentAllPayments
      .filter((e) => e.agentId === agentId && e.periodStart === startDate && e.periodEnd === endDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [agentAllPayments, startDate, endDate]);

  const getAgentAllHistory = useCallback((agentId: string): AgentPaymentEntry[] => {
    return agentAllPayments
      .filter((e) => e.agentId === agentId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [agentAllPayments]);

  // Filter records by date range
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const d = r.date.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [records, startDate, endDate]);

  // Only validated records
  const validatedRecords = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'valide');
  }, [filteredRecords]);

  // ─── Agent helpers ─────────────────────────────────
  const getAgentName = (agentId: string) => {
    const u = users.find((u) => u.id === agentId);
    return u ? `${u.firstName} ${u.lastName}`.toUpperCase() : agentId;
  };

  const getAgentFirstName = (agentId: string) => {
    const u = users.find((u) => u.id === agentId);
    return u ? u.firstName.toUpperCase() : agentId;
  };

  // ─── Tableau rows (like the Excel Tableau sheet) ──
  const tableauRows = useMemo(() => {
    const rows = filteredRecords.map((rec) => {
      const evt = events.find((e) => e.id === rec.eventId);
      const agent = users.find((u) => u.id === rec.agentId);
      const dayNum = parseInt(rec.date.slice(8, 10), 10);

      // Parse check-in / check-out times
      let checkInStr = '';
      let checkOutStr = '';
      if (rec.checkInTime) {
        const d = new Date(rec.checkInTime);
        checkInStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      if (rec.checkOutTime) {
        const d = new Date(rec.checkOutTime);
        checkOutStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      // Total heures formatted as H:MM
      const hw = rec.hoursWorked || 0;
      const totalH = Math.floor(hw);
      const totalM = Math.round((hw - totalH) * 60);
      const totalStr = hw > 0 ? `${totalH}:${String(totalM).padStart(2, '0')}` : '';

      // Heures validées
      const validatedHours = rec.status === 'valide' ? hw : 0;
      const valH = Math.floor(validatedHours);
      const valM = Math.round((validatedHours - valH) * 60);
      const validatedStr = rec.status === 'valide' && validatedHours > 0
        ? `${valH}:${String(valM).padStart(2, '0')}`
        : '';

      return {
        id: rec.id,
        day: dayNum,
        agentId: rec.agentId,
        agentName: agent ? agent.firstName.toUpperCase() : rec.agentId,
        agentFullName: agent ? `${agent.firstName} ${agent.lastName}`.toUpperCase() : rec.agentId,
        client: evt?.client || 'Sans client',
        checkIn: checkInStr,
        checkOut: checkOutStr,
        totalStr,
        validatedStr,
        hoursWorked: hw,
        validatedHours,
        status: rec.status,
        isSuspect: rec.isSuspect,
      };
    });

    // Sort by agent name first, then by day
    rows.sort((a, b) => {
      const nameComp = a.agentName.localeCompare(b.agentName);
      if (nameComp !== 0) return nameComp;
      return a.day - b.day;
    });

    return rows;
  }, [filteredRecords, events, users]);

  // ─── Grouped tableau by agent ─────────────────────
  const tableauGrouped = useMemo(() => {
    const groups: {
      agentId: string;
      agentName: string;
      agentFullName: string;
      rows: typeof tableauRows;
      totalHours: number;
      validatedHours: number;
      hasPendingShifts: boolean;
    }[] = [];

    const agentMap = new Map<string, typeof tableauRows>();
    for (const row of tableauRows) {
      const key = row.agentId;
      if (!agentMap.has(key)) agentMap.set(key, []);
      agentMap.get(key)!.push(row);
    }

    // Check which agents have pending shifts in events within the date range
    const filteredEvents = events.filter((evt) => {
      return evt.startDate <= endDate && evt.endDate >= startDate;
    });

    for (const [agentId, rows] of agentMap) {
      const totalHours = rows.reduce((s, r) => s + r.hoursWorked, 0);
      const validatedHours = rows.reduce((s, r) => s + r.validatedHours, 0);

      // Check if this agent has pending confirmations on any event in range
      const hasPendingShifts = filteredEvents.some((evt) => {
        if (!evt.agentResponses) return false;
        const response = evt.agentResponses[agentId];
        return response === 'pending';
      });

      groups.push({
        agentId,
        agentName: rows[0].agentName,
        agentFullName: rows[0].agentFullName,
        rows,
        totalHours,
        validatedHours,
        hasPendingShifts,
      });
    }

    // Sort groups by agent name
    groups.sort((a, b) => a.agentName.localeCompare(b.agentName));
    return groups;
  }, [tableauRows, events, startDate, endDate]);

  // ─── Récap Agents ─────────────────────────────────
  const agentRecap = useMemo(() => {
    const map = new Map<string, {
      agentId: string;
      totalHours: number;
      validatedHours: number;
      totalRecords: number;
      validatedRecords: number;
      pendingRecords: number;
      suspectRecords: number;
      virement: number; // Σ(hours × event.hourlyRate)
    }>();

    // Get all agents (including those with 0 hours)
    const agentUsers = users.filter((u) => u.role === 'agent');
    for (const agent of agentUsers) {
      map.set(agent.id, {
        agentId: agent.id,
        totalHours: 0,
        validatedHours: 0,
        totalRecords: 0,
        validatedRecords: 0,
        pendingRecords: 0,
        suspectRecords: 0,
        virement: 0,
      });
    }

    for (const rec of filteredRecords) {
      let entry = map.get(rec.agentId);
      if (!entry) {
        entry = {
          agentId: rec.agentId,
          totalHours: 0,
          validatedHours: 0,
          totalRecords: 0,
          validatedRecords: 0,
          pendingRecords: 0,
          suspectRecords: 0,
          virement: 0,
        };
        map.set(rec.agentId, entry);
      }
      const hw = rec.hoursWorked || 0;
      entry.totalRecords++;
      entry.totalHours += hw;
      if (rec.status === 'valide') {
        entry.validatedRecords++;
        entry.validatedHours += hw;
      }
      if (rec.status === 'en_attente') entry.pendingRecords++;
      if (rec.isSuspect) entry.suspectRecords++;

      // Virement = Σ(heures travaillées × prix unitaire HT de l'événement)
      const evt = events.find((e) => e.id === rec.eventId);
      const rate = evt?.hourlyRate || 0;
      entry.virement += hw * rate;
    }

    const arr = Array.from(map.values()).filter(
      (a) => a.totalRecords > 0 || users.find((u) => u.id === a.agentId)?.isActive
    );

    // Sort
    arr.sort((a, b) => {
      if (sortField === 'name') {
        const na = getAgentName(a.agentId);
        const nb = getAgentName(b.agentId);
        return sortDir === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na);
      }
      if (sortField === 'hours') {
        return sortDir === 'asc'
          ? a.totalHours - b.totalHours
          : b.totalHours - a.totalHours;
      }
      return 0;
    });

    return arr;
  }, [filteredRecords, users, events, sortField, sortDir]);

  // ─── Récap Clients ─────────────────────────────────
  const clientRecap = useMemo(() => {
    // Group records by event's client
    const map = new Map<string, {
      client: string;
      totalHours: number;
      validatedHours: number;
      hourlyRate: number;
      totalHT: number;
      totalTTC: number;
      totalRecords: number;
      validatedRecords: number;
    }>();

    for (const rec of filteredRecords) {
      const evt = events.find((e) => e.id === rec.eventId);
      const clientName = evt?.client || 'Sans client';
      const hourlyRate = evt?.hourlyRate || 0;

      let entry = map.get(clientName);
      if (!entry) {
        entry = {
          client: clientName,
          totalHours: 0,
          validatedHours: 0,
          hourlyRate,
          totalHT: 0,
          totalTTC: 0,
          totalRecords: 0,
          validatedRecords: 0,
        };
        map.set(clientName, entry);
      }

      const hw = rec.hoursWorked || 0;
      entry.totalRecords++;
      entry.totalHours += hw;
      if (rec.status === 'valide') {
        entry.validatedRecords++;
        entry.validatedHours += hw;
      }
      // Use the highest hourlyRate if multiple events have the same client
      if (hourlyRate > entry.hourlyRate) entry.hourlyRate = hourlyRate;
    }

    // Calculate totals
    for (const entry of map.values()) {
      entry.totalHT = entry.validatedHours * entry.hourlyRate;
      entry.totalTTC = entry.totalHT * 1.2; // TVA 20%
    }

    const arr = Array.from(map.values());

    // Sort
    arr.sort((a, b) => {
      if (sortField === 'name') {
        return sortDir === 'asc' ? a.client.localeCompare(b.client) : b.client.localeCompare(a.client);
      }
      if (sortField === 'hours') {
        return sortDir === 'asc' ? a.totalHours - b.totalHours : b.totalHours - a.totalHours;
      }
      if (sortField === 'total') {
        return sortDir === 'asc' ? a.totalHT - b.totalHT : b.totalHT - a.totalHT;
      }
      return 0;
    });

    return arr;
  }, [filteredRecords, events, sortField, sortDir]);

  // ─── Summary stats ─────────────────────────────────
  const totalAgentHours = agentRecap.reduce((s, a) => s + a.totalHours, 0);
  const totalValidatedHours = agentRecap.reduce((s, a) => s + a.validatedHours, 0);
  const totalHT = clientRecap.reduce((s, c) => s + c.totalHT, 0);
  const totalTTC = clientRecap.reduce((s, c) => s + c.totalTTC, 0);
  const totalVirements = agentRecap.reduce((s, a) => s + a.virement, 0);
  const totalSalaires = totalValidatedHours * txHoraire;
  const ratioMarge = totalHT > 0 ? ((totalHT - totalSalaires) / totalHT * 100) : 0;

  // Month label for column header (e.g. "TOTAL MARS")
  const monthLabel = (() => {
    const months = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
    const sd = new Date(startDate);
    return months[sd.getMonth()];
  })();

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      size={12}
      className={`inline ml-1 ${sortField === field ? 'text-primary-600' : 'text-slate-300'}`}
    />
  );

  // ─── Period label ──────────────────────────────────
  const periodLabel = (() => {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const sd = new Date(startDate);
    const ed = new Date(endDate);
    if (sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear()) {
      return `${months[sd.getMonth()]} ${sd.getFullYear()}`;
    }
    return `${startDate} → ${endDate}`;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Récapitulatif"
        subtitle={periodLabel}
      />

      {/* Date filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Période :</span>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Date début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Date fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            {/* Quick period buttons */}
            {[
              { label: 'Ce mois', start: defaultStart, end: defaultEnd },
              {
                label: 'Mois dernier',
                start: (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.toISOString().slice(0, 10); })(),
                end: (() => { const d = new Date(now.getFullYear(), now.getMonth(), 0); return d.toISOString().slice(0, 10); })(),
              },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => { setStartDate(p.start); setEndDate(p.end); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  startDate === p.start && endDate === p.end
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="ml-auto text-xs text-slate-400">
            {filteredRecords.length} pointages · {validatedRecords.length} validés
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <Clock size={18} className="mx-auto text-primary-500 mb-1" />
          <p className="text-xs text-slate-400">Heures totales</p>
          <p className="text-lg font-bold text-slate-900">{formatDuration(totalAgentHours)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <Clock size={18} className="mx-auto text-emerald-500 mb-1" />
          <p className="text-xs text-slate-400">Heures validées</p>
          <p className="text-lg font-bold text-emerald-600">{formatDuration(totalValidatedHours)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <DollarSign size={18} className="mx-auto text-blue-500 mb-1" />
          <p className="text-xs text-slate-400">Total HT</p>
          <p className="text-lg font-bold text-blue-600">{totalHT.toFixed(2)} €</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <DollarSign size={18} className="mx-auto text-indigo-500 mb-1" />
          <p className="text-xs text-slate-400">Total TTC</p>
          <p className="text-lg font-bold text-indigo-600">{totalTTC.toFixed(2)} €</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <TrendingUp size={18} className="mx-auto text-amber-500 mb-1" />
          <p className="text-xs text-slate-400">Dépense salaires</p>
          <p className="text-lg font-bold text-amber-600">{totalSalaires.toFixed(2)} €</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <BarChart3 size={18} className="mx-auto text-violet-500 mb-1" />
          <p className="text-xs text-slate-400">Marge brute</p>
          <p className={`text-lg font-bold ${ratioMarge >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {ratioMarge.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 w-fit">
        <button
          onClick={() => setTab('tableau')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'tableau'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Table2 size={16} /> Tableau
        </button>
        {/* Récap agents et clients masqués temporairement
        <button
          onClick={() => setTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'agents'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Users size={16} /> Récap agents
        </button>
        <button
          onClick={() => setTab('clients')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'clients'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Building2 size={16} /> Récap clients
        </button>
        */}
      </div>

      {/* ─── Tableau (grouped by agent) ─────────────── */}
      {tab === 'tableau' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-center px-3 py-3 font-semibold text-xs w-16">Jour</th>
                  <th className="text-left px-3 py-3 font-semibold text-xs">Agents</th>
                  <th className="text-left px-3 py-3 font-semibold text-xs">Client/SITE</th>
                  <th className="text-center px-3 py-3 font-semibold text-xs">Heures Début</th>
                  <th className="text-center px-3 py-3 font-semibold text-xs">Heures Fin</th>
                  <th className="text-center px-3 py-3 font-semibold text-xs">Total Heures</th>
                  <th className="text-center px-3 py-3 font-semibold text-xs">Heures VALIDE</th>
                </tr>
              </thead>
              <tbody>
                {tableauGrouped.map((group) => {
                  const totalH = Math.floor(group.totalHours);
                  const totalM = Math.round((group.totalHours - totalH) * 60);
                  const totalStr = `${totalH}:${String(totalM).padStart(2, '0')}`;
                  const valH = Math.floor(group.validatedHours);
                  const valM = Math.round((group.validatedHours - valH) * 60);
                  const valStr = `${valH}:${String(valM).padStart(2, '0')}`;

                  return (
                    <React.Fragment key={group.agentId}>
                      {/* Agent group header */}
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <td colSpan={7} className="px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                              {group.agentName.slice(0, 2)}
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{group.agentName}</span>
                            <span className="text-xs text-slate-400">({group.rows.length} pointage{group.rows.length > 1 ? 's' : ''})</span>
                            {group.hasPendingShifts && (
                              <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                <AlertTriangle size={12} />
                                Veuillez confirmer ces créneaux
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Agent rows */}
                      {group.rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-50 hover:bg-blue-50/40 transition-colors cursor-pointer"
                          onDoubleClick={() => navigate('/admin/pointage')}
                          title="Double-cliquez pour valider ce pointage"
                        >
                          <td className="px-3 py-2 text-center">
                            <span className="font-bold text-slate-600 text-xs">{row.day}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-slate-500 text-xs">{row.agentName}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                              <span className="text-slate-700 font-medium">{row.client}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.checkIn ? (
                              <span className="font-mono text-slate-700">{row.checkIn}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.checkOut ? (
                              <span className="font-mono text-slate-700">{row.checkOut}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.totalStr ? (
                              <span className="font-mono font-semibold text-slate-900">{row.totalStr}</span>
                            ) : (
                              <span className="text-slate-300">0:00</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.validatedStr ? (
                              <span className="font-mono font-bold text-emerald-600 flex items-center justify-center gap-1">
                                {row.validatedStr}
                                <CheckCircle2 size={12} className="text-emerald-500" />
                              </span>
                            ) : row.status === 'en_attente' ? (
                              <span className="text-xs text-amber-500 italic">en attente</span>
                            ) : row.status === 'refuse' ? (
                              <span className="text-xs text-rose-500 italic">refusé</span>
                            ) : row.status === 'suspect' ? (
                              <span className="text-xs text-orange-500 italic flex items-center justify-center gap-1">
                                <AlertTriangle size={11} /> suspect
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* Agent subtotal row */}
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <td colSpan={5} className="px-3 py-2 text-right">
                          <span className="text-xs font-bold text-slate-500 uppercase">
                            Total {group.agentName}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="font-mono font-bold text-slate-800">{totalStr}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="font-mono font-bold text-emerald-600">{valStr}</span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {tableauGrouped.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      Aucun pointage sur cette période
                    </td>
                  </tr>
                )}
              </tbody>
              {tableauRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-800 text-white font-bold">
                    <td className="px-3 py-3" colSpan={2}>
                      TOTAL ({tableauGrouped.length} agents · {tableauRows.length} lignes)
                    </td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-center font-mono">
                      {(() => {
                        const total = tableauRows.reduce((s, r) => s + r.hoursWorked, 0);
                        const h = Math.floor(total);
                        const m = Math.round((total - h) * 60);
                        return `${h}:${String(m).padStart(2, '0')}`;
                      })()}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-emerald-300">
                      {(() => {
                        const total = tableauRows.reduce((s, r) => s + r.validatedHours, 0);
                        const h = Math.floor(total);
                        const m = Math.round((total - h) * 60);
                        return `${h}:${String(m).padStart(2, '0')}`;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ─── Récap Agents table ───────────────────── */}
      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th
                      className="text-left px-4 py-3 font-semibold text-xs cursor-pointer hover:text-blue-200"
                      onClick={() => toggleSort('name')}
                    >
                      Agent <SortIcon field="name" />
                    </th>
                    <th
                      className="text-center px-4 py-3 font-semibold text-xs cursor-pointer hover:text-blue-200"
                      onClick={() => toggleSort('hours')}
                    >
                      Heures totales agents <SortIcon field="hours" />
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-xs">TOTAL {monthLabel}</th>
                    <th className="text-center px-4 py-3 font-semibold text-xs">VIREMENT FAIT</th>
                    <th className="text-center px-4 py-3 font-semibold text-xs">ACOMPTE</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs">RESTE</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRecap.map((agent, idx) => {
                    const pay = agentPayments[agent.agentId] || { virementFait: 0, acompte: 0 };
                    const totalMois = agent.virement; // Σ(heures × prix unitaire HT par événement)
                    const reste = totalMois - pay.virementFait - pay.acompte;
                    return (
                      <tr
                        key={agent.agentId}
                        className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/20'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-900 text-xs uppercase">
                            {getAgentName(agent.agentId)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                          {agent.totalHours > 0 ? agent.totalHours.toFixed(1) : '0'}
                        </td>
                        <td className="px-4 py-2.5 text-center font-medium text-slate-700">
                          {totalMois > 0 ? `${totalMois.toFixed(2)} €` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-center font-medium text-slate-700">
                          {pay.virementFait > 0 ? `${pay.virementFait.toFixed(2)} €` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center font-medium text-slate-700">
                          {pay.acompte > 0 ? `${pay.acompte.toFixed(2)} €` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`font-bold ${
                              reste > 0 ? 'text-rose-600' : reste < 0 ? 'text-amber-600' : 'text-slate-400'
                            }`}>
                              {reste !== 0 ? `${reste.toFixed(2)} €` : '- €'}
                            </span>
                            <button
                              onClick={() => openHistoryModal(agent.agentId)}
                              className="p-1 rounded-md text-slate-400 hover:bg-primary-100 hover:text-primary-600 transition-colors"
                              title="Historique virements"
                            >
                              <History size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {agentRecap.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                        Aucun agent trouvé
                      </td>
                    </tr>
                  )}
                </tbody>
                {agentRecap.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#1e3a5f] text-white font-bold">
                      <td className="px-4 py-3 text-xs">
                        TOTAL ({agentRecap.length} agents)
                      </td>
                      <td className="px-4 py-3 text-center">
                        {totalAgentHours.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {totalVirements.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-center">
                        {agentRecap.reduce((s, a) => s + (agentPayments[a.agentId]?.virementFait || 0), 0).toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-center">
                        {agentRecap.reduce((s, a) => s + (agentPayments[a.agentId]?.acompte || 0), 0).toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const totalReste = agentRecap.reduce((s, a) => {
                            const p = agentPayments[a.agentId] || { virementFait: 0, acompte: 0 };
                            return s + (a.virement - p.virementFait - p.acompte);
                          }, 0);
                          return `${totalReste.toFixed(2)} €`;
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Sidebar KPI cards — matching Excel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-yellow-50 rounded-xl border-2 border-yellow-300 p-4">
              <p className="text-xs text-yellow-600 font-bold uppercase">TOTAL SALAIRES</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">
                {totalVirements.toFixed(2)} €
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-bold uppercase">TOTAL HEURES</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {totalAgentHours.toFixed(1)}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-xl border-2 border-yellow-300 p-4">
              <p className="text-xs text-yellow-600 font-bold uppercase">TX HORAIRES</p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={txHoraire}
                  onChange={(e) => setTxHoraire(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-lg font-bold border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none text-center bg-white"
                />
                <span className="text-lg font-bold text-yellow-700">€</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Récap Clients table ──────────────────── */}
      {tab === 'clients' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th
                      className="text-left px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:text-primary-600"
                      onClick={() => toggleSort('name')}
                    >
                      Client / Site <SortIcon field="name" />
                    </th>
                    <th
                      className="text-right px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:text-primary-600"
                      onClick={() => toggleSort('hours')}
                    >
                      Heures totales <SortIcon field="hours" />
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-700">Heures validées</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-700">Prix unitaire HT</th>
                    <th
                      className="text-right px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:text-primary-600"
                      onClick={() => toggleSort('total')}
                    >
                      Total HT <SortIcon field="total" />
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-700">Total TTC</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-700">Pointages</th>
                  </tr>
                </thead>
                <tbody>
                  {clientRecap.map((c, idx) => (
                    <tr
                      key={c.client}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        idx % 2 === 0 ? '' : 'bg-slate-25'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-slate-900">{c.client}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatDuration(c.totalHours)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                        {formatDuration(c.validatedHours)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {c.hourlyRate > 0 ? `${c.hourlyRate.toFixed(2)} €` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">
                        {c.totalHT > 0 ? `${c.totalHT.toFixed(2)} €` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-indigo-600">
                        {c.totalTTC > 0 ? `${c.totalTTC.toFixed(2)} €` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{c.totalRecords}</td>
                    </tr>
                  ))}

                  {clientRecap.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                        Aucun pointage sur cette période
                      </td>
                    </tr>
                  )}
                </tbody>
                {clientRecap.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                      <td className="px-4 py-3 text-slate-700">
                        TOTAL ({clientRecap.length} clients)
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {formatDuration(clientRecap.reduce((s, c) => s + c.totalHours, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {formatDuration(clientRecap.reduce((s, c) => s + c.validatedHours, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">—</td>
                      <td className="px-4 py-3 text-right text-blue-600">{totalHT.toFixed(2)} €</td>
                      <td className="px-4 py-3 text-right text-indigo-600">{totalTTC.toFixed(2)} €</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {clientRecap.reduce((s, c) => s + c.totalRecords, 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Financial summary sidebar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-blue-500 font-medium">TOTAL FACTURES HT</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{totalHT.toFixed(2)} €</p>
            </div>
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
              <p className="text-xs text-indigo-500 font-medium">TOTAL FACTURES TTC</p>
              <p className="text-xl font-bold text-indigo-700 mt-1">{totalTTC.toFixed(2)} €</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-amber-500 font-medium">DÉPENSE SALAIRES</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{totalSalaires.toFixed(2)} €</p>
              <p className="text-[10px] text-amber-400 mt-0.5">TX horaire : 8.75 €/h</p>
            </div>
            <div className={`rounded-xl border p-4 ${ratioMarge >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <p className={`text-xs font-medium ${ratioMarge >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>RESTE BRUT</p>
              <p className={`text-xl font-bold mt-1 ${ratioMarge >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {(totalHT - totalSalaires).toFixed(2)} €
              </p>
              <p className={`text-[10px] mt-0.5 ${ratioMarge >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Marge : {ratioMarge.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Historique Virements / Acomptes ──── */}
      {historyModalAgent != null && (
        <HistoryModal
          agentId={historyModalAgent!}
          agentName={getAgentName(historyModalAgent!)}
          allEntries={getAgentAllHistory(historyModalAgent!)}
          periodEntries={getAgentHistoryForPeriod(historyModalAgent!)}
          onClose={() => { setHistoryModalAgent(null); setNewPaymentAmount(''); setNewPaymentNote(''); }}
          newPaymentAmount={newPaymentAmount}
          setNewPaymentAmount={setNewPaymentAmount}
          newPaymentNote={newPaymentNote}
          setNewPaymentNote={setNewPaymentNote}
          newPaymentType={newPaymentType}
          setNewPaymentType={setNewPaymentType}
          onAddEntry={() => handleAddPayment(historyModalAgent!)}
          onRemoveEntry={(entryId) => handleDeletePayment(historyModalAgent!, entryId)}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
}

// ─── Sub-component to avoid IIFE/TS narrowing issues ───
function HistoryModal({
  agentId, agentName, allEntries, periodEntries,
  onClose, newPaymentAmount, setNewPaymentAmount,
  newPaymentNote, setNewPaymentNote, newPaymentType, setNewPaymentType,
  onAddEntry, onRemoveEntry, startDate, endDate,
}: {
  agentId: string;
  agentName: string;
  allEntries: AgentPaymentEntry[];
  periodEntries: AgentPaymentEntry[];
  onClose: () => void;
  newPaymentAmount: string;
  setNewPaymentAmount: (v: string) => void;
  newPaymentNote: string;
  setNewPaymentNote: (v: string) => void;
  newPaymentType: 'virement' | 'acompte';
  setNewPaymentType: (v: 'virement' | 'acompte') => void;
  onAddEntry: () => void;
  onRemoveEntry: (entryId: string) => void;
  startDate: string;
  endDate: string;
}) {
  const totalVirPeriod = periodEntries.filter((e) => e.type === 'virement').reduce((s, e) => s + e.amount, 0);
  const totalAccPeriod = periodEntries.filter((e) => e.type === 'acompte').reduce((s, e) => s + e.amount, 0);
  const totalVirAll = allEntries.filter((e) => e.type === 'virement').reduce((s, e) => s + e.amount, 0);
  const totalAccAll = allEntries.filter((e) => e.type === 'acompte').reduce((s, e) => s + e.amount, 0);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`💸 Historique — ${agentName}`}
      size="lg"
    >
      <div className="space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
            <p className="text-[10px] text-emerald-500 font-semibold uppercase">Virements (période)</p>
            <p className="text-lg font-bold text-emerald-700">{totalVirPeriod.toFixed(2)} €</p>
          </div>
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 text-center">
            <p className="text-[10px] text-amber-500 font-semibold uppercase">Acomptes (période)</p>
            <p className="text-lg font-bold text-amber-700">{totalAccPeriod.toFixed(2)} €</p>
          </div>
        </div>

        {/* Add new payment */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
            <Plus size={14} /> Ajouter un paiement
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Type</label>
              <select
                value={newPaymentType}
                onChange={(e) => setNewPaymentType(e.target.value as 'virement' | 'acompte')}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              >
                <option value="virement">Virement</option>
                <option value="acompte">Acompte</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Montant (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newPaymentAmount}
                onChange={(e) => setNewPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-28 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] text-slate-400 mb-1">Note (optionnel)</label>
              <input
                type="text"
                value={newPaymentNote}
                onChange={(e) => setNewPaymentNote(e.target.value)}
                placeholder="Ex: virement mars, avance..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              />
            </div>
            <button
              onClick={onAddEntry}
              disabled={!newPaymentAmount || parseFloat(newPaymentAmount) <= 0}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Ajouter
            </button>
          </div>
        </div>

        {/* History list */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase flex items-center gap-1.5">
            <History size={13} /> Tous les paiements ({allEntries.length})
          </p>
          {allEntries.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucun paiement enregistré</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {allEntries.map((entry) => {
                const isInPeriod = entry.periodStart === startDate && entry.periodEnd === endDate;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                      isInPeriod
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      entry.type === 'virement'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-amber-100 text-amber-600'
                    }`}>
                      <Banknote size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase ${
                          entry.type === 'virement' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {entry.type}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        {!isInPeriod && (
                          <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">hors période</span>
                        )}
                      </div>
                      {entry.note && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.note}</p>
                      )}
                    </div>
                    <span className="font-bold text-sm text-slate-900 flex-shrink-0">
                      {entry.amount.toFixed(2)} €
                    </span>
                    <button
                      onClick={() => onRemoveEntry(entry.id)}
                      className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
                      title="Supprimer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All-time totals */}
        {allEntries.length > 0 && (
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <div className="flex-1 text-center">
              <p className="text-[10px] text-slate-400">Total virements (tout)</p>
              <p className="font-bold text-emerald-600">{totalVirAll.toFixed(2)} €</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[10px] text-slate-400">Total acomptes (tout)</p>
              <p className="font-bold text-amber-600">{totalAccAll.toFixed(2)} €</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[10px] text-slate-400">Total versé (tout)</p>
              <p className="font-bold text-slate-900">{(totalVirAll + totalAccAll).toFixed(2)} €</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
