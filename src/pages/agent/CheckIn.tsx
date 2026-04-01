import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatTime, formatDuration } from '../../utils/helpers';
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
  ImagePlus,
  X,
  Download,
} from 'lucide-react';

export default function CheckIn() {
  const { user } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const { records, addRecord, updateRecord, fetchRecords, addWorkPhoto, deleteWorkPhoto } = useAttendanceStore();

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
  const [autoSelected, setAutoSelected] = useState(false);

  // Work photos state
  const [workPhotoUploading, setWorkPhotoUploading] = useState(false);
  const workFileRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // When cameraActive becomes true and the video element is rendered, attach the stream
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  if (!user) return null;

  const todayD = new Date();
  const today = `${todayD.getFullYear()}-${String(todayD.getMonth()+1).padStart(2,'0')}-${String(todayD.getDate()).padStart(2,'0')}`;
  const myEvents = events.filter(
    (e) =>
      e.assignedAgentIds.includes(user.id) &&
      (e.status === 'en_cours' || e.status === 'planifie') &&
      e.startDate.slice(0, 10) <= today &&
      e.endDate.slice(0, 10) >= today,
  ).map(e => ({
    ...e,
    shifts: (e.shifts || []).filter(s => !s.agentId || s.agentId === user!.id),
  }));

  const todayRecords = records.filter(
    (r) => r.agentId === user.id && r.date === today,
  );

  const openRecords = todayRecords.filter((r) => r.checkInTime && !r.checkOutTime);
  const completedRecords = todayRecords.filter((r) => r.checkOutTime);
  const eventsWithoutRecord = myEvents.filter((e) => !todayRecords.some((r) => r.eventId === e.id));

  // Auto-select mission that has check-in but no check-out
  useEffect(() => {
    if (!selectedEventId && !autoSelected && todayRecords.length > 0) {
      const openRecord = todayRecords.find((r) => r.checkInTime && !r.checkOutTime);
      if (openRecord) {
        setSelectedEventId(openRecord.eventId);
        setMode('check-out');
        setAutoSelected(true);
      }
    }
  }, [todayRecords, selectedEventId, autoSelected]);

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
          photos: [],
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
      setAutoSelected(true);
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

  // ── Work photo functions (gallery picker) ──────────
  const pendingRecordIdRef = useRef<string | null>(null);

  const openGalleryForRecord = (recordId: string) => {
    pendingRecordIdRef.current = recordId;
    workFileRef.current?.click();
  };

  const handleWorkPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const recordId = pendingRecordIdRef.current;
    if (!files || files.length === 0 || !recordId) return;

    setWorkPhotoUploading(true);
    setError('');
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await addWorkPhoto(recordId, dataUrl);
      }
    } catch {
      setError('Erreur lors de l\'envoi de la photo.');
    } finally {
      setWorkPhotoUploading(false);
      if (workFileRef.current) workFileRef.current.value = '';
      pendingRecordIdRef.current = null;
    }
  };

  const handleDeleteWorkPhoto = async (attendanceId: string, photoId: string) => {
    try {
      await deleteWorkPhoto(attendanceId, photoId);
    } catch {
      setError('Erreur lors de la suppression de la photo.');
    }
  };

  return (
    <div className="p-4 space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-800 rounded-xl px-5 py-3.5 shadow-lg">
        <h1 className="text-lg font-bold text-white tracking-tight">Pointage</h1>
        <p className="text-sm text-slate-300 mt-0.5">Photo + GPS en temps réel</p>
      </div>

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

      {/* Open check-in records — sortie à compléter */}
      {openRecords.map((rec) => {
        const evt = events.find((e) => e.id === rec.eventId);
        const isActive = selectedEventId === rec.eventId && mode === 'check-out';
        return (
          <div key={rec.id} className="bg-white rounded-2xl border-2 border-orange-200 shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
                <h2 className="text-sm font-bold text-orange-800">Sortie à compléter</h2>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={rec.status} />
                {rec.checkInLocationValid === false && (
                  <span className="text-[11px] text-orange-500 flex items-center gap-1 font-semibold">
                    <AlertTriangle size={11} /> Hors zone
                  </span>
                )}
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{evt?.title || 'Mission'}</p>
                  <div className="flex items-center gap-1.5 text-xs mt-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-500">Entrée</span>
                    <span className="font-bold text-slate-700">{formatTime(rec.checkInTime!)}</span>
                  </div>
                </div>
              </div>

              {/* Work photos section */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImagePlus size={14} className="text-violet-500" />
                    <span className="text-xs font-bold text-slate-700">Photos de travail</span>
                    {(rec.photos || []).length > 0 && (
                      <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                        {rec.photos.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openGalleryForRecord(rec.id)}
                    disabled={workPhotoUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {workPhotoUploading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ImagePlus size={12} />
                    )}
                    Ajouter
                  </button>
                </div>

                {/* Existing photos gallery */}
                {(rec.photos || []).length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {rec.photos.map((photo) => (
                      <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 cursor-pointer" onClick={() => setLightboxUrl(photo.photoUrl)}>
                        <img src={photo.photoUrl} alt="Travail" className="w-full h-20 object-cover" />
                        <button
                          onClick={() => handleDeleteWorkPhoto(rec.id, photo.id)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} className="text-white" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1.5 py-0.5">
                          <span className="text-[9px] text-white">
                            {new Date(photo.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isActive ? (
                <button
                  onClick={() => {
                    stopCamera();
                    setSelectedEventId(rec.eventId);
                    setMode('check-out');
                    setCapturedPhoto(null);
                    setGeoData(null);
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 rounded-2xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 hover:from-rose-600 hover:to-rose-700 transition-all active:scale-[0.98]"
                >
                  <Camera size={16} />
                  Pointer la sortie
                </button>
              ) : (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  {/* Mission info */}
                  {evt && (
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 space-y-2.5 border border-slate-100">
                      <p className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <MapPin size={13} className="text-primary-400" />
                        {evt.address}
                      </p>
                      {evt.shifts?.filter((s: any) => s.date === today && (!s.agentId || s.agentId === user!.id)).length > 0 && (
                        <p className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <Clock size={13} className="text-primary-400" />
                          {evt.shifts.filter((s: any) => s.date === today && (!s.agentId || s.agentId === user!.id)).map((s: any) => `${s.startTime} → ${s.endTime}`).join(' | ')}
                        </p>
                      )}
                      {evt.geoRadius && (
                        <p className="flex items-center gap-2 text-[11px] text-slate-400">
                          <Shield size={12} className="text-slate-400" />
                          Zone GPS : rayon de {evt.geoRadius}m
                        </p>
                      )}
                    </div>
                  )}

                  {/* Mode indicator */}
                  <div className="text-center py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-rose-50 to-pink-50 text-rose-700 border border-rose-200">
                    <ArrowRight size={16} strokeWidth={2.5} />
                    Pointage de sortie
                  </div>

                  {/* Camera */}
                  {!capturedPhoto ? (
                    <div>
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
                            <div className="w-12 h-12 rounded-full bg-rose-500" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={startCamera}
                          className="w-full flex flex-col items-center gap-3 py-8 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-primary-50 hover:to-primary-100/50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary-300 transition-all duration-200 group"
                        >
                          <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:shadow-md group-hover:bg-primary-50 transition-all">
                            <Camera size={24} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
                          </div>
                          <div className="text-center">
                            <span className="text-sm font-bold text-slate-600 group-hover:text-primary-600 transition-colors">
                              Ouvrir la caméra
                            </span>
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              Photo de sortie obligatoire
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                        <img src={capturedPhoto} alt="Justificatif" className="w-full h-48 object-cover" />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setCapturedPhoto(null); startCamera(); }}
                          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                        >
                          <RotateCcw size={15} />
                          Reprendre
                        </button>
                        <button
                          onClick={handleCheckInOut}
                          disabled={loading}
                          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white rounded-2xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-rose-600/25 disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                          {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 size={16} />
                              Confirmer sortie
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* GPS info */}
                  {geoData && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
                      <MapPin size={12} className="text-slate-400" />
                      GPS : {geoData.lat.toFixed(6)}, {geoData.lon.toFixed(6)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Completed records */}
      {completedRecords.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100/80 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50">
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Pointages complétés</h2>
            <span className="ml-auto text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{completedRecords.length}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {completedRecords.map((rec) => {
              const evt = events.find((e) => e.id === rec.eventId);
              return (
                <div key={rec.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{evt?.title || 'Mission'}</p>
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
                            {formatDuration(rec.hoursWorked)} travaillées
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={rec.status} />
                      {(rec.checkInLocationValid === false || rec.checkOutLocationValid === false) && (
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

      {/* Missions en attente de pointage */}
      {eventsWithoutRecord.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="p-1.5 rounded-lg bg-blue-50">
              <Clock size={14} className="text-blue-500" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">En attente de pointage</h2>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{eventsWithoutRecord.length}</span>
          </div>

          {eventsWithoutRecord.map((evt) => {
            const isActive = selectedEventId === evt.id && mode === 'check-in';
            const todayShifts = evt.shifts?.filter((s: any) => s.date === today && (!s.agentId || s.agentId === user!.id)) || [];
            return (
              <div key={evt.id} className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100/80 bg-gradient-to-r from-blue-50/50 to-slate-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: evt.color || '#6366F1' }} />
                    <p className="text-sm font-bold text-slate-900 truncate">{evt.title}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex-shrink-0">
                    <Clock size={11} />
                    En attente
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  {/* Mission info */}
                  <div className="space-y-2">
                    {evt.address && (
                      <p className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <MapPin size={13} className="text-primary-400 flex-shrink-0" />
                        <span className="truncate">{evt.address}</span>
                      </p>
                    )}
                    {todayShifts.length > 0 && (
                      <p className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <Clock size={13} className="text-primary-400 flex-shrink-0" />
                        {todayShifts.map((s: any) => `${s.startTime} → ${s.endTime}`).join(' | ')}
                      </p>
                    )}
                    {evt.geoRadius && (
                      <p className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Shield size={12} className="text-slate-400 flex-shrink-0" />
                        Zone GPS : rayon de {evt.geoRadius}m
                      </p>
                    )}
                  </div>

                  {!isActive ? (
                    <button
                      onClick={() => {
                        stopCamera();
                        setSelectedEventId(evt.id);
                        setMode('check-in');
                        setCapturedPhoto(null);
                        setGeoData(null);
                        setError('');
                        setSuccess('');
                      }}
                      className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-[0.98]"
                    >
                      <Camera size={16} />
                      Pointer l'entrée
                    </button>
                  ) : (
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                      {/* Mode indicator */}
                      <div className="text-center py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200">
                        <ArrowDown size={16} strokeWidth={2.5} />
                        Pointage d'entrée
                      </div>

                      {/* Camera */}
                      {!capturedPhoto ? (
                        <div>
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
                                <div className="w-12 h-12 rounded-full bg-emerald-500" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={startCamera}
                              className="w-full flex flex-col items-center gap-3 py-8 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-primary-50 hover:to-primary-100/50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary-300 transition-all duration-200 group"
                            >
                              <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:shadow-md group-hover:bg-primary-50 transition-all">
                                <Camera size={24} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
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
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                            <img src={capturedPhoto} alt="Justificatif" className="w-full h-48 object-cover" />
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => { setCapturedPhoto(null); startCamera(); }}
                              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                            >
                              <RotateCcw size={15} />
                              Reprendre
                            </button>
                            <button
                              onClick={handleCheckInOut}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white rounded-2xl shadow-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-600/25 disabled:opacity-50 transition-all active:scale-[0.98]"
                            >
                              {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 size={16} />
                                  Confirmer entrée
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* GPS info */}
                      {geoData && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
                          <MapPin size={12} className="text-slate-400" />
                          GPS : {geoData.lat.toFixed(6)}, {geoData.lon.toFixed(6)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={workFileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleWorkPhotoSelected}
      />

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
              <X size={24} className="text-white" />
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
    </div>
  );
}
