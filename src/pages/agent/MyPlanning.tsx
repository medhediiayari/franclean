import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/helpers';
import {
  Clock,
  MapPin,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Navigation,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

/** Smart shift schedule display — groups by pattern, summarises date ranges */
function ShiftSchedule({ shifts, today }: { shifts: { date: string; startTime: string; endTime: string }[]; today: string }) {

  // Build a lookup: date → sorted slot strings
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of shifts) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(`${s.startTime}→${s.endTime}`);
    }
    for (const [k, v] of map) map.set(k, v.sort());
    return map;
  }, [shifts]);

  const summary = useMemo(() => {
    // 1. Group dates sharing the same shift pattern
    const patternGroups = new Map<string, string[]>();
    for (const [date, slots] of shiftsByDate) {
      const key = slots.join('|');
      if (!patternGroups.has(key)) patternGroups.set(key, []);
      patternGroups.get(key)!.push(date);
    }

    // 2. For each pattern group, build a human‑readable range summary
    const result: {
      pattern: string[];
      rangeLabel: string;
      exceptions: { date: string; slots: string[] | null }[]; // null = no shifts that day
      dates: string[];
      isSingleDay: boolean;
    }[] = [];

    for (const [patternKey, dates] of patternGroups) {
      const sorted = dates.sort();
      const pattern = patternKey.split('|');

      if (sorted.length === 1) {
        result.push({
          pattern,
          rangeLabel: formatDateShort(sorted[0], today),
          exceptions: [],
          dates: sorted,
          isSingleDay: true,
        });
      } else {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        const allExpected = getAllDatesBetween(first, last);
        const dateSet = new Set(sorted);
        const missingDates = allExpected.filter(d => !dateSet.has(d));

        // Build exception objects with their actual shifts (if any from another pattern)
        const exceptions = missingDates.map(d => ({
          date: d,
          slots: shiftsByDate.get(d) ?? null,
        }));

        const useRange = missingDates.length <= allExpected.length * 0.4;

        if (useRange) {
          result.push({
            pattern,
            rangeLabel: `Du ${formatDateShort(first, today)} au ${formatDateShort(last, today)}`,
            exceptions,
            dates: sorted,
            isSingleDay: false,
          });
        } else {
          const subRanges = groupConsecutiveDays(sorted);
          const labels = subRanges.map(r =>
            r.length === 1
              ? formatDateShort(r[0], today)
              : r.length <= 3
              ? r.map(d => formatDateShort(d, today)).join(', ')
              : `${formatDateShort(r[0], today)} au ${formatDateShort(r[r.length - 1], today)}`
          );
          result.push({
            pattern,
            rangeLabel: labels.join(' · '),
            exceptions: [],
            dates: sorted,
            isSingleDay: false,
          });
        }
      }
    }

    // Sort: today-containing first, then by first date
    result.sort((a, b) => {
      const aToday = a.dates.includes(today) ? 0 : 1;
      const bToday = b.dates.includes(today) ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      return a.dates[0].localeCompare(b.dates[0]);
    });

    return result;
  }, [shiftsByDate, today]);

  // Today's specific shifts (shown prominently at top)
  const todayShifts = useMemo(() => {
    return shifts.filter(s => s.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [shifts, today]);

  return (
    <div className="text-xs space-y-2">
      {/* Today highlight */}
      {todayShifts.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-2.5">
          <p className="text-primary-700 font-semibold mb-1 flex items-center gap-1">
            <Clock size={12} /> Aujourd'hui
          </p>
          <div className="flex flex-wrap gap-1.5">
            {todayShifts.map((s, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full font-semibold bg-primary-100 text-primary-700 text-xs">
                {s.startTime} → {s.endTime}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pattern groups */}
      <div className="space-y-1.5">
        <p className="text-slate-400 font-medium">Planning :</p>
        {summary.map((group, gi) => (
          <div key={gi} className="bg-slate-50 rounded-lg p-2.5 space-y-1.5">
            {/* Date range */}
            <p className="text-slate-700 font-medium">{group.rangeLabel}</p>

            {/* Shift pattern pills */}
            <div className="flex flex-wrap gap-1.5">
              {group.pattern.map((slot, si) => (
                <span key={si} className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 font-medium">
                  {slot.replace('→', ' → ')}
                </span>
              ))}
            </div>

            {/* Exceptions — listed inline */}
            {group.exceptions.length > 0 && (
              <p className="text-amber-600 font-medium text-[11px]">
                sauf {group.exceptions.map(ex => formatDateWithDay(ex.date, today)).join(', ')}
              </p>
            )}

            {/* Count summary */}
            {group.dates.length > 1 && (
              <p className="text-slate-400 text-[11px]">
                {group.dates.length} jours · {group.pattern.length} créneau{group.pattern.length > 1 ? 'x' : ''}/jour
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Short date label: "15 mars" (omits year if same year, shows "Aujourd'hui" for today) */
function formatDateShort(dateStr: string, today: string): string {
  if (dateStr === today) return "auj.";
  const todayYear = today.slice(0, 4);
  const dateYear = dateStr.slice(0, 4);
  const fmt = dateYear === todayYear ? 'd MMM' : 'd MMM yyyy';
  return formatDate(dateStr, fmt);
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** Date with day of week: "lun. 23 mars" */
function formatDateWithDay(dateStr: string, today: string): string {
  if (dateStr === today) return "aujourd'hui";
  const d = new Date(dateStr + 'T12:00:00Z');
  const dayName = JOURS[d.getUTCDay()];
  const todayYear = today.slice(0, 4);
  const dateYear = dateStr.slice(0, 4);
  const fmt = dateYear === todayYear ? 'd MMM' : 'd MMM yyyy';
  return `${dayName} ${formatDate(dateStr, fmt)}`;
}

/** Get all dates between start and end (inclusive), as YYYY-MM-DD strings */
function getAllDatesBetween(start: string, end: string): string[] {
  const result: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (d <= endDate) {
    result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    d.setDate(d.getDate() + 1);
  }
  return result;
}

/** Group sorted date strings into sub-arrays of consecutive days */
function groupConsecutiveDays(sorted: string[]): string[][] {
  if (sorted.length === 0) return [];
  const groups: string[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00Z');
    const curr = new Date(sorted[i] + 'T12:00:00Z');
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      groups[groups.length - 1].push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  return groups;
}

export default function MyPlanning() {
  const { user } = useAuthStore();
  const { events, setAgentResponse, fetchEvents } = useEventStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Auto-mark pending missions as seen when agent can't refuse
  useEffect(() => {
    if (user && !user.canRefuseEvents) {
      import('../../lib/api').then(({ api }) => {
        api.post('/events/mark-seen', {}).then(() => fetchEvents());
      });
    }
  }, [user, fetchEvents]);

  if (!user) return null;

  const todayD = new Date();
  const today = `${todayD.getFullYear()}-${String(todayD.getMonth()+1).padStart(2,'0')}-${String(todayD.getDate()).padStart(2,'0')}`;

  const myEvents = events
    .filter((e) => e.assignedAgentIds.includes(user.id))
    .map(e => ({
      ...e,
      shifts: (e.shifts || []).filter(s => !s.agentId || s.agentId === user!.id),
    }))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const upcomingEvents = myEvents.filter(
    (e) => (e.status === 'planifie' || e.status === 'en_cours') && e.endDate.slice(0, 10) >= today,
  );
  const pastEvents = myEvents.filter(
    (e) => e.status === 'termine' || e.status === 'annule',
  );

  /** Get the actual first and last shift dates for an event */
  const getShiftDateRange = (event: typeof events[0]): { first: string; last: string } | null => {
    if (!event.shifts || event.shifts.length === 0) return null;
    const dates = event.shifts.map(s => s.date.slice(0, 10)).sort();
    return { first: dates[0], last: dates[dates.length - 1] };
  };

  /** Compute non-shift days within the actual shift date range (not event date range) */
  const getExceptionDays = (event: typeof events[0]): string[] => {
    const range = getShiftDateRange(event);
    if (!range || range.first === range.last) return [];
    const allDates = getAllDatesBetween(range.first, range.last);
    const shiftDates = new Set(event.shifts!.map(s => s.date.slice(0, 10)));
    return allDates.filter(d => !shiftDates.has(d));
  };

  const handleResponse = async (eventId: string, response: 'accepted' | 'refused') => {
    try {
      await setAgentResponse(eventId, user.id, response);
    } catch (err) {
      console.error('Failed to set response', err);
    }
  };

  return (
    <div className="p-4 space-y-5 animate-fadeIn">
      <div className="bg-slate-800 rounded-xl px-5 py-3.5 shadow-lg">
        <h1 className="text-lg font-bold text-white tracking-tight">Mon Planning</h1>
        <p className="text-sm text-slate-300 mt-0.5">{user?.canRefuseEvents ? 'Acceptez ou refusez vos missions' : 'Vos missions assignées'}</p>
      </div>

      {/* Upcoming events */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Missions à venir
          </h2>
          <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{upcomingEvents.length}</span>
        </div>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {upcomingEvents.map((event) => {
              const agentResponse = event.agentResponses?.[user.id];
              const exceptionDays = getExceptionDays(event);
              const shiftRange = getShiftDateRange(event);

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200"
                >
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === event.id ? null : event.id)
                    }
                    className="w-full px-5 py-4 flex items-start gap-3 text-left"
                  >
                    <div
                      className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                        !user?.canRefuseEvents
                          ? 'bg-primary-400'
                          : agentResponse === 'accepted'
                          ? 'bg-emerald-400'
                          : agentResponse === 'refused'
                          ? 'bg-rose-400'
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
                          {!user?.canRefuseEvents && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                              Assignée
                            </span>
                          )}
                          {user?.canRefuseEvents && agentResponse && agentResponse !== 'pending' && (
                            <StatusBadge status={agentResponse} />
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
                          {shiftRange
                            ? shiftRange.first === shiftRange.last
                              ? formatDate(shiftRange.first)
                              : `${formatDate(shiftRange.first)} → ${formatDate(shiftRange.last)}`
                            : formatDate(event.startDate) + (event.startDate !== event.endDate ? ` → ${formatDate(event.endDate)}` : '')
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                        <MapPin size={12} />
                        {event.address.split(',')[0]}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-full shadow-sm transition-all active:scale-95"
                          title="Ouvrir dans Google Maps"
                        >
                          <Navigation size={10} /> Maps
                        </a>
                      </div>
                      {exceptionDays.length > 0 && (
                        <p className="mt-1 text-[11px] font-medium text-amber-600">
                          sauf {exceptionDays.map(d => formatDateWithDay(d, today)).join(', ')}
                        </p>
                      )}
                    </div>
                    {expandedId === event.id ? (
                      <ChevronUp size={16} className="text-slate-400 mt-1" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-400 mt-1" />
                    )}
                  </button>

                  {expandedId === event.id && (
                    <div className="px-5 pb-5 pt-0 space-y-4 animate-fadeIn">
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 space-y-2.5 border border-slate-100">
                        <p className="text-sm text-slate-600">{event.description}</p>
                        {event.client && (
                          <p className="text-xs text-slate-400">
                            Client : <span className="font-medium text-slate-600">{event.client}</span>
                            {event.clientPhone && (
                              <a href={`tel:${event.clientPhone}`} className="ml-2 text-primary-600 hover:text-primary-700">
                                📞 {event.clientPhone}
                              </a>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          Période : {shiftRange
                            ? shiftRange.first === shiftRange.last
                              ? formatDate(shiftRange.first)
                              : `${formatDate(shiftRange.first)} → ${formatDate(shiftRange.last)}`
                            : formatDate(event.startDate) + (event.startDate !== event.endDate ? ` → ${formatDate(event.endDate)}` : '')
                          }
                        </p>
                        {event.shifts && event.shifts.length > 0 && (
                          <ShiftSchedule shifts={event.shifts} today={today} />
                        )}
                        <p className="text-xs text-slate-400">
                          Adresse : {event.address}
                        </p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
                        >
                          <Navigation size={16} /> Ouvrir dans Google Maps
                        </a>
                      </div>

                      {/* Agent response buttons */}
                      {agentResponse === 'pending' && user?.canRefuseEvents && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleResponse(event.id, 'accepted')}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                          >
                            <Check size={16} strokeWidth={2.5} /> Accepter
                          </button>
                          <button
                            onClick={() => handleResponse(event.id, 'refused')}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border-2 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                          >
                            <X size={16} strokeWidth={2.5} /> Refuser
                          </button>
                        </div>
                      )}

                      {agentResponse && agentResponse !== 'pending' && user?.canRefuseEvents && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Votre réponse :</span>
                          <StatusBadge status={agentResponse} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-card">
            <div className="inline-flex p-4 rounded-2xl bg-slate-50 mb-3">
              <Calendar size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">Aucune mission à venir</p>
            <p className="text-xs text-slate-300 mt-1">Vos nouvelles missions apparaîtront ici</p>
          </div>
        )}
      </div>
    </div>
  );
}
