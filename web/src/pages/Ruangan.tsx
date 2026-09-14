import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api';
import type { Room, SchedulesResponse, ScheduleSession, Pengganti } from '../types';
import { DAYS } from '../types';

type ViewMode = 'jadwal' | 'matriks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map day names (SENIN..JUMAT) -> YYYY-MM-DD for the current week. */
function getCurrentWeekDates(): Record<string, string> {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const result: Record<string, string> = {};
  DAYS.forEach((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result[day] =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  return result;
}

/**
 * Build the effective room -> day -> sessions map from schedules + pengganti.
 *
 * For each day in the current week the pengganti entries are applied:
 * - replace: removes base sessions at matching times, inserts pengganti sessions
 * - add: appends pengganti sessions
 * - info: ignored
 */
function buildEffectiveSessions(
  schedules: SchedulesResponse | null,
  pengganti: Pengganti[],
): Map<string, Map<string, ScheduleSession[]>> {
  const map = new Map<string, Map<string, ScheduleSession[]>>();
  if (!schedules) return map;

  for (const cls of schedules.classes) {
    for (const ds of cls.schedule) {
      for (const s of ds.sessions) {
        if (!map.has(s.room)) map.set(s.room, new Map());
        const roomDays = map.get(s.room)!;
        if (!roomDays.has(ds.day)) roomDays.set(ds.day, []);
        roomDays.get(ds.day)!.push(s);
      }
    }
  }

  const weekDates = getCurrentWeekDates();
  for (const day of DAYS) {
    const dateStr = weekDates[day];
    if (!dateStr) continue;
    const dayEntries = pengganti.filter((e) => e.date === dateStr);
    for (const entry of dayEntries) {
      if (entry.kind === 'info') continue;

      if (entry.kind === 'replace') {
        const replaceTimes = new Set(entry.sessions.map((s) => s.time));

        const classSchedule = schedules.classes.find(
          (c) => c.class_name === entry.class_code,
        );
        if (classSchedule) {
          const baseDay = classSchedule.schedule.find((s) => s.day === day);
          if (baseDay) {
            for (const base of baseDay.sessions) {
              if (replaceTimes.has(base.time)) {
                const roomDays = map.get(base.room);
                if (roomDays) {
                  const sessions = roomDays.get(day);
                  if (sessions) {
                    roomDays.set(
                      day,
                      sessions.filter((s) => s.time !== base.time),
                    );
                  }
                }
              }
            }
          }
        }

        for (const ps of entry.sessions) {
          if (!map.has(ps.room)) map.set(ps.room, new Map());
          const roomDays = map.get(ps.room)!;
          if (!roomDays.has(day)) roomDays.set(day, []);
          roomDays.get(day)!.push({
            time: ps.time,
            course_code: ps.course_code,
            course_name: ps.course_name,
            type: ps.type,
            lecturer_code: '',
            lecturer: ps.lecturer,
            room: ps.room,
          });
        }
      } else if (entry.kind === 'add') {
        for (const ps of entry.sessions) {
          if (!map.has(ps.room)) map.set(ps.room, new Map());
          const roomDays = map.get(ps.room)!;
          if (!roomDays.has(day)) roomDays.set(day, []);
          roomDays.get(day)!.push({
            time: ps.time,
            course_code: ps.course_code,
            course_name: ps.course_name,
            type: ps.type,
            lecturer_code: '',
            lecturer: ps.lecturer,
            room: ps.room,
          });
        }
      }
    }
  }

  return map;
}

/** Set of "room:day:hour" keys affected by pengganti (for visual indicator). */
function buildPenggantiCells(pengganti: Pengganti[]): Set<string> {
  const cells = new Set<string>();
  const weekDates = getCurrentWeekDates();
  for (const day of DAYS) {
    const dateStr = weekDates[day];
    if (!dateStr) continue;
    for (const entry of pengganti.filter((e) => e.date === dateStr)) {
      if (entry.kind === 'info') continue;
      for (const ps of entry.sessions) {
        const parts = ps.time.split('-');
        if (parts.length === 2) {
          const [sh] = parts[0].split('.').map(Number);
          cells.add(`${ps.room}:${day}:${sh}`);
        }
      }
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Ruangan() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<SchedulesResponse | null>(null);
  const [pengganti, setPengganti] = useState<Pengganti[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS[0]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('jadwal');
  const [filterMode, setFilterMode] = useState<'all' | 'available'>('all');

  useEffect(() => {
    Promise.all([
      apiClient.get<Room[]>('/rooms'),
      apiClient.get<SchedulesResponse>('/schedules'),
      apiClient.get<Pengganti[]>('/pengganti'),
    ])
      .then(([r, s, p]) => { setRooms(r); setSchedules(s); setPengganti(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const effectiveSessions = useMemo(
    () => buildEffectiveSessions(schedules, pengganti),
    [schedules, pengganti],
  );

  const penggantiCells = useMemo(() => buildPenggantiCells(pengganti), [pengganti]);

  const occupancy = useMemo(() => {
    return rooms.map((room) => {
      const roomDays = effectiveSessions.get(room.ext_id);
      const sessionsArray = roomDays
        ? Array.from(roomDays.entries()).map(([day, sessions]) => ({ day, sessions }))
        : [];
      const daySessions = roomDays?.get(selectedDay) || [];
      return {
        room,
        sessions: sessionsArray,
        occupied: daySessions.length > 0,
      };
    });
  }, [rooms, effectiveSessions, selectedDay]);

  const filtered = useMemo(() => {
    let result = occupancy;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o) => o.room.name.toLowerCase().includes(q));
    }
    if (filterMode === 'available') {
      result = result.filter((o) => !o.occupied);
    }
    return result;
  }, [occupancy, search, filterMode]);

  const availableCount = occupancy.filter((o) => !o.occupied).length;

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6 animate-pulse" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ruangan</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button onClick={() => setView('jadwal')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'jadwal' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>Jadwal</button>
          <button onClick={() => setView('matriks')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'matriks' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>Matriks</button>
        </div>
      </div>

      {view === 'jadwal' ? (
        <>
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            {DAYS.map((d) => (
              <button key={d} onClick={() => setSelectedDay(d)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${selectedDay === d ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{d}</button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Cari ruangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg mb-3 text-sm"
          />

          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-4 py-2 mb-3 text-sm text-indigo-700 dark:text-indigo-300 font-medium">
            {availableCount} dari {rooms.length} ruangan tersedia
          </div>

          <div className="space-y-1">
            {filtered.map((o) => (
              <div key={o.room.id} className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 px-4 py-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${o.occupied ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  {o.occupied
                    ? <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    : <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  }
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{o.room.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {o.occupied
                      ? o.sessions.find((e) => e.day === selectedDay)?.sessions[0]
                        ? `${o.sessions.find((e) => e.day === selectedDay)!.sessions[0].course_code} · ${o.sessions.find((e) => e.day === selectedDay)!.sessions[0].time}`
                        : 'Terpakai'
                      : o.room.type === 'lab' ? 'Laboratorium' : 'Ruang Kelas'
                    }
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${o.room.type === 'lab' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                  {o.room.type === 'lab' ? 'Lab' : 'Kelas'}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <MatrixView rooms={rooms} effectiveSessions={effectiveSessions} penggantiCells={penggantiCells} filterMode={filterMode} setFilterMode={setFilterMode} />
      )}
    </div>
  );
}

function MatrixView({ rooms, effectiveSessions, penggantiCells, filterMode, setFilterMode }: {
  rooms: Room[];
  effectiveSessions: Map<string, Map<string, ScheduleSession[]>>;
  penggantiCells: Set<string>;
  filterMode: 'all' | 'available';
  setFilterMode: (m: 'all' | 'available') => void;
}) {
  const dayLabels = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
  const timeSlots = ['07.00', '08.00', '09.00', '10.00', '11.00', '12.00', '13.00', '14.00', '15.00', '16.00'];

  const isOccupied = (roomName: string, day: string, hour: number): ScheduleSession | null => {
    const sessions = effectiveSessions.get(roomName)?.get(day) || [];
    for (const s of sessions) {
      const parts = s.time.split('-');
      if (parts.length === 2) {
        const [sh, sm] = parts[0].split('.').map(Number);
        const [eh, em] = parts[1].split('.').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const slotMin = hour * 60;
        if (slotMin >= startMin && slotMin < endMin) return s;
      }
    }
    return null;
  };

  const now = new Date();
  const currentDay = DAYS[now.getDay() - 1];
  const currentHour = now.getHours();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setFilterMode(filterMode === 'all' ? 'available' : 'all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${filterMode === 'available' ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700'}`}>
          {filterMode === 'available' ? 'Tersedia sekarang' : 'Semua'}
        </button>
      </div>

      <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" /> Terpakai</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" /> Tersedia</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700" /> Pengganti</span>
      </div>

      <div className="space-y-4">
        {rooms.map((room) => {
          const roomAvailable = dayLabels.every((d) => timeSlots.every((t) => {
            const h = parseInt(t.split('.')[0]);
            return isOccupied(room.ext_id, d, h) === null;
          }));
          if (filterMode === 'available' && !roomAvailable) return null;

          return (
            <div key={room.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${roomAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{room.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${room.type === 'lab' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>{room.type}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left text-gray-500 dark:text-gray-400 font-medium w-16"></th>
                      {dayLabels.map((d) => (
                        <th key={d} className="px-2 py-1 text-center text-gray-500 dark:text-gray-400 font-medium">{d.slice(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((t) => (
                      <tr key={t}>
                        <td className="px-2 py-1 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{t}</td>
                        {dayLabels.map((d) => {
                          const h = parseInt(t.split('.')[0]);
                          const session = isOccupied(room.ext_id, d, h);
                          const isNow = d === currentDay && h === currentHour;
                          const isPengganti = penggantiCells.has(`${room.ext_id}:${d}:${h}`);
                          return (
                            <td key={d} className="px-1 py-1">
                              <div className={`h-8 rounded flex items-center justify-center ${
                                isPengganti
                                  ? 'bg-amber-100 border border-amber-300 dark:bg-amber-900/20 dark:border-amber-700'
                                  : session
                                    ? 'bg-red-100 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                    : 'bg-green-50 border border-green-100 dark:bg-green-900/10 dark:border-green-800'
                              } ${isNow ? 'ring-2 ring-indigo-500' : ''}`}>
                                {session && (
                                  <span className={`text-[8px] font-medium text-center leading-tight px-0.5 truncate max-w-full ${isPengganti ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                                    {session.course_code}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
