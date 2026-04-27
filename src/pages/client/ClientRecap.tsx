import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  BarChart3,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  User,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface RecapAgent {
  matricule: string;
  hours: number;
}

interface RecapSite {
  siteId: string;
  siteName: string;
  totalHours: number;
  contractualHours: number;
  remainingHours: number;
  agents: RecapAgent[];
}

export default function ClientRecap() {
  const [recap, setRecap] = useState<RecapSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    loadRecap();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const loadRecap = async () => {
    setLoading(true);
    try {
      const data = await api.get<RecapSite[]>('/client-portal/recap');
      setRecap(data);
    } catch {
      setRecap([]);
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (h: number) => {
    if (h === 0) return '0h';
    const hrs = Math.floor(Math.abs(h));
    const mins = Math.round((Math.abs(h) - hrs) * 60);
    const sign = h < 0 ? '-' : '';
    return mins > 0 ? `${sign}${hrs}h${mins.toString().padStart(2, '0')}` : `${sign}${hrs}h`;
  };

  const getProgressPercent = (total: number, contractual: number) => {
    if (contractual <= 0) return 0;
    return Math.min(100, Math.round((total / contractual) * 100));
  };

  const getStatusColor = (remaining: number, contractual: number) => {
    if (contractual <= 0) return 'text-slate-400';
    const pct = remaining / contractual;
    if (pct > 0.25) return 'text-emerald-600';
    if (pct > 0) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getBarColor = (remaining: number, contractual: number) => {
    if (contractual <= 0) return 'from-slate-300 to-slate-400';
    const pct = remaining / contractual;
    if (pct > 0.25) return 'from-emerald-400 to-emerald-600';
    if (pct > 0) return 'from-amber-400 to-amber-500';
    return 'from-rose-400 to-rose-600';
  };

  // Grand totals
  const grandTotalHours = recap.reduce((s, r) => s + r.totalHours, 0);
  const grandContractual = recap.reduce((s, r) => s + r.contractualHours, 0);
  const grandRemaining = recap.reduce((s, r) => s + r.remainingHours, 0);

  if (loading) {
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
    <div className={`space-y-6 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 px-6 py-7 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-emerald-500 blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-500 blur-[80px]" />
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                <BarChart3 size={12} /> Récapitulatif
              </span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Recap</h1>
            <p className="text-slate-400 text-sm mt-1.5">Suivi des heures par site — contractuelles vs réalisées.</p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 text-center">
              <p className="text-[10px] text-emerald-300 font-bold uppercase">H. Facturées</p>
              <p className="text-xl font-black text-white mt-0.5">{formatHours(grandTotalHours)}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 text-center">
              <p className="text-[10px] text-blue-300 font-bold uppercase">Contractuelles</p>
              <p className="text-xl font-black text-white mt-0.5">{formatHours(grandContractual)}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 text-center">
              <p className="text-[10px] text-amber-300 font-bold uppercase">Restantes</p>
              <p className="text-xl font-black text-white mt-0.5">{formatHours(grandRemaining)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile stats */}
      <div className="grid grid-cols-3 gap-3 sm:hidden">
        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <p className="text-[10px] text-emerald-600 font-bold uppercase">Facturées</p>
          <p className="text-lg font-black text-emerald-700">{formatHours(grandTotalHours)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
          <p className="text-[10px] text-blue-600 font-bold uppercase">Contractuelles</p>
          <p className="text-lg font-black text-blue-700">{formatHours(grandContractual)}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
          <p className="text-[10px] text-amber-600 font-bold uppercase">Restantes</p>
          <p className="text-lg font-black text-amber-700">{formatHours(grandRemaining)}</p>
        </div>
      </div>

      {/* No data */}
      {recap.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-400">Aucune donnée disponible</p>
          <p className="text-sm text-slate-400/70 mt-1">Les récapitulatifs apparaîtront ici une fois les heures enregistrées.</p>
        </div>
      )}

      {/* Sites list */}
      <div className="space-y-4">
        {recap.map((site, idx) => {
          const isExpanded = expandedSite === site.siteId;
          const pct = getProgressPercent(site.totalHours, site.contractualHours);
          const barColor = getBarColor(site.remainingHours, site.contractualHours);
          const statusColor = getStatusColor(site.remainingHours, site.contractualHours);

          return (
            <div
              key={site.siteId}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-500 ${
                isExpanded ? 'border-emerald-200 shadow-lg shadow-emerald-500/5' : 'border-slate-200/60 hover:shadow-md hover:border-slate-200'
              }`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Site row */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                      <FileText size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{site.siteName}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {site.contractualHours > 0 ? (
                          <span className={`text-xs font-semibold ${statusColor}`}>
                            {site.remainingHours > 0 ? (
                              <>{formatHours(site.remainingHours)} restantes</>
                            ) : site.remainingHours === 0 ? (
                              <>Contrat complété</>
                            ) : (
                              <>{formatHours(Math.abs(site.remainingHours))} en dépassement</>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Pas de contrat défini</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-4 mr-2">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Facturées</p>
                        <p className="text-sm font-black text-slate-800">{formatHours(site.totalHours)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Contrat</p>
                        <p className="text-sm font-black text-slate-800">
                          {site.contractualHours > 0 ? formatHours(site.contractualHours) : '—'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedSite(isExpanded ? null : site.siteId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all"
                    >
                      Détails
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {site.contractualHours > 0 && (
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                      <span>{formatHours(site.totalHours)} / {formatHours(site.contractualHours)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Mobile stats */}
                <div className="flex items-center gap-4 mt-3 sm:hidden">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock size={12} className="text-emerald-500" />
                    <span className="font-semibold text-slate-700">{formatHours(site.totalHours)}</span>
                    <span className="text-slate-400">facturées</span>
                  </div>
                  {site.contractualHours > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <TrendingUp size={12} className="text-blue-500" />
                      <span className="font-semibold text-slate-700">{formatHours(site.contractualHours)}</span>
                      <span className="text-slate-400">contrat</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded: Agent breakdown */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <User size={13} /> Agents intervenants
                  </h4>

                  {site.agents.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Aucun agent n'a encore travaillé sur ce site.</p>
                  ) : (
                    <div className="space-y-2">
                      {site.agents
                        .sort((a, b) => b.hours - a.hours)
                        .map((agent) => (
                          <div
                            key={agent.matricule}
                            className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                                <User size={14} className="text-white" />
                              </div>
                              <span className="text-sm font-bold text-slate-800">{agent.matricule}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={13} className="text-emerald-500" />
                              <span className="text-sm font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                                {formatHours(agent.hours)}
                              </span>
                            </div>
                          </div>
                        ))}

                      {/* Total row */}
                      <div className="flex items-center justify-between bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl px-4 py-3 border border-slate-200 mt-1">
                        <span className="text-xs font-bold text-slate-500 uppercase">Total</span>
                        <span className="text-sm font-extrabold text-slate-800">
                          {formatHours(site.agents.reduce((s, a) => s + a.hours, 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Alert if over contract */}
                  {site.contractualHours > 0 && site.remainingHours < 0 && (
                    <div className="mt-3 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
                      <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />
                      <p className="text-xs font-semibold text-rose-700">
                        Dépassement de {formatHours(Math.abs(site.remainingHours))} par rapport au contrat de {formatHours(site.contractualHours)}.
                      </p>
                    </div>
                  )}

                  {site.contractualHours > 0 && site.remainingHours === 0 && (
                    <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700">
                        Contrat entièrement consommé — {formatHours(site.contractualHours)} utilisées.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
