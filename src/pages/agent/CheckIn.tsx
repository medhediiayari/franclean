import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import StatusBadge from '../../components/common/StatusBadge';
import { generateId, formatTime } from '../../utils/helpers';
import { getCurrentPosition, isWithinRadius, formatDistance } from '../../utils/geolocation';
import type { Attendance } from '../../types';
import {
  Camera,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

export default function CheckIn() {
  const { user } = useAuthStore();
  const { events } = useEventStore();
  const { records, addRecord, updateRecord } = useAttendanceStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [mode, setMode] = useState<'check-in' | 'check-out'>('check-in');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const myEvents = events.filter(
    (e) =>
      e.assignedAgentId === user.id &&
      (e.status === 'en_cours' || e.status === 'planifie') &&
      e.startDate.slice(0, 10) <= today &&
      e.endDate.slice(0, 10) >= today,
  );

  const todayRecords = records.filter(
    (r) => r.agentId === user.id && r.date === today,
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const existingRecord = todayRecords.find((r) => r.eventId === selectedEventId);

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
      setError('Impossible d\'accéder à la caméra. Veuillez autoriser l\'accès.');
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
  }, [stopCamera]);

  const handleCheckInOut = async () => {
    if (!selectedEvent || !capturedPhoto) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get GPS position
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      setGeoData({ lat: latitude, lon: longitude });

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
        setSuccess('Pointage d\'entrée enregistré avec succès !');
      } else if (existingRecord) {
        // Calculate hours
        const checkInTime = new Date(existingRecord.checkInTime!);
        const hoursWorked = Number(((now.getTime() - checkInTime.getTime()) / 3600000).toFixed(2));

        // Check for suspicious duration
        if (hoursWorked > 12) {
          suspectReasons.push('Durée supérieure à 12h');
        }

        updateRecord(existingRecord.id, {
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
      <div>
        <h1 className="text-lg font-bold text-slate-900">Pointage</h1>
        <p className="text-sm text-slate-500">Enregistrez votre présence avec photo et GPS</p>
      </div>

      {/* Today's status */}
      {todayRecords.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Pointages du jour
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {todayRecords.map((rec) => {
              const evt = events.find((e) => e.id === rec.eventId);
              return (
                <div key={rec.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {evt?.title || 'Mission'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {rec.checkInTime && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-emerald-500" />
                            Entrée: {formatTime(rec.checkInTime)}
                          </span>
                        )}
                        {rec.checkOutTime && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-rose-500" />
                            Sortie: {formatTime(rec.checkOutTime)}
                          </span>
                        )}
                      </div>
                      {rec.hoursWorked && (
                        <p className="text-xs font-semibold text-primary-600 mt-1">
                          {rec.hoursWorked.toFixed(1)}h travaillées
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={rec.status} />
                      {rec.checkInLocationValid === false && (
                        <span className="text-xs text-orange-500 flex items-center gap-1">
                          <AlertTriangle size={10} /> Hors zone
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
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Nouveau pointage
        </h2>

        {/* Select event */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Sélectionner la mission
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
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
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
            {/* Mission info */}
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
              <p className="flex items-center gap-1">
                <MapPin size={12} /> {selectedEvent.address}
              </p>
              {selectedEvent.shifts?.filter(s => s.date === today).length > 0 ? (
                <p className="flex items-center gap-1">
                  <Clock size={12} /> {selectedEvent.shifts.filter(s => s.date === today).map(s => `${s.startTime}→${s.endTime}`).join(' | ')}
                </p>
              ) : (
                <p className="flex items-center gap-1">
                  <Clock size={12} /> {selectedEvent.shifts?.length || 0} créneau{(selectedEvent.shifts?.length || 0) > 1 ? 'x' : ''}
                </p>
              )}
              {selectedEvent.geoRadius && (
                <p className="text-slate-400">
                  Zone de pointage : rayon de {selectedEvent.geoRadius}m
                </p>
              )}
            </div>

            {/* Mode indicator */}
            <div
              className={`text-center py-2 rounded-lg text-sm font-semibold ${
                mode === 'check-in'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {mode === 'check-in' ? '📥 Pointage d\'entrée' : '📤 Pointage de sortie'}
            </div>

            {/* Camera */}
            {!capturedPhoto && (
              <div className="space-y-3">
                {cameraActive ? (
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-64 object-cover"
                    />
                    <button
                      onClick={capturePhoto}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-slate-200 active:scale-95 transition-transform"
                    >
                      <div className="w-12 h-12 bg-rose-500 rounded-full" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startCamera}
                    className="w-full flex flex-col items-center gap-3 py-8 bg-slate-50 hover:bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 transition-colors"
                  >
                    <Camera size={32} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">
                      Ouvrir la caméra
                    </span>
                    <span className="text-xs text-slate-400">
                      Photo obligatoire prise en temps réel
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Captured photo preview */}
            {capturedPhoto && (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <img src={capturedPhoto} alt="Justificatif" className="w-full h-48 object-cover" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCapturedPhoto(null);
                      startCamera();
                    }}
                    className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Reprendre
                  </button>
                  <button
                    onClick={handleCheckInOut}
                    disabled={loading}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition-all ${
                      mode === 'check-in'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
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

            <canvas ref={canvasRef} className="hidden" />

            {/* GPS info */}
            {geoData && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MapPin size={12} />
                GPS : {geoData.lat.toFixed(6)}, {geoData.lon.toFixed(6)}
              </div>
            )}
          </>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-600 flex items-center gap-2 animate-fadeIn">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-600 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
