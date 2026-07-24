import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Report from './pages/Report'
import HttpClient from './pages/HttpClient'
import Login from './pages/Login'

function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export default function App() {
  const [token, setToken] = useState<string | null>(getToken())

  if (!token) {
    return <Login onLoginSuccess={(t) => setToken(t)} />
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<BatchList />} />
        <Route path="/batch/:id" element={<BatchDetail />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="/http" element={<HttpClient />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}
