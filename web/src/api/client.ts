import axios from 'axios'

declare const __API_BASE_URL__: string

const http = axios.create({
  baseURL: __API_BASE_URL__,
  timeout: 120000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

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

export interface TestCaseCategoryData {
  id: number
  name: string
  case_count: number
  created_at: string
}

export interface TestCaseData {
  id: number
  name: string
  script_content: string
  category_id: number | null
  category_name: string | null
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

export interface ConfigData {
  key: string
  value: string
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

  // 目录管理
  listCategories: () =>
    http.get<TestCaseCategoryData[]>('/test-cases/categories').then((r) => r.data),
  createCategory: (name: string) =>
    http.post<TestCaseCategoryData>('/test-cases/categories', { name }).then((r) => r.data),
  updateCategory: (id: number, name: string) =>
    http.put<TestCaseCategoryData>(`/test-cases/categories/${id}`, { name }).then((r) => r.data),
  deleteCategory: (id: number) =>
    http.delete(`/test-cases/categories/${id}`).then((r) => r.data),

  // 测试用例管理
  listTestCases: (search?: string, categoryId?: number) =>
    http.get<TestCaseData[]>('/test-cases', { params: { ...(search ? { search } : {}), ...(categoryId !== undefined ? { category_id: categoryId } : {}) } }).then((r) => r.data),
  getTestCase: (id: number) =>
    http.get<TestCaseData>(`/test-cases/${id}`).then((r) => r.data),
  createTestCase: (data: { name: string; script_content: string; category_id?: number }) =>
    http.post<TestCaseData>('/test-cases', data).then((r) => r.data),
  updateTestCase: (id: number, data: { name?: string; script_content?: string; category_id?: number }) =>
    http.put<TestCaseData>(`/test-cases/${id}`, data).then((r) => r.data),
  deleteTestCase: (id: number) =>
    http.delete(`/test-cases/${id}`).then((r) => r.data),
  executeTestCase: (id: number) =>
    http.post<ExecuteResultData>(`/test-cases/${id}/execute`).then((r) => r.data),
  batchExecute: (caseIds: number[], batchName: string) =>
    http.post('/test-cases/batch-execute', { case_ids: caseIds, batch_name: batchName }).then((r) => r.data),

  // 平台配置
  getConfig: (key: string) =>
    http.get<ConfigData>(`/config/${key}`).then((r) => r.data),
  setConfig: (key: string, value: string) =>
    http.put(`/config/${key}`, { value }).then((r) => r.data),
}

export default api
