import { useEffect, useState } from 'react';
import { useClientPortalStore } from '../../store/clientPortalStore';
import { MapPin, Navigation, Building2, Sparkles, Globe, ArrowRight, Hash, DollarSign } from 'lucide-react';

export default function ClientSites() {
  const { clientInfo, fetchClientInfo, loading } = useClientPortalStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchClientInfo();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [fetchClientInfo]);

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
          {sites.map((site, i) => (
            <div
              key={site.id}
              className="group relative bg-white rounded-2xl border border-slate-200/60 shadow-sm hover-lift card-shine overflow-hidden"
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

                {site.hourlyRate != null && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl text-sm font-bold text-emerald-700 border border-emerald-200/50">
                      <DollarSign size={13} />
                      {site.hourlyRate}€/h
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Globe size={11} /> Détails <ArrowRight size={10} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
