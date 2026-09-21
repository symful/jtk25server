import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useState, useEffect, useRef } from 'react';
import {
  isPushSupported,
  requestNotificationPermission,
  subscribeWithClassSwap,
  subscribeGlobalOnly,
  unsubscribeFromAllTopics,
  onForegroundMessage,
} from '../firebase';
import { CLASS_LIST } from '../types';
import { showToast } from './Toast';

const NAV_ITEMS = [
  { path: '/', label: 'Beranda' },
  { path: '/jadwal', label: 'Jadwal' },
  { path: '/kalender', label: 'Kalender' },
  { path: '/pengumuman', label: 'Pengumuman' },
  { path: '/ruangan', label: 'Ruangan' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
              <img src="/favicon.png" alt="JTK25" className="w-8 h-8 rounded" />
              <span>JTK 25</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {isAuthenticated && (
                <Link
                  to="/admin"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-2 ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              <ThemeToggle onClick={toggleTheme} theme={theme} />
              <NotificationBell />
              {isAuthenticated ? (
                <button
                  onClick={logout}
                  className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Logout
                </button>
              ) : (
                <Link
                  to="/admin/login"
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                >
                  Login
                </Link>
              )}
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="px-4 py-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                    location.pathname === item.path
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <hr className="my-2 border-gray-200 dark:border-gray-700" />
              <div className="flex items-center gap-2 px-3 py-2">
                <ThemeToggle onClick={toggleTheme} theme={theme} />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {theme === 'dark' ? 'Mode gelap' : 'Mode terang'}
                </span>
              </div>
              <NotificationBell />
              {isAuthenticated ? (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    Admin Panel
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/admin/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          JTK 25 &copy; {new Date().getFullYear()} &middot; Politeknik Negeri Bandung &middot;{' '}
          <Link to="/privacy" className="hover:underline">Kebijakan Privasi</Link>
        </div>
      </footer>
    </div>
  );
}

function ThemeToggle({ onClick, theme }: { onClick: () => void; theme: 'light' | 'dark' }) {
  return (
    <button
      onClick={onClick}
      title={theme === 'dark' ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function NotificationBell() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>(
    () => localStorage.getItem('jtk25_selected_class') ?? '',
  );
  const [permissionDenied, setPermissionDenied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(isPushSupported());
    if ('Notification' in window) {
      const perm = Notification.permission;
      setEnabled(perm === 'granted');
      setPermissionDenied(perm === 'denied');
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const unsub = onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? 'JTK25';
      const body = payload.notification?.body ?? '';
      showToast(body ? `${title}: ${body}` : title, 'info');
    });
    return () => { unsub?.(); };
  }, [enabled]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const toggle = async () => {
    if (permissionDenied) return;
    if (enabled) {
      await unsubscribeFromAllTopics();
      setSelectedClass('');
      setEnabled(false);
      setDropdownOpen(false);
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      if (selectedClass) {
        await subscribeWithClassSwap(selectedClass);
      } else {
        await subscribeGlobalOnly();
      }
      setEnabled(true);
    }
  };

  const selectClass = async (classCode: string) => {
    if (!enabled || permissionDenied) return;
    setDropdownOpen(false);
    if (classCode) {
      await subscribeWithClassSwap(classCode);
      setSelectedClass(classCode);
    } else {
      await subscribeGlobalOnly();
      setSelectedClass('');
    }
  };

  if (!supported) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1">
        <button
          onClick={toggle}
          title={
            permissionDenied
              ? 'Notifikasi diblokir oleh browser'
              : enabled
                ? 'Notifikasi aktif'
                : 'Aktifkan notifikasi'
          }
          className={`p-2 rounded-lg transition-colors ${
            enabled
              ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          <svg className="w-5 h-5" fill={enabled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
        {enabled && (
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title="Pilih kelas notifikasi"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {permissionDenied && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 z-50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Notifikasi diblokir oleh browser. Silakan izinkan notifikasi di pengaturan browser.
          </p>
        </div>
      )}

      {dropdownOpen && enabled && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
          <button
            onClick={() => { selectClass(''); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              selectedClass === ''
                ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            Global saja
          </button>
          {CLASS_LIST.map((cls) => (
            <button
              key={cls}
              onClick={() => { selectClass(cls); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                selectedClass === cls
                  ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
