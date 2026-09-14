import { useState, useEffect, useMemo } from 'react';
import Markdown from 'react-markdown';
import { apiClient } from '../api';
import type { CalendarEvent } from '../types';
import { CLASS_LIST } from '../types';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function Kalender() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth());
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<CalendarEvent[]>('/calendar')
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = useMemo(() => {
    if (!selectedClass) return events;
    return events.filter((e) => !e.class_name || e.class_name === selectedClass);
  }, [events, selectedClass]);

  const dateMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const d = new Date(event.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);

      if (event.end_date) {
        const end = new Date(event.end_date);
        if (end.toDateString() !== d.toDateString()) {
          const eKey = `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`;
          if (!map.has(eKey)) map.set(eKey, []);
          map.get(eKey)!.push(event);
        }
      }
    }
    return map;
  }, [filteredEvents]);

  const selectedEvents = useMemo(() => {
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
        <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse" />
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Kalender</h1>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedClass(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
            selectedClass === null
              ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
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
                ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {code}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-1 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="font-bold text-gray-900">{MONTH_NAMES[month]} {year}</span>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-1 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500">{d}</div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="grid grid-cols-7 border-b last:border-b-0">
            {Array.from({ length: 7 }, (_, col) => {
              const cellIndex = row * 7 + col;
              const dayNum = cellIndex - startWeekday + 1;
              if (dayNum < 1 || dayNum > daysInMonth) {
                return <div key={col} className="h-14 sm:h-16 border-r last:border-r-0" />;
              }

              const date = new Date(year, month, dayNum);
              const isToday = date.toDateString() === today.toDateString();
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const key = `${year}-${month}-${dayNum}`;
              const hasEvents = dateMap.has(key) && dateMap.get(key)!.length > 0;

              return (
                <button
                  key={col}
                  onClick={() => setSelectedDate(date)}
                  className={`h-14 sm:h-16 p-1 text-left hover:bg-gray-50 transition border-r last:border-r-0 ${
                    isSelected ? 'bg-indigo-50' : ''
                  }`}
                >
                  <span className={`text-sm ${
                    isToday ? 'font-bold text-indigo-600 ring-2 ring-indigo-500 rounded' : isSelected ? 'font-bold text-indigo-600' : 'text-gray-700'
                  }`}>
                    {dayNum}
                  </span>
                  {hasEvents && (
                    <div className="flex gap-0.5 mt-0.5 justify-center">
                      {Array.from({ length: Math.min(dateMap.get(key)!.length, 2) }, (_, i) => (
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
          <p className="text-center text-gray-400 py-8">Pilih tanggal untuk melihat acara</p>
        ) : !selectedEvents || selectedEvents.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            Tidak ada acara pada {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </p>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((event, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{event.title}</h3>
                      {event.category && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{event.category}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{formatDateRange(event.date, event.end_date)}</p>
                    {event.location && <p className="text-sm text-gray-500">{event.location}</p>}
                    {event.description && (
                      <div className="prose prose-sm max-w-none text-gray-600 mt-2"><Markdown>{event.description}</Markdown></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${start.toLocaleDateString('id-ID', opts)} – ${end.toLocaleDateString('id-ID', opts)}`;
}
