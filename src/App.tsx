import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import Login from './pages/Login';
import AdminLayout from './components/layout/AdminLayout';
import AgentLayout from './components/layout/AgentLayout';
import ClientLayout from './components/layout/ClientLayout';

import AdminDashboard from './pages/admin/Dashboard';
import Planning from './pages/admin/Planning';
import AdminAttendance from './pages/admin/Attendance';
import Users from './pages/admin/Users';
import HoursTracking from './pages/admin/HoursTracking';
import Gestion from './pages/admin/Gestion';
import Recap from './pages/admin/Recap';
import Clients from './pages/admin/Clients';
import EmailNotifications from './pages/admin/EmailNotifications';

import AgentDashboard from './pages/agent/AgentDashboard';
import MyPlanning from './pages/agent/MyPlanning';
import CheckIn from './pages/agent/CheckIn';
import MyHours from './pages/agent/MyHours';

import ClientDashboard from './pages/client/ClientDashboard';
import ClientSites from './pages/client/ClientSites';
import ClientMissions from './pages/client/ClientMissions';
import ClientPhotos from './pages/client/ClientPhotos';
import ClientSubAccounts from './pages/client/ClientSubAccounts';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, isAuthenticated, initAuth } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    initAuth().finally(() => setAuthLoading(false));
  }, [initAuth]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

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
        <Route path="clients" element={<Clients />} />
        <Route path="utilisateurs" element={<Users />} />
        <Route path="heures" element={<HoursTracking />} />
        <Route path="gestion" element={<Gestion />} />
        <Route path="recap" element={<Recap />} />
        <Route path="emails" element={<EmailNotifications />} />
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

      {/* Client Routes */}
      <Route
        path="/client"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboard />} />
        <Route path="sites" element={<ClientSites />} />
        <Route path="missions" element={<ClientMissions />} />
        <Route path="photos" element={<ClientPhotos />} />
        <Route path="equipe" element={<ClientSubAccounts />} />
      </Route>

      {/* Default redirect */}
      <Route
        path="*"
        element={
          isAuthenticated && user ? (
            <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'client' ? '/client' : '/agent'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
