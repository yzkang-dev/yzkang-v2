import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EldersProvider } from './context/EldersContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ElderList from './pages/ElderList';
import ElderDetail from './pages/ElderDetail';
import ElderForm from './pages/ElderForm';
import CareRecords from './pages/CareRecords';
import Bills from './pages/Bills';
import Medications from './pages/Medications';
import ShiftRecords from './pages/ShiftRecords';
import VitalSigns from './pages/VitalSigns';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';
import RoleManagement from './pages/RoleManagement';
import Approvals from './pages/Approvals';
import ContractPayments from './pages/ContractPayments';
import VideoMonitoring from './pages/VideoMonitoring';
import AuditLogs from './pages/AuditLogs';
import AppLayout from './components/AppLayout';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user.username) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <EldersProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="elders" element={<ElderList />} />
            <Route path="elders/new" element={<ElderForm />} />
            <Route path="elders/:id" element={<ElderDetail />} />
            <Route path="care-records" element={<CareRecords />} />
            <Route path="bills" element={<Bills />} />
            <Route path="medications" element={<Medications />} />
            <Route path="shifts" element={<ShiftRecords />} />
            <Route path="vital-signs" element={<VitalSigns />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="roles" element={<RoleManagement />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="contracts" element={<ContractPayments />} />
            <Route path="video-monitoring" element={<VideoMonitoring />} />
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>
        </Routes>
      </EldersProvider>
    </AuthProvider>
  );
}
