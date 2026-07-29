import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Report from './pages/Report'
import HttpClient from './pages/HttpClient'
import TestCaseManager from './pages/TestCaseManager'
import InviteCodes from './pages/InviteCodes'
import UserManagement from './pages/UserManagement'
import SchedulerConfig from './pages/SchedulerConfig'
import DatabaseConfig from './pages/DatabaseConfig'
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
        <Route path="/" element={<BatchList />} />
        <Route path="/batch/:id" element={<BatchDetail />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="/http" element={<HttpClient />} />
        <Route path="/test-cases" element={<TestCaseManager />} />
        <Route path="/invite-codes" element={<InviteCodes />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/config/scheduler" element={<SchedulerConfig />} />
        <Route path="/config/database" element={<DatabaseConfig />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  )
}
