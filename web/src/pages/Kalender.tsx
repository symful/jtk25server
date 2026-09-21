import { useState, useEffect, useMemo } from 'react';
import Markdown from 'react-markdown';
import { apiClient } from '../api';
import type { CalendarEvent, Pengganti } from '../types';
import { CLASS_LIST } from '../types';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

type CalendarItem =
  | { type: 'event'; event: CalendarEvent }
  | { type: 'pengganti'; entry: Pengganti };

type ViewMode = 'list' | 'grid';

// ---------------------------------------------------------------------------
// Timezone-safe date parsing (fixes UTC midnight drift)
// ---------------------------------------------------------------------------

/** Parse 'YYYY-MM-DD' into a local Date without timezone shift. */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format 'YYYY-MM-DD' as a stable key: 'YYYY-M-D' (day without zero-pad). */
function dateKey(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}-${m - 1}-${d}`;
}

// ---------------------------------------------------------------------------
// Grouped month list helpers
// ---------------------------------------------------------------------------

interface MonthGroup {
  year: number;
  month: number;
  label: string;
  items: CalendarItem[];
  hasFuture: boolean;
}

function groupByMonth(items: CalendarItem[]): MonthGroup[] {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const iso = item.type === 'event' ? item.event.date : item.entry.date;
    const d = parseLocalDate(iso);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groups: MonthGroup[] = [];
  for (const [key, items] of map) {
    const [y, m] = key.split('-').map(Number);
    const hasFuture = items.some((item) => {
      const iso = item.type === 'event' ? item.event.date : item.entry.date;
      return parseLocalDate(iso) >= today;
    });
    groups.push({
      year: y,
      month: m,
      label: `${MONTH_NAMES[m]} ${y}`,
      items: items.sort((a, b) => {
        const aIso = a.type === 'event' ? a.event.date : a.entry.date;
        const bIso = b.type === 'event' ? b.event.date : b.entry.date;
        return aIso.localeCompare(bIso);
      }),
      hasFuture,
    });
  }

  groups.sort((a, b) => {
    if (a.hasFuture && !b.hasFuture) return -1;
    if (!a.hasFuture && b.hasFuture) return 1;
    return b.year * 12 + b.month - (a.year * 12 + a.month);
  });

  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Kalender() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [pengganti, setPengganti] = useState<Pengganti[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth());
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get<CalendarEvent[]>('/calendar'),
      apiClient.get<Pengganti[]>('/pengganti'),
    ])
      .then(([cal, pg]) => {
        setEvents(cal);
        setPengganti(pg);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat data kalender');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const filteredEvents = useMemo(() => {
    if (!selectedClass) return events;
    return events.filter((e) => !e.class_name || e.class_name === selectedClass);
  }, [events, selectedClass]);

  const filteredPengganti = useMemo(() => {
    if (!selectedClass) return pengganti;
    const classCode = selectedClass.replace(/_/g, '-');
    return pengganti.filter((p) => p.class_code === classCode);
  }, [pengganti, selectedClass]);

  const allItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];
    for (const event of filteredEvents) {
      items.push({ type: 'event', event });
    }
    for (const entry of filteredPengganti) {
      items.push({ type: 'pengganti', entry });
    }
    return items;
  }, [filteredEvents, filteredPengganti]);

  const dateMap = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const event of filteredEvents) {
      const key = dateKey(event.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ type: 'event', event });

      if (event.end_date) {
        const endKey = dateKey(event.end_date);
        if (endKey !== key && !map.has(endKey)) {
          map.set(endKey, [{ type: 'event', event }]);
        }
      }
    }

    for (const entry of filteredPengganti) {
      const key = dateKey(entry.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ type: 'pengganti', entry });
    }

    return map;
  }, [filteredEvents, filteredPengganti]);

  const monthGroups = useMemo(() => groupByMonth(allItems), [allItems]);

  const selectedItems = useMemo(() => {
    if (!selectedDate) return null;
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return dateMap.get(key) ?? null;
  }, [selectedDate, dateMap]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const totalCells = startWeekday + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  const today = new Date();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6 animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Kalender</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-700 dark:text-red-300 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/60 transition"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kalender</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              viewMode === 'list'
                ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Daftar
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Kalender
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedClass(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
            selectedClass === null
              ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          Semua
        </button>
        {CLASS_LIST.map((code) => (
          <button
            key={code}
            onClick={() => setSelectedClass(selectedClass === code ? null : code)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
              selectedClass === code
                ? 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {code}
          </button>
        ))}
      </div>

      {viewMode === 'list' ? (
        <ListView
          monthGroups={monthGroups}
          today={today}
          onJumpToMonth={(y, m) => {
            setCurrentMonth(new Date(y, m));
            setViewMode('grid');
          }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-900 dark:text-gray-100">{MONTH_NAMES[month]} {year}</span>
              <button
                onClick={() => {
                  setCurrentMonth(new Date(today.getFullYear(), today.getMonth()));
                  setSelectedDate(today);
                }}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition"
              >
                Hari ini
              </button>
            </div>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">{d}</div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                {Array.from({ length: 7 }, (_, col) => {
                  const cellIndex = row * 7 + col;
                  const dayNum = cellIndex - startWeekday + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) {
                    return <div key={col} className="h-14 sm:h-16 border-r border-gray-200 dark:border-gray-700 last:border-r-0" />;
                  }

                  const date = new Date(year, month, dayNum);
                  const isToday = date.toDateString() === today.toDateString();
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  const key = `${year}-${month}-${dayNum}`;
                  const items = dateMap.get(key);
                  const hasItems = items && items.length > 0;
                  const hasPengganti = hasItems && items!.some((i) => i.type === 'pengganti');

                  return (
                    <button
                      key={col}
                      onClick={() => setSelectedDate(date)}
                      className={`h-14 sm:h-16 p-1 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                        isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      }`}
                    >
                      <span className={`text-sm ${
                        isToday ? 'font-bold text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500 rounded' : isSelected ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {dayNum}
                      </span>
                      {hasItems && (
                        <div className="flex gap-0.5 mt-0.5 justify-center">
                          {hasPengganti && (
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          )}
                          {Array.from({ length: Math.min(items!.filter((i) => i.type === 'event').length, 2) }, (_, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-4">
            {selectedDate === null ? (
              <p className="text-center text-gray-400 dark:text-gray-500 py-8">Pilih tanggal untuk melihat acara</p>
            ) : !selectedItems || selectedItems.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 py-8">
                Tidak ada acara pada {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </p>
            ) : (
              <div className="space-y-2">
                {selectedItems.map((item, i) => renderCalendarItem(item, i))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List View — grouped by month
// ---------------------------------------------------------------------------

function ListView({ monthGroups, today, onJumpToMonth }: {
  monthGroups: MonthGroup[];
  today: Date;
  onJumpToMonth: (year: number, month: number) => void;
}) {
  if (monthGroups.length === 0) {
    return (
      <p className="text-center text-gray-400 dark:text-gray-500 py-12">
        Tidak ada acara yang cocok dengan filter
      </p>
    );
  }

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {monthGroups.map((group) => (
        <div key={`${group.year}-${group.month}`}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{group.label}</h2>
            <button
              onClick={() => onJumpToMonth(group.year, group.month)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Lihat kalender
            </button>
          </div>
          <div className="space-y-2">
            {group.items.map((item, i) => {
              const iso = item.type === 'event' ? item.event.date : item.entry.date;
              const itemKey = dateKey(iso);
              const isPast = dateKey(iso) < todayStr;
              return (
                <div key={`${itemKey}-${i}`} className={isPast ? 'opacity-50' : ''}>
                  {renderCalendarItem(item, i, isPast)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared item renderer
// ---------------------------------------------------------------------------

function renderCalendarItem(item: CalendarItem, index: number, isPast = false) {
  if (item.type === 'pengganti') {
    const pg = item.entry;
    return (
      <div key={`pg-${pg.id}-${index}`} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          pg.kind === 'replace' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800'
          : pg.kind === 'add' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              pg.kind === 'replace' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : pg.kind === 'add' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            }`}>
              {pg.kind === 'replace' ? 'Ganti' : pg.kind === 'add' ? 'Tambah' : 'Info'}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{pg.class_code}</span>
            {isPast && <span className="text-[10px] text-gray-400 dark:text-gray-500">sudah lewat</span>}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{pg.date}</span>
        </div>
        {pg.sessions.length > 0 && (
          <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
            {pg.sessions.length} sesi
          </div>
        )}
      </div>
    );
  }

  const event = item.event;
  const isMultiDay = event.end_date && event.end_date !== event.date;

  return (
    <div key={`ev-${event.id}-${index}`} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{event.title}</h3>
            {event.category && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{event.category}</span>
            )}
            {isMultiDay && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                s/d {formatEndDate(event.end_date)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatDateRange(event.date, event.end_date)}</p>
          {event.location && <p className="text-sm text-gray-500 dark:text-gray-400">{event.location}</p>}
          {event.description && (
            <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-400 mt-2"><Markdown>{event.description}</Markdown></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatEndDate(endIso: string): string {
  const end = parseLocalDate(endIso);
  return `${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`;
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = parseLocalDate(startIso);
  const end = parseLocalDate(endIso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${start.toLocaleDateString('id-ID', opts)} – ${end.toLocaleDateString('id-ID', opts)}`;
}
