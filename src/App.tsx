import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import Login from './pages/Login';
import AdminLayout from './components/layout/AdminLayout';
import AgentLayout from './components/layout/AgentLayout';

import AdminDashboard from './pages/admin/Dashboard';
import Planning from './pages/admin/Planning';
import AdminAttendance from './pages/admin/Attendance';
import Users from './pages/admin/Users';
import HoursTracking from './pages/admin/HoursTracking';

import AgentDashboard from './pages/agent/AgentDashboard';
import MyPlanning from './pages/agent/MyPlanning';
import CheckIn from './pages/agent/CheckIn';
import MyHours from './pages/agent/MyHours';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="planning" element={<Planning />} />
        <Route path="pointage" element={<AdminAttendance />} />
        <Route path="utilisateurs" element={<Users />} />
        <Route path="heures" element={<HoursTracking />} />
      </Route>

      {/* Agent Routes */}
      <Route
        path="/agent"
        element={
          <ProtectedRoute allowedRoles={['agent']}>
            <AgentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AgentDashboard />} />
        <Route path="planning" element={<MyPlanning />} />
        <Route path="pointage" element={<CheckIn />} />
        <Route path="heures" element={<MyHours />} />
      </Route>

      {/* Default redirect */}
      <Route
        path="*"
        element={
          isAuthenticated && user ? (
            <Navigate to={user.role === 'admin' ? '/admin' : '/agent'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
