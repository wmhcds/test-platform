import axios from 'axios'

// 所有请求走相对路径 /api，由 Vite 开发代理转发到 FastAPI 后端
const http = axios.create({ baseURL: '/api' })

export interface BatchSummary {
  id: number
  batch_name: string
  start_time: string | null
  end_time: string | null
  total_cases: number
  passed: number
  failed: number
  rate: string
}

export interface CaseRun {
  id: number
  case_name: string
  case_path: string
  status: string
  duration: number | null
  total: number
  passed: number
  failed: number
  skipped: number
  error_message: string
}

export interface BatchDetailData extends BatchSummary {
  cases: CaseRun[]
}

export interface ReportData {
  id: number
  batch_name: string
  start_time: string | null
  end_time: string | null
  total: number
  passed: number
  failed: number
  rate: string
  failed_cases: { case_name: string; case_path: string; status: string }[]
}

export interface CaseSourceData {
  case_name: string
  file_path: string
  start_line: number
  source: string
}

export const api = {
  listBatches: () => http.get<BatchSummary[]>('/batches').then((r) => r.data),
  getBatch: (id: number) =>
    http.get<BatchDetailData>(`/batches/${id}`).then((r) => r.data),
  getReport: (id: number) =>
    http.get<ReportData>(`/batches/${id}/report`).then((r) => r.data),
  getCaseSource: (casePath: string, caseName: string) =>
    http
      .get<CaseSourceData>('/batches/case/source', { params: { case_path: casePath, case_name: caseName } })
      .then((r) => r.data),
  runTests: () => http.post('/run-tests').then((r) => r.data),
  rerunBatch: (id: number) =>
    http.post(`/batches/${id}/rerun`).then((r) => r.data),
  sendHttp: (formData: FormData) =>
    http.post('/http/send', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
}

export default api
