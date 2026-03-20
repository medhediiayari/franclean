import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatTime } from '../../utils/helpers';
import { getCurrentPosition, isWithinRadius, formatDistance } from '../../utils/geolocation';
import {
  Camera,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowDown,
  Shield,
  Zap,
  RotateCcw,
} from 'lucide-react';

export default function CheckIn() {
  const { user } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const { records, addRecord, updateRecord, fetchRecords } = useAttendanceStore();

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [mode, setMode] = useState<'check-in' | 'check-out'>('check-in');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // When cameraActive becomes true and the video element is rendered, attach the stream
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const myEvents = events.filter(
    (e) =>
      e.assignedAgentIds.includes(user.id) &&
      (e.status === 'en_cours' || e.status === 'planifie') &&
      e.startDate.slice(0, 10) <= today &&
      e.endDate.slice(0, 10) >= today,
  );

  const todayRecords = records.filter(
    (r) => r.agentId === user.id && r.date === today,
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const existingRecord = todayRecords.find((r) => r.eventId === selectedEventId);

  // Current step for visual stepper
  const currentStep = !selectedEventId ? 1 : !capturedPhoto ? 2 : 3;

  const startCamera = async () => {
    try {
      setError('');
      // Request camera AND GPS permissions simultaneously
      const [stream, position] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        }),
        getCurrentPosition().catch(() => null), // GPS starts warming up, don't block if slow
      ]);
      streamRef.current = stream;
      if (position) {
        setGeoData({ lat: position.coords.latitude, lon: position.coords.longitude });
      }
      // Set active first so the <video> element renders, then useEffect attaches the stream
      setCameraActive(true);
    } catch {
      setError('Impossible d\'accéder à la caméra et/ou au GPS. Veuillez autoriser les deux accès.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      // Add timestamp overlay
      const now = new Date();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(
        `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR')}`,
        10,
        canvas.height - 15,
      );
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoData);
      stopCamera();
    }
  };

  const handleCheckInOut = async () => {
    if (!selectedEvent || !capturedPhoto) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Use already-obtained GPS position or get a fresh one
      let latitude: number;
      let longitude: number;
      if (geoData) {
        latitude = geoData.lat;
        longitude = geoData.lon;
      } else {
        const position = await getCurrentPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        setGeoData({ lat: latitude, lon: longitude });
      }

      // Check if within radius
      let locationValid = true;
      const suspectReasons: string[] = [];

      if (selectedEvent.latitude && selectedEvent.longitude && selectedEvent.geoRadius) {
        const check = isWithinRadius(
          latitude,
          longitude,
          selectedEvent.latitude,
          selectedEvent.longitude,
          selectedEvent.geoRadius,
        );
        locationValid = check.isValid;
        if (!locationValid) {
          suspectReasons.push(
            `Localisation hors zone (${formatDistance(check.distance)})`,
          );
        }
      }

      const now = new Date();

      if (mode === 'check-in') {
        await addRecord({
          eventId: selectedEvent.id,
          agentId: user.id,
          date: today,
          checkInTime: now.toISOString(),
          checkInPhotoUrl: capturedPhoto,
          checkInLatitude: latitude,
          checkInLongitude: longitude,
          checkInLocationValid: locationValid,
          status: suspectReasons.length > 0 ? 'suspect' : 'en_attente',
          isSuspect: suspectReasons.length > 0,
          suspectReasons,
        });
        setSuccess('Pointage d\'entrée enregistré avec succès !');
      } else if (existingRecord) {
        // Calculate hours
        const checkInTime = new Date(existingRecord.checkInTime!);
        const hoursWorked = Number(((now.getTime() - checkInTime.getTime()) / 3600000).toFixed(2));

        // Check for suspicious duration
        if (hoursWorked > 12) {
          suspectReasons.push('Durée supérieure à 12h');
        }

        await updateRecord(existingRecord.id, {
          checkOutTime: now.toISOString(),
          checkOutPhotoUrl: capturedPhoto,
          checkOutLatitude: latitude,
          checkOutLongitude: longitude,
          checkOutLocationValid: locationValid,
          hoursWorked,
          isSuspect: existingRecord.isSuspect || suspectReasons.length > 0,
          suspectReasons: [...existingRecord.suspectReasons, ...suspectReasons],
          status:
            existingRecord.isSuspect || suspectReasons.length > 0
              ? 'suspect'
              : 'en_attente',
        });
        setSuccess('Pointage de sortie enregistré avec succès !');
      }

      setCapturedPhoto(null);
      setGeoData(null);
      setSelectedEventId('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la géolocalisation. Veuillez activer le GPS.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-5 animate-fadeIn">
      {/* Header with visual stepper */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Pointage</h1>
        <p className="text-sm text-slate-500 mt-0.5">Photo + GPS en temps réel</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: 'Mission' },
          { num: 2, label: 'Photo' },
          { num: 3, label: 'Confirmer' },
        ].map((step, i) => (
          <div key={step.num} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
              currentStep === step.num
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                : currentStep > step.num
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-400'
            }`}>
              {currentStep > step.num ? (
                <CheckCircle2 size={14} />
              ) : (
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">{step.num}</span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.label}</span>
            </div>
            {i < 2 && <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Today's status — existing records */}
      {todayRecords.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100/80 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50">
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              Pointages du jour
            </h2>
            <span className="ml-auto text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{todayRecords.length}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {todayRecords.map((rec) => {
              const evt = events.find((e) => e.id === rec.eventId);
              return (
                <div key={rec.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {evt?.title || 'Mission'}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        {rec.checkInTime && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-slate-500">Entrée</span>
                            <span className="font-bold text-slate-700">{formatTime(rec.checkInTime)}</span>
                          </div>
                        )}
                        {rec.checkOutTime && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full bg-rose-400" />
                            <span className="text-slate-500">Sortie</span>
                            <span className="font-bold text-slate-700">{formatTime(rec.checkOutTime)}</span>
                          </div>
                        )}
                      </div>
                      {rec.hoursWorked && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <Zap size={12} className="text-primary-500" />
                          <span className="text-xs font-bold text-primary-600">
                            {rec.hoursWorked.toFixed(1)}h travaillées
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={rec.status} />
                      {rec.checkInLocationValid === false && (
                        <span className="text-[11px] text-orange-500 flex items-center gap-1 font-semibold">
                          <AlertTriangle size={11} /> Hors zone
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New check-in/out */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary-50">
            <Camera size={16} className="text-primary-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">
            Nouveau pointage
          </h2>
        </div>

        {/* Step 1: Select event */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            1. Sélectionner la mission
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setCapturedPhoto(null);
              setError('');
              setSuccess('');
              const rec = todayRecords.find((r) => r.eventId === e.target.value);
              setMode(rec?.checkInTime && !rec?.checkOutTime ? 'check-out' : 'check-in');
            }}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-slate-50 hover:bg-white transition-colors appearance-none cursor-pointer"
          >
            <option value="">Choisir une mission...</option>
            {myEvents.map((evt) => {
              const rec = todayRecords.find((r) => r.eventId === evt.id);
              const label = rec?.checkInTime && !rec?.checkOutTime
                ? ' (Sortie à pointer)'
                : rec?.checkOutTime
                ? ' (Complet ✓)'
                : '';
              return (
                <option
                  key={evt.id}
                  value={evt.id}
                  disabled={!!rec?.checkOutTime}
                >
                  {evt.title}{label}
                </option>
              );
            })}
          </select>
        </div>

        {selectedEventId && selectedEvent && (
          <>
            {/* Mission info card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 space-y-2.5 border border-slate-100">
              <p className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                <MapPin size={13} className="text-primary-400" />
                {selectedEvent.address}
              </p>
              {selectedEvent.shifts?.filter(s => s.date === today).length > 0 ? (
                <p className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Clock size={13} className="text-primary-400" />
                  {selectedEvent.shifts.filter(s => s.date === today).map(s => `${s.startTime} → ${s.endTime}`).join(' | ')}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock size={13} className="text-primary-400" />
                  {selectedEvent.shifts?.length || 0} créneau{(selectedEvent.shifts?.length || 0) > 1 ? 'x' : ''}
                </p>
              )}
              {selectedEvent.geoRadius && (
                <p className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Shield size={12} className="text-slate-400" />
                  Zone de validation GPS : rayon de {selectedEvent.geoRadius}m
                </p>
              )}
            </div>

            {/* Mode indicator */}
            <div
              className={`text-center py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${
                mode === 'check-in'
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200'
                  : 'bg-gradient-to-r from-rose-50 to-pink-50 text-rose-700 border border-rose-200'
              }`}
            >
              {mode === 'check-in' ? (
                <>
                  <ArrowDown size={16} strokeWidth={2.5} />
                  Pointage d'entrée
                </>
              ) : (
                <>
                  <ArrowRight size={16} strokeWidth={2.5} />
                  Pointage de sortie
                </>
              )}
            </div>

            {/* Step 2: Camera */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                2. Prendre la photo
              </label>

              {!capturedPhoto && (
                <div className="space-y-3">
                  {cameraActive ? (
                    <div className="relative rounded-2xl overflow-hidden bg-black shadow-xl">
                      <video
                        ref={(el) => {
                          (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                          if (el && streamRef.current && !el.srcObject) {
                            el.srcObject = streamRef.current;
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 object-cover"
                      />
                      {/* Camera overlay */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-white/50 rounded-tl-lg" />
                        <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-white/50 rounded-tr-lg" />
                        <div className="absolute bottom-16 left-3 w-8 h-8 border-b-2 border-l-2 border-white/50 rounded-bl-lg" />
                        <div className="absolute bottom-16 right-3 w-8 h-8 border-b-2 border-r-2 border-white/50 rounded-br-lg" />
                      </div>
                      <button
                        onClick={capturePhoto}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-slate-200/50 active:scale-90 transition-transform hover:scale-105"
                      >
                        <div className={`w-12 h-12 rounded-full ${mode === 'check-in' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startCamera}
                      className="w-full flex flex-col items-center gap-3 py-10 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-primary-50 hover:to-primary-100/50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary-300 transition-all duration-200 group"
                    >
                      <div className="p-4 rounded-2xl bg-white shadow-sm group-hover:shadow-md group-hover:bg-primary-50 transition-all">
                        <Camera size={28} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold text-slate-600 group-hover:text-primary-600 transition-colors">
                          Ouvrir la caméra
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          Photo temps réel obligatoire
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Captured photo preview */}
              {capturedPhoto && (
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    3. Confirmer
                  </label>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                    <img src={capturedPhoto} alt="Justificatif" className="w-full h-48 object-cover" />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setCapturedPhoto(null);
                        startCamera();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                    >
                      <RotateCcw size={15} />
                      Reprendre
                    </button>
                    <button
                      onClick={handleCheckInOut}
                      disabled={loading}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white rounded-2xl shadow-lg transition-all active:scale-[0.98] ${
                        mode === 'check-in'
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-600/25'
                          : 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-rose-600/25'
                      } disabled:opacity-50`}
                    >
                      {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          {mode === 'check-in' ? 'Confirmer entrée' : 'Confirmer sortie'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* GPS info */}
            {geoData && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
                <MapPin size={12} className="text-slate-400" />
                GPS : {geoData.lat.toFixed(6)}, {geoData.lon.toFixed(6)}
              </div>
            )}
          </>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-600 flex items-start gap-3 animate-fadeIn">
            <div className="p-1 rounded-lg bg-rose-100 flex-shrink-0 mt-0.5">
              <AlertTriangle size={14} />
            </div>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-600 flex items-start gap-3 animate-fadeIn">
            <div className="p-1 rounded-lg bg-emerald-100 flex-shrink-0 mt-0.5">
              <CheckCircle2 size={14} />
            </div>
            <span className="font-semibold">{success}</span>
          </div>
        )}
      </div>
    </div>
  );
}
