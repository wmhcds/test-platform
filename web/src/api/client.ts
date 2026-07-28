import axios from 'axios'

// API 基础地址（由 Vite 构建时注入，或自动检测运行环境）
// - 本地开发: /api（Vite 代理 → localhost:8000）
// - CloudBase: https://your-service.run.tcloudbase.com/api（通过 VITE_API_BASE_URL 注入）
// - Docker: /api（Nginx 反向代理 → server:8000）
declare const __API_BASE_URL__: string

const http = axios.create({
  baseURL: __API_BASE_URL__,
  timeout: 120000, // 测试执行可能较慢，120 秒超时
})

// 请求拦截器：自动附带 token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 时清除 token 并刷新页面（强制跳转登录页）
http.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.reload()
    }
    return Promise.reject(error)
  },
)

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
  batch_id: number | null
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

export interface TestCaseData {
  id: number
  name: string
  script_content: string
  created_at: string
  updated_at: string
}

export interface ExecuteResultData {
  ok: boolean
  case_name: string
  status: string
  duration: number
  output: string
  error_message: string
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

  // 测试用例管理
  listTestCases: (search?: string) =>
    http.get<TestCaseData[]>('/test-cases', { params: search ? { search } : {} }).then((r) => r.data),
  getTestCase: (id: number) =>
    http.get<TestCaseData>(`/test-cases/${id}`).then((r) => r.data),
  createTestCase: (data: { name: string; script_content: string }) =>
    http.post<TestCaseData>('/test-cases', data).then((r) => r.data),
  updateTestCase: (id: number, data: { name?: string; script_content?: string }) =>
    http.put<TestCaseData>(`/test-cases/${id}`, data).then((r) => r.data),
  deleteTestCase: (id: number) =>
    http.delete(`/test-cases/${id}`).then((r) => r.data),
  executeTestCase: (id: number) =>
    http.post<ExecuteResultData>(`/test-cases/${id}/execute`).then((r) => r.data),
  batchExecute: (caseIds: number[], batchName: string) =>
    http.post('/test-cases/batch-execute', { case_ids: caseIds, batch_name: batchName }).then((r) => r.data),
}

export default api
