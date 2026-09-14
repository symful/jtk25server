import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';

import Home from './pages/Home';
import Jadwal from './pages/Jadwal';
import KalenderPage from './pages/Kalender';
import PengumumanPage from './pages/Pengumuman';
import RuanganPage from './pages/Ruangan';

import Login from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminJadwal from './pages/admin/AdminJadwal';
import AdminKalender from './pages/admin/AdminKalender';
import AdminPengumuman from './pages/admin/AdminPengumuman';
import AdminPengganti from './pages/admin/AdminPengganti';
import AdminRuangan from './pages/admin/AdminRuangan';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Layout><AdminDashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/jadwal"
            element={
              <ProtectedRoute>
                <Layout><AdminJadwal /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/kalender"
            element={
              <ProtectedRoute>
                <Layout><AdminKalender /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/pengumuman"
            element={
              <ProtectedRoute>
                <Layout><AdminPengumuman /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/pengganti"
            element={
              <ProtectedRoute>
                <Layout><AdminPengganti /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ruangan"
            element={
              <ProtectedRoute>
                <Layout><AdminRuangan /></Layout>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/jadwal" element={<Layout><Jadwal /></Layout>} />
          <Route path="/kalender" element={<Layout><KalenderPage /></Layout>} />
          <Route path="/pengumuman" element={<Layout><PengumumanPage /></Layout>} />
          <Route path="/ruangan" element={<Layout><RuanganPage /></Layout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
