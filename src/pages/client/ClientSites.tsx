import { useEffect, useState } from 'react';
import { useClientPortalStore, ClientSiteDetail } from '../../store/clientPortalStore';
import { MapPin, Navigation, Building2, Sparkles, Globe, ArrowRight, ArrowLeft, DollarSign, Clock, CheckCircle2, PlayCircle, CalendarClock, Camera, BarChart3, Loader2 } from 'lucide-react';

export default function ClientSites() {
  const { clientInfo, fetchClientInfo, fetchSiteDetail, loading } = useClientPortalStore();
  const [visible, setVisible] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [siteDetail, setSiteDetail] = useState<ClientSiteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchClientInfo();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [fetchClientInfo]);

  const handleSiteClick = async (siteId: string) => {
    setSelectedSiteId(siteId);
    setDetailLoading(true);
    try {
      const data = await fetchSiteDetail(siteId);
      setSiteDetail(data);
    } catch {
      setSiteDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedSiteId(null);
    setSiteDetail(null);
  };

  if (loading && !clientInfo) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-[3px] border-emerald-100 border-t-emerald-500 animate-spin" />
          <Sparkles size={18} className="absolute inset-0 m-auto text-emerald-500 animate-pulse" />
        </div>
      </div>
    );
  }

  const sites = clientInfo?.sites || [];

  // ── Detail View ──
  if (selectedSiteId && siteDetail) {
    const { site, stats, missions } = siteDetail;
    return (
      <div className={`space-y-6 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl mesh-gradient px-7 py-8 md:px-10 md:py-10 shadow-2xl">
          <div className="orb w-32 h-32 bg-rose-400/15 top-0 right-10" />
          <div className="orb orb-alt w-24 h-24 bg-blue-400/10 bottom-0 left-20" />
          <div className="dot-pattern absolute inset-0" />
          <div className="relative">
            <button onClick={handleBack} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full mb-4 border border-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all text-xs font-medium">
              <ArrowLeft size={13} /> Retour aux sites
            </button>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">{site.name}</span>
            </h1>
            {site.address && (
              <p className="text-white/50 mt-2 text-sm flex items-center gap-2">
                <Navigation size={13} className="text-white/40" />
                {site.address}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<BarChart3 size={20} />} label="Total missions" value={stats.totalMissions} color="emerald" />
          <StatCard icon={<PlayCircle size={20} />} label="En cours" value={stats.missionsEnCours} color="blue" />
          <StatCard icon={<CheckCircle2 size={20} />} label="Terminées" value={stats.missionsTerminees} color="green" />
          <StatCard icon={<CalendarClock size={20} />} label="Planifiées" value={stats.missionsPlanifiees} color="amber" />
        </div>

        {/* Hours & Photos row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Clock size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Heures travaillées</p>
                <p className="text-xl font-black text-slate-900">{stats.totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Clock size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Heures contractuelles</p>
                <p className="text-xl font-black text-slate-900">{stats.contractualHours}h</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
                <Camera size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Photos</p>
                <p className="text-xl font-black text-slate-900">{stats.totalPhotos}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tarif */}
        {site.hourlyRate != null && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <DollarSign size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Tarif horaire</p>
                <p className="text-xl font-black text-slate-900">{site.hourlyRate}€/h</p>
              </div>
            </div>
          </div>
        )}

        {/* Missions list */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Missions sur ce site</h2>
          </div>
          {missions.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-400">Aucune mission pour ce site.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {missions.map((m) => (
                <div key={m.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{m.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(m.startDate).toLocaleDateString('fr-FR')} → {new Date(m.endDate).toLocaleDateString('fr-FR')}
                      </p>
                      {m.agents.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1">
                          {m.agents.map(a => a.matricule).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        m.status === 'terminée' ? 'bg-green-50 text-green-700 border border-green-200/50' :
                        m.status === 'en_cours' ? 'bg-blue-50 text-blue-700 border border-blue-200/50' :
                        'bg-amber-50 text-amber-700 border border-amber-200/50'
                      }`}>
                        {m.status === 'terminée' ? <CheckCircle2 size={11} /> : m.status === 'en_cours' ? <PlayCircle size={11} /> : <CalendarClock size={11} />}
                        {m.status === 'terminée' ? 'Terminée' : m.status === 'en_cours' ? 'En cours' : 'Planifiée'}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{m.hoursWorked.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Loading detail ──
  if (selectedSiteId && detailLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-[3px] border-emerald-100 border-t-emerald-500 animate-spin" />
          <Sparkles size={18} className="absolute inset-0 m-auto text-emerald-500 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className={`space-y-6 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl mesh-gradient px-7 py-8 md:px-10 md:py-10 shadow-2xl">
        <div className="orb w-32 h-32 bg-rose-400/15 top-0 right-10" />
        <div className="orb orb-alt w-24 h-24 bg-blue-400/10 bottom-0 left-20" />
        <div className="dot-pattern absolute inset-0" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full mb-4 border border-white/10">
              <MapPin size={13} className="text-rose-300" />
              <span className="text-rose-200 text-[11px] font-bold tracking-widest uppercase">Vos Sites</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">{sites.length} site{sites.length > 1 ? 's' : ''}</span>
            </h1>
            <p className="text-white/40 mt-2 text-sm max-w-lg">Retrouvez l'ensemble de vos sites d'intervention et leurs détails.</p>
          </div>
          <div className="hidden sm:flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.08] backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Building2 size={36} className="text-white/40" />
            </div>
          </div>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="glass-card rounded-2xl border border-dashed border-slate-200 p-14 text-center hover-lift">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <MapPin size={32} className="text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-400">Aucun site enregistré</p>
          <p className="text-sm text-slate-400/70 mt-2">Vos sites apparaîtront ici une fois configurés.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {sites.map((site) => (
            <div
              key={site.id}
              onClick={() => handleSiteClick(site.id)}
              className="group relative bg-white rounded-2xl border border-slate-200/60 shadow-sm hover-lift card-shine overflow-hidden cursor-pointer"
            >
              {/* Top gradient accent */}
              <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />

              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-xl shadow-emerald-500/25 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                    <MapPin size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors duration-300">{site.name}</h3>
                    {site.address && (
                      <p className="text-xs text-slate-500 mt-2 flex items-start gap-1.5 leading-relaxed">
                        <Navigation size={11} className="flex-shrink-0 mt-0.5 text-slate-400" />
                        <span className="line-clamp-2">{site.address}</span>
                      </p>
                    )}
                  </div>
                </div>

                {site.notes && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-slate-50 to-transparent rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 leading-relaxed italic line-clamp-2">{site.notes}</p>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  {site.hourlyRate != null && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl text-sm font-bold text-emerald-700 border border-emerald-200/50">
                      <DollarSign size={13} />
                      {site.hourlyRate}€/h
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-auto">
                    <Globe size={11} /> Détails <ArrowRight size={10} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/25',
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/25',
    green: 'from-green-500 to-green-600 shadow-green-500/25',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/25',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center shadow-lg`}>
          <span className="text-white">{icon}</span>
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
