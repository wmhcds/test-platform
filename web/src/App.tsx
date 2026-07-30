import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Report from './pages/Report'
import TestCaseManager from './pages/TestCaseManager'
import InviteCodes from './pages/InviteCodes'
import UserManagement from './pages/UserManagement'
import SchedulerConfig from './pages/SchedulerConfig'
import DatabaseConfig from './pages/DatabaseConfig'
import HttpRequestConfig from './pages/HttpRequestConfig'
import Login from './pages/Login'

function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export default function App() {
  const [token, setToken] = useState<string | null>(getToken())

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_role')
    localStorage.removeItem('auth_username')
    setToken(null)
  }

  if (!token) {
    return <Login onLoginSuccess={(t) => setToken(t)} />
  }

  return (
    <AppLayout onLogout={handleLogout}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai/batches" element={<BatchList />} />
        <Route path="/ai/test-cases" element={<TestCaseManager />} />
        <Route path="/ai/batch/:id" element={<BatchDetail />} />
        <Route path="/ai/report/:id" element={<Report />} />
        <Route path="/user/users" element={<UserManagement />} />
        <Route path="/user/invite-codes" element={<InviteCodes />} />
        <Route path="/config/scheduler" element={<SchedulerConfig />} />
        <Route path="/config/database" element={<DatabaseConfig />} />
        <Route path="/http/request" element={<HttpRequestConfig />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  )
}
