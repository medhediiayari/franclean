import { useEffect, useState } from 'react';
import { useClientPortalStore } from '../../store/clientPortalStore';
import { formatDate } from '../../utils/helpers';
import { Image, MapPin, User, Calendar, X, Camera, Sparkles, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ClientPhotos() {
  const { photos, fetchPhotos, clientInfo, fetchClientInfo, loading } = useClientPortalStore();
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchClientInfo();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [fetchClientInfo]);

  useEffect(() => {
    fetchPhotos(selectedSite || undefined);
  }, [fetchPhotos, selectedSite]);

  const sites = clientInfo?.sites || [];

  const typeConfig: Record<string, { label: string; gradient: string; ring: string }> = {
    checkin: { label: 'Arrivée', gradient: 'from-blue-500 to-blue-600', ring: 'ring-blue-200' },
    checkout: { label: 'Départ', gradient: 'from-orange-500 to-orange-600', ring: 'ring-orange-200' },
    work: { label: 'Travail', gradient: 'from-emerald-500 to-emerald-600', ring: 'ring-emerald-200' },
  };

  const openLightbox = (idx: number) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const goPrev = () => setLightboxIdx(i => i !== null ? (i > 0 ? i - 1 : photos.length - 1) : null);
  const goNext = () => setLightboxIdx(i => i !== null ? (i < photos.length - 1 ? i + 1 : 0) : null);

  return (
    <div className={`space-y-6 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl mesh-gradient px-7 py-8 md:px-10 md:py-10 shadow-2xl">
        <div className="orb w-32 h-32 bg-orange-400/15 top-0 right-10" />
        <div className="orb orb-alt w-24 h-24 bg-violet-400/10 bottom-0 left-20" />
        <div className="dot-pattern absolute inset-0" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full mb-4 border border-white/10">
              <Camera size={13} className="text-orange-300" />
              <span className="text-orange-200 text-[11px] font-bold tracking-widest uppercase">Galerie Photos</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Photos</span>
            </h1>
            <p className="text-white/40 mt-2 text-sm max-w-lg">Photos des interventions sur vos sites d'activité.</p>
          </div>
          <div className="hidden sm:flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.08] backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Camera size={36} className="text-white/40" />
            </div>
          </div>
        </div>
      </div>

      {/* Site filter */}
      <div className="glass-card rounded-2xl p-5 border border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">Filtrer par site</p>
        <div className="flex flex-wrap gap-2 stagger-children">
          <button
            onClick={() => setSelectedSite('')}
            className={`group relative px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 overflow-hidden ${
              !selectedSite
                ? 'text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200/60 hover:border-slate-300 hover:shadow-md'
            }`}
          >
            {!selectedSite && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600" />}
            <span className="relative">Tous les sites</span>
          </button>
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => setSelectedSite(site.name)}
              className={`group relative px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 overflow-hidden ${
                selectedSite === site.name
                  ? 'text-white shadow-lg'
                  : 'bg-white text-slate-600 border border-slate-200/60 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {selectedSite === site.name && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600" />}
              <span className="relative flex items-center gap-1.5">
                <MapPin size={11} /> {site.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading && photos.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-[3px] border-emerald-100 border-t-emerald-500 animate-spin" />
            <Sparkles size={18} className="absolute inset-0 m-auto text-emerald-500 animate-pulse" />
          </div>
        </div>
      ) : photos.length === 0 ? (
        <div className="glass-card rounded-2xl border border-dashed border-slate-200 p-14 text-center hover-lift">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <Image size={32} className="text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-400">Aucune photo disponible</p>
          <p className="text-sm text-slate-400/70 mt-2">Les photos apparaîtront ici après les interventions.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{photos.length} photo{photos.length > 1 ? 's' : ''}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
            {photos.map((photo, i) => {
              const type = typeConfig[photo.type] || typeConfig.work;
              return (
                <div
                  key={photo.id}
                  className="group bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover-lift card-shine cursor-pointer"
                  onClick={() => openLightbox(i)}
                >
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    <img
                      src={photo.photoUrl}
                      alt={photo.caption || 'Photo'}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end justify-center pb-6">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 scale-50 group-hover:scale-100 transition-transform duration-500">
                        <ZoomIn size={18} className="text-white" />
                      </div>
                    </div>
                    {/* Type badge */}
                    <span className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[9px] font-bold text-white bg-gradient-to-r ${type.gradient} shadow-lg backdrop-blur-sm`}>
                      {type.label}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{photo.eventTitle}</p>
                    <div className="flex items-center gap-2.5 mt-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <User size={10} /> {photo.agentName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(photo.date)}
                      </span>
                    </div>
                    {photo.site && (
                      <p className="text-[10px] text-slate-400/70 mt-1.5 flex items-center gap-1">
                        <MapPin size={10} /> {photo.site}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Premium Lightbox */}
      {lightboxIdx !== null && photos[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-fadeIn" />

          {/* Controls */}
          <button
            className="absolute top-5 right-5 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-300 border border-white/10 hover:scale-110"
            onClick={closeLightbox}
          >
            <X size={20} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-300 border border-white/10 hover:scale-110"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-300 border border-white/10 hover:scale-110"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Image container */}
          <div className="relative z-10 animate-scaleIn max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[lightboxIdx].photoUrl}
              alt={photos[lightboxIdx].caption || 'Photo'}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
            {/* Info bar */}
            <div className="absolute bottom-0 inset-x-0 glass-card rounded-b-2xl px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{photos[lightboxIdx].eventTitle}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><User size={10} /> {photos[lightboxIdx].agentName}</span>
                  <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(photos[lightboxIdx].date)}</span>
                  {photos[lightboxIdx].site && <span className="flex items-center gap-1"><MapPin size={10} /> {photos[lightboxIdx].site}</span>}
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400">{lightboxIdx + 1} / {photos.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
