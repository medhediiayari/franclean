import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatTime, generateId } from '../../utils/helpers';
import { getCurrentPosition, isWithinRadius, formatDistance } from '../../utils/geolocation';
import type { Attendance } from '../../types';
import {
  Clock,
  MapPin,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Camera,
  CheckCircle2,
  Loader2,
  ImageIcon,
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

export default function MyPlanning() {
  const { user } = useAuthStore();
  const { events, setAgentResponse } = useEventStore();
  const { records, addRecord, updateRecord } = useAttendanceStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Camera state per-mission
  const [cameraEventId, setCameraEventId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'check-in' | 'check-out'>('check-in');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);

  const myEvents = events
    .filter((e) => e.assignedAgentId === user.id)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const upcomingEvents = myEvents.filter(
    (e) => e.status === 'planifie' || e.status === 'en_cours',
  );
  const pastEvents = myEvents.filter(
    (e) => e.status === 'termine' || e.status === 'annule',
  );

  const getRecordForEvent = (eventId: string) =>
    records.find((r) => r.agentId === user!.id && r.eventId === eventId && r.date === today);

  const handleResponse = (eventId: string, response: 'accepted' | 'refused') => {
    setAgentResponse(eventId, response);
  };

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      setError("Impossible d'accéder à la caméra. Veuillez autoriser l'accès.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
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
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  }, [stopCamera]);

  const openCamera = (eventId: string, mode: 'check-in' | 'check-out') => {
    setCameraEventId(eventId);
    setCameraMode(mode);
    setCapturedPhoto(null);
    setError('');
    setSuccess('');
    startCamera();
  };

  const cancelCamera = () => {
    stopCamera();
    setCameraEventId(null);
    setCapturedPhoto(null);
    setError('');
  };

  const handleConfirm = async () => {
    if (!cameraEventId || !capturedPhoto || !user) return;
    const selectedEvent = events.find((e) => e.id === cameraEventId);
    if (!selectedEvent) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      let locationValid = true;
      const suspectReasons: string[] = [];

      if (selectedEvent.latitude && selectedEvent.longitude && selectedEvent.geoRadius) {
        const check = isWithinRadius(latitude, longitude, selectedEvent.latitude, selectedEvent.longitude, selectedEvent.geoRadius);
        locationValid = check.isValid;
        if (!locationValid) {
          suspectReasons.push(`Localisation hors zone (${formatDistance(check.distance)})`);
        }
      }

      const now = new Date();
      const existingRecord = getRecordForEvent(cameraEventId);

      if (cameraMode === 'check-in') {
        const newRecord: Attendance = {
          id: generateId('att'),
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
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        addRecord(newRecord);
        setSuccess("Photo d'entrée enregistrée !");
      } else if (existingRecord) {
        const checkInTime = new Date(existingRecord.checkInTime!);
        const hoursWorked = Number(((now.getTime() - checkInTime.getTime()) / 3600000).toFixed(2));
        if (hoursWorked > 12) suspectReasons.push('Durée supérieure à 12h');

        updateRecord(existingRecord.id, {
          checkOutTime: now.toISOString(),
          checkOutPhotoUrl: capturedPhoto,
          checkOutLatitude: latitude,
          checkOutLongitude: longitude,
          checkOutLocationValid: locationValid,
          hoursWorked,
          isSuspect: existingRecord.isSuspect || suspectReasons.length > 0,
          suspectReasons: [...existingRecord.suspectReasons, ...suspectReasons],
          status: existingRecord.isSuspect || suspectReasons.length > 0 ? 'suspect' : 'en_attente',
        });
        setSuccess('Photo de clôture enregistrée !');
      }

      setCameraEventId(null);
      setCapturedPhoto(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur GPS. Veuillez activer la géolocalisation.');
    } finally {
      setLoading(false);
    }
  };

  const getMissionPhotoStatus = (eventId: string) => {
    const rec = getRecordForEvent(eventId);
    if (!rec) return 'none';
    if (rec.checkInTime && rec.checkOutTime) return 'complete';
    if (rec.checkInTime) return 'checked-in';
    return 'none';
  };

  return (
    <div className="p-4 space-y-5 animate-fadeIn">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      <div>
        <h1 className="text-lg font-bold text-slate-900">Mon Planning</h1>
        <p className="text-sm text-slate-500">Mes missions et interventions</p>
      </div>

      {/* Success/Error banners */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {error && !cameraEventId && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Upcoming events */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Missions à venir ({upcomingEvents.length})
        </h2>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {upcomingEvents.map((event) => {
              const rec = getRecordForEvent(event.id);
              const photoStatus = getMissionPhotoStatus(event.id);
              const isToday = event.startDate.slice(0, 10) <= today && event.endDate.slice(0, 10) >= today;

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === event.id ? null : event.id)
                    }
                    className="w-full px-4 py-3.5 flex items-start gap-3 text-left"
                  >
                    <div
                      className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                        photoStatus === 'complete'
                          ? 'bg-emerald-400'
                          : photoStatus === 'checked-in'
                          ? 'bg-amber-400'
                          : event.status === 'en_cours'
                          ? 'bg-amber-400'
                          : 'bg-primary-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {photoStatus === 'complete' && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 size={10} /> Terminé
                            </span>
                          )}
                          {photoStatus === 'checked-in' && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                              <Camera size={10} /> En cours
                            </span>
                          )}
                          <StatusBadge status={event.status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                        {event.shifts?.filter(s => s.date === today).length > 0 ? (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {event.shifts.filter(s => s.date === today).map(s => `${s.startTime}→${s.endTime}`).join(' | ')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {event.shifts?.length || 0} créneau{(event.shifts?.length || 0) > 1 ? 'x' : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(event.startDate)}{event.startDate !== event.endDate ? ` → ${formatDate(event.endDate)}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                        <MapPin size={12} />
                        {event.address.split(',')[0]}
                      </div>
                    </div>
                    {expandedId === event.id ? (
                      <ChevronUp size={16} className="text-slate-400 mt-1" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-400 mt-1" />
                    )}
                  </button>

                  {expandedId === event.id && (
                    <div className="px-4 pb-4 pt-0 space-y-3 animate-fadeIn">
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                        <p className="text-sm text-slate-600">{event.description}</p>
                        {event.client && (
                          <p className="text-xs text-slate-400">
                            Client : <span className="font-medium text-slate-600">{event.client}</span>
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          Période : {formatDate(event.startDate)}{event.startDate !== event.endDate ? ` → ${formatDate(event.endDate)}` : ''}
                        </p>
                        {event.shifts && event.shifts.length > 0 && (
                          <div className="text-xs text-slate-400">
                            Horaires :{' '}
                            {event.shifts.filter(s => s.date === today).length > 0
                              ? event.shifts.filter(s => s.date === today).map(s => `${s.startTime}→${s.endTime}`).join(' | ')
                              : event.shifts.map(s => `${formatDate(s.date)} ${s.startTime}→${s.endTime}`).join(' | ')}
                          </div>
                        )}
                        <p className="text-xs text-slate-400">
                          Adresse : {event.address}
                        </p>
                      </div>

                      {/* Photos d'entrée et de clôture */}
                      {rec && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Pointage de la mission
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {/* Photo d'entrée */}
                            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                                <Camera size={12} className="text-emerald-500" /> Photo d'entrée
                              </p>
                              {rec.checkInPhotoUrl ? (
                                <>
                                  <div className="rounded-lg overflow-hidden border border-slate-200">
                                    <img src={rec.checkInPhotoUrl} alt="Entrée" className="w-full h-28 object-cover" />
                                  </div>
                                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <Clock size={10} /> {formatTime(rec.checkInTime!)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400">—</p>
                              )}
                            </div>
                            {/* Photo de clôture */}
                            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                                <Camera size={12} className="text-rose-500" /> Photo de clôture
                              </p>
                              {rec.checkOutPhotoUrl ? (
                                <>
                                  <div className="rounded-lg overflow-hidden border border-slate-200">
                                    <img src={rec.checkOutPhotoUrl} alt="Clôture" className="w-full h-28 object-cover" />
                                  </div>
                                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <Clock size={10} /> {formatTime(rec.checkOutTime!)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400">—</p>
                              )}
                            </div>
                          </div>
                          {rec.hoursWorked && (
                            <p className="text-xs font-semibold text-primary-600 text-center">
                              {rec.hoursWorked.toFixed(1)}h travaillées
                            </p>
                          )}
                        </div>
                      )}

                      {/* Camera capture inline for today's missions */}
                      {isToday && cameraEventId === event.id && (
                        <div className="space-y-3 border border-primary-200 rounded-xl p-3 bg-primary-50/30">
                          <div className={`text-center py-1.5 rounded-lg text-xs font-semibold ${
                            cameraMode === 'check-in'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {cameraMode === 'check-in' ? "📥 Photo d'entrée" : '📤 Photo de clôture'}
                          </div>

                          {!capturedPhoto && cameraActive && (
                            <div className="relative rounded-xl overflow-hidden bg-black">
                              <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
                              <button
                                onClick={capturePhoto}
                                className="absolute bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-slate-200 active:scale-95 transition-transform"
                              >
                                <div className="w-10 h-10 bg-rose-500 rounded-full" />
                              </button>
                            </div>
                          )}

                          {!capturedPhoto && !cameraActive && (
                            <button
                              onClick={startCamera}
                              className="w-full flex flex-col items-center gap-2 py-6 bg-white hover:bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 transition-colors"
                            >
                              <Camera size={28} className="text-slate-400" />
                              <span className="text-xs font-medium text-slate-600">Ouvrir la caméra</span>
                            </button>
                          )}

                          {capturedPhoto && (
                            <div className="space-y-2">
                              <div className="rounded-xl overflow-hidden border border-slate-200">
                                <img src={capturedPhoto} alt="Capture" className="w-full h-40 object-cover" />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setCapturedPhoto(null); startCamera(); }}
                                  className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                  Reprendre
                                </button>
                                <button
                                  onClick={handleConfirm}
                                  disabled={loading}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition-all ${
                                    cameraMode === 'check-in'
                                      ? 'bg-emerald-600 hover:bg-emerald-700'
                                      : 'bg-rose-600 hover:bg-rose-700'
                                  } disabled:opacity-50`}
                                >
                                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                  Confirmer
                                </button>
                              </div>
                            </div>
                          )}

                          {error && (
                            <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
                          )}

                          <button
                            onClick={cancelCamera}
                            className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
                          >
                            Annuler
                          </button>
                        </div>
                      )}

                      {/* Action buttons for photos */}
                      {isToday && cameraEventId !== event.id && (
                        <div className="flex items-center gap-2">
                          {photoStatus === 'none' && (
                            <button
                              onClick={() => openCamera(event.id, 'check-in')}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all"
                            >
                              <Camera size={16} /> Photo d'entrée
                            </button>
                          )}
                          {photoStatus === 'checked-in' && (
                            <button
                              onClick={() => openCamera(event.id, 'check-out')}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-all"
                            >
                              <Camera size={16} /> Photo de clôture
                            </button>
                          )}
                          {photoStatus === 'complete' && (
                            <div className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium border border-emerald-200">
                              <CheckCircle2 size={16} /> Mission pointée
                            </div>
                          )}
                        </div>
                      )}

                      {/* Agent response buttons */}
                      {event.agentResponse === 'pending' && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleResponse(event.id, 'accepted')}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all"
                          >
                            <Check size={16} /> Accepter
                          </button>
                          <button
                            onClick={() => handleResponse(event.id, 'refused')}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-medium transition-all"
                          >
                            <X size={16} /> Refuser
                          </button>
                        </div>
                      )}

                      {event.agentResponse && event.agentResponse !== 'pending' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Votre réponse :</span>
                          <StatusBadge status={event.agentResponse} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Aucune mission à venir</p>
          </div>
        )}
      </div>

      {/* Past events */}
      {pastEvents.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Missions passées ({pastEvents.length})
          </h2>
          <div className="space-y-2">
            {pastEvents.map((event) => {
              const rec = records.find((r) => r.agentId === user!.id && r.eventId === event.id);
              return (
                <div
                  key={event.id}
                  className="bg-white rounded-xl border border-slate-200 px-4 py-3 opacity-70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {event.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(event.startDate)} — {event.client || event.address.split(',')[0]}
                      </p>
                      {/* Show photos for past missions too */}
                      {rec && (
                        <div className="flex items-center gap-3 mt-2">
                          {rec.checkInPhotoUrl && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
                                <img src={rec.checkInPhotoUrl} alt="Entrée" className="w-full h-full object-cover" />
                              </div>
                              <span className="text-[10px] text-slate-400">{formatTime(rec.checkInTime!)}</span>
                            </div>
                          )}
                          {rec.checkOutPhotoUrl && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
                                <img src={rec.checkOutPhotoUrl} alt="Clôture" className="w-full h-full object-cover" />
                              </div>
                              <span className="text-[10px] text-slate-400">{formatTime(rec.checkOutTime!)}</span>
                            </div>
                          )}
                          {rec.hoursWorked && (
                            <span className="text-[10px] font-semibold text-primary-600 ml-auto">
                              {rec.hoursWorked.toFixed(1)}h
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={event.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
