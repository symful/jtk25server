import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api';
import type { Room, SchedulesResponse, DaySchedule, ScheduleSession } from '../types';
import { DAYS } from '../types';

type ViewMode = 'jadwal' | 'matriks';

interface RoomOccupancy {
  room: Room;
  sessions: { day: string; sessions: ScheduleSession[] }[];
  occupied: boolean;
}

export default function Ruangan() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<SchedulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS[0]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('jadwal');
  const [filterMode, setFilterMode] = useState<'all' | 'available'>('all');

  useEffect(() => {
    Promise.all([
      apiClient.get<Room[]>('/rooms'),
      apiClient.get<SchedulesResponse>('/schedules'),
    ])
      .then(([r, s]) => { setRooms(r); setSchedules(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const occupancy = useMemo(() => {
    if (!schedules) return [];
    const roomSessions = new Map<string, { day: string; sessions: ScheduleSession[] }[]>();
    for (const cls of schedules.classes) {
      for (const daySchedule of cls.schedule) {
        for (const session of daySchedule.sessions) {
          const existing = roomSessions.get(session.room) || [];
          const dayEntry = existing.find((e) => e.day === daySchedule.day);
          if (dayEntry) {
            dayEntry.sessions.push(session);
          } else {
            existing.push({ day: daySchedule.day, sessions: [session] });
          }
          roomSessions.set(session.room, existing);
        }
      }
    }
    return rooms.map((room) => ({
      room,
      sessions: roomSessions.get(room.ext_id) || [],
      occupied: (roomSessions.get(room.ext_id) || []).some((e) => e.day === selectedDay && e.sessions.length > 0),
    }));
  }, [rooms, schedules, selectedDay]);

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

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8"><div className="h-8 bg-gray-200 rounded w-32 mb-6 animate-pulse" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Ruangan</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setView('jadwal')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'jadwal' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}>Jadwal</button>
          <button onClick={() => setView('matriks')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'matriks' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}>Matriks</button>
        </div>
      </div>

      {view === 'jadwal' ? (
        <>
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            {DAYS.map((d) => (
              <button key={d} onClick={() => setSelectedDay(d)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${selectedDay === d ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{d}</button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Cari ruangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm"
          />

          <div className="bg-indigo-50 rounded-lg px-4 py-2 mb-3 text-sm text-indigo-700 font-medium">
            {availableCount} dari {rooms.length} ruangan tersedia
          </div>

          <div className="space-y-1">
            {filtered.map((o) => (
              <div key={o.room.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-4 py-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${o.occupied ? 'bg-red-50' : 'bg-green-50'}`}>
                  {o.occupied
                    ? <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    : <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  }
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">{o.room.name}</div>
                  <div className="text-xs text-gray-500">
                    {o.occupied
                      ? o.sessions.find((e) => e.day === selectedDay)?.sessions[0]
                        ? `${o.sessions.find((e) => e.day === selectedDay)!.sessions[0].course_code} · ${o.sessions.find((e) => e.day === selectedDay)!.sessions[0].time}`
                        : 'Terpakai'
                      : o.room.type === 'lab' ? 'Laboratorium' : 'Ruang Kelas'
                    }
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${o.room.type === 'lab' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                  {o.room.type === 'lab' ? 'Lab' : 'Kelas'}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <MatrixView rooms={rooms} schedules={schedules} filterMode={filterMode} setFilterMode={setFilterMode} />
      )}
    </div>
  );
}

function MatrixView({ rooms, schedules, filterMode, setFilterMode }: { rooms: Room[]; schedules: SchedulesResponse | null; filterMode: 'all' | 'available'; setFilterMode: (m: 'all' | 'available') => void }) {
  const dayLabels = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
  const timeSlots = ['07.00', '08.00', '09.00', '10.00', '11.00', '12.00', '13.00', '14.00', '15.00', '16.00'];

  const isOccupied = (roomName: string, day: string, hour: number) => {
    if (!schedules) return null;
    for (const cls of schedules.classes) {
      for (const ds of cls.schedule) {
        if (ds.day !== day) continue;
        for (const s of ds.sessions) {
          if (s.room !== roomName) continue;
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
        <button onClick={() => setFilterMode(filterMode === 'all' ? 'available' : 'all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${filterMode === 'available' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-300'}`}>
          {filterMode === 'available' ? 'Tersedia sekarang' : 'Semua'}
        </button>
      </div>

      <div className="flex gap-2 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Terpakai</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> Tersedia</span>
      </div>

      <div className="space-y-4">
        {rooms.map((room) => {
          const roomAvailable = dayLabels.every((d) => timeSlots.every((t) => {
            const h = parseInt(t.split('.')[0]);
            return isOccupied(room.ext_id, d, h) === null;
          }));
          if (filterMode === 'available' && !roomAvailable) return null;

          return (
            <div key={room.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${roomAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-medium text-sm text-gray-900">{room.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${room.type === 'lab' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{room.type}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left text-gray-500 font-medium w-16"></th>
                      {dayLabels.map((d) => (
                        <th key={d} className="px-2 py-1 text-center text-gray-500 font-medium">{d.slice(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((t) => (
                      <tr key={t}>
                        <td className="px-2 py-1 text-gray-500 font-medium whitespace-nowrap">{t}</td>
                        {dayLabels.map((d) => {
                          const h = parseInt(t.split('.')[0]);
                          const session = isOccupied(room.ext_id, d, h);
                          const isNow = d === currentDay && h === currentHour;
                          return (
                            <td key={d} className="px-1 py-1">
                              <div className={`h-8 rounded flex items-center justify-center ${session ? 'bg-red-100 border border-red-200' : 'bg-green-50 border border-green-100'} ${isNow ? 'ring-2 ring-indigo-500' : ''}`}>
                                {session && (
                                  <span className="text-[8px] font-medium text-red-700 text-center leading-tight px-0.5 truncate max-w-full">
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
