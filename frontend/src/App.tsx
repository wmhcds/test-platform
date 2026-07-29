import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Report from './pages/Report'

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<BatchList />} />
        <Route path="/batch/:id" element={<BatchDetail />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}
