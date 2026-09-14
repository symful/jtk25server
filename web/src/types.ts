export interface ScheduleSession {
  time: string;
  course_code: string;
  course_name: string;
  type: string;
  lecturer_code: string;
  lecturer: string;
  room: string;
}

export interface DaySchedule {
  day: string;
  sessions: ScheduleSession[];
}

export interface ClassSchedule {
  class_name: string;
  schedule: DaySchedule[];
}

export interface SchedulesResponse {
  semester: string;
  classes: ClassSchedule[];
}

export interface PenggantiSession {
  time: string;
  course_code: string;
  course_name: string;
  type: string;
  lecturer: string;
  room: string;
}

export interface Pengganti {
  id: number;
  ext_id: string;
  class_code: string;
  date: string;
  kind: 'replace' | 'add' | 'info';
  note: string | null;
  sessions: PenggantiSession[];
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: number;
  ext_id: string;
  title: string;
  body: string;
  pinned: number;
  created_at: string;
  expires_at: string | null;
}

export interface CalendarEvent {
  id: number;
  ext_id: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string;
  location: string | null;
  category: string | null;
  class_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: number;
  ext_id: string;
  name: string;
  type: 'kelas' | 'lab';
}

export interface AuthResult {
  ok: boolean;
  scope: 'global' | `class:${string}`;
}

export type AdminScope = 'global' | `class:${string}`;

export const CLASS_LIST = [
  'D3-2A', 'D3-2B',
  'D4-2A', 'D4-2B', 'D4-2C', 'D4-2D',
] as const;

export const DAYS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'] as const;
