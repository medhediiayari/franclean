import { useMemo, useState, useEffect } from 'react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useEventStore } from '../../store/eventStore';
import { useAuthStore } from '../../store/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/helpers';
import type { HoursSummary } from '../../types';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Clock,
  FileCheck,
  Receipt,
  TrendingDown,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';

export default function HoursTracking() {
  const { records, fetchRecords } = useAttendanceStore();
  const { events, fetchEvents } = useEventStore();
  const { users, fetchUsers } = useAuthStore();

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState<string>('agentName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const agents = users.filter((u) => u.role === 'agent');

  const summaryData: HoursSummary[] = useMemo(() => {
    const map = new Map<string, HoursSummary>();

    records.forEach((rec) => {
      const agent = agents.find((a) => a.id === rec.agentId);
      const event = events.find((e) => e.id === rec.eventId);
      if (!agent) return;

      const key = `${rec.agentId}-${rec.eventId}`;
      const existing = map.get(key);

      if (existing) {
        existing.hoursPointed += rec.hoursWorked || 0;
        if (rec.status === 'valide') existing.hoursValidated += rec.hoursWorked || 0;
        if (rec.status === 'en_attente') existing.validationStatus = 'partielle';
      } else {
        const pointed = rec.hoursWorked || 0;
        const validated = rec.status === 'valide' ? pointed : 0;
        map.set(key, {
          agentId: rec.agentId,
          agentName: `${agent.firstName} ${agent.lastName}`,
          client: event?.client || 'N/A',
          period: formatDate(rec.date),
          hoursPointed: pointed,
          hoursValidated: validated,
          hoursBilled: validated * 0.9, // simulated billed hours
          validationStatus: rec.status === 'valide' ? 'complete' : rec.status === 'en_attente' ? 'en_attente' : 'partielle',
          gap: 0,
        });
      }
    });

    return Array.from(map.values()).map((s) => ({
      ...s,
      gap: Number((s.hoursPointed - s.hoursBilled).toFixed(2)),
    }));
  }, [records, events, agents]);

  const filteredData = summaryData
    .filter((s) => {
      if (!searchText) return true;
      const q = searchText.toLowerCase();
      return (
        s.agentName.toLowerCase().includes(q) ||
        s.client.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const field = sortField as keyof HoursSummary;
      const av = a[field];
      const bv = b[field];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const totalPointed = filteredData.reduce((sum, s) => sum + s.hoursPointed, 0);
  const totalValidated = filteredData.reduce((sum, s) => sum + s.hoursValidated, 0);
  const totalBilled = filteredData.reduce((sum, s) => sum + s.hoursBilled, 0);
  const totalGap = filteredData.reduce((sum, s) => sum + s.gap, 0);

  const getGapColor = (gap: number) => {
    if (Math.abs(gap) < 0.5) return 'text-emerald-600';
    if (Math.abs(gap) < 2) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getGapIcon = (gap: number) => {
    if (Math.abs(gap) < 0.5) return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (Math.abs(gap) < 2) return <MinusCircle size={14} className="text-amber-500" />;
    return <AlertTriangle size={14} className="text-rose-500" />;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Suivi des Heures"
        subtitle="Tableau comparatif heures pointées / validées / facturées"
        action={
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-medium text-sm shadow-card transition-colors">
            <Download size={16} />
            Exporter
          </button>
        }
      />

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="H. Pointées" value={`${totalPointed.toFixed(1)}h`} icon={Clock} iconBg="bg-slate-50" iconColor="text-slate-600" />
        <StatCard label="H. Validées" value={`${totalValidated.toFixed(1)}h`} icon={FileCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard label="H. Facturées" value={`${totalBilled.toFixed(1)}h`} icon={Receipt} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Écart" value={`${totalGap > 0 ? '+' : ''}${totalGap.toFixed(1)}h`} icon={TrendingDown} iconBg="bg-orange-50" iconColor="text-orange-600" />
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3 shadow-card">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher agent ou client..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  { key: 'agentName', label: 'Agent' },
                  { key: 'client', label: 'Client / Projet' },
                  { key: 'period', label: 'Période' },
                  { key: 'hoursPointed', label: 'H. Pointées' },
                  { key: 'hoursValidated', label: 'H. Validées' },
                  { key: 'validationStatus', label: 'Validation' },
                  { key: 'hoursBilled', label: 'H. Facturées' },
                  { key: 'gap', label: 'Écart' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3 cursor-pointer hover:text-slate-700 select-none"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown
                        size={12}
                        className={
                          sortField === col.key ? 'text-primary-500' : 'text-slate-300'
                        }
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-900">
                    {row.agentName}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{row.client}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{row.period}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-slate-900">
                    {row.hoursPointed.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600">
                    {row.hoursValidated.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={row.validationStatus} />
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-blue-600">
                    {row.hoursBilled.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {getGapIcon(row.gap)}
                      <span className={`text-sm font-semibold ${getGapColor(row.gap)}`}>
                        {row.gap > 0 ? '+' : ''}
                        {row.gap.toFixed(1)}h
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">
                    Aucune donnée trouvée
                  </td>
                </tr>
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-5 py-3 text-sm font-bold text-slate-900" colSpan={3}>
                    TOTAL
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-900">
                    {totalPointed.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-emerald-600">
                    {totalValidated.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-sm font-bold text-blue-600">
                    {totalBilled.toFixed(1)}h
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-sm font-bold ${getGapColor(totalGap)}`}>
                      {totalGap > 0 ? '+' : ''}
                      {totalGap.toFixed(1)}h
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
