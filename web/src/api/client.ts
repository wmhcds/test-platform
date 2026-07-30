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
  passed_cases: { case_name: string; case_path: string; status: string }[]
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
  parent_id: number | null
  level: number
  case_count: number
  is_system: boolean
  children: TestCaseCategoryData[]
  created_at: string
}

export interface TestCaseData {
  id: number
  name: string
  script_content: string
  category_id: number | null
  category_name: string | null
  original_category_id: number | null
  original_category_name: string | null
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

export interface HttpRequestHeaderItem {
  key: string
  value: string
}

export interface HttpRequestConfigData {
  id: number
  name: string
  method: string
  url: string
  headers: HttpRequestHeaderItem[]
  body: string
  body_type: string
  description: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface DatabaseConfigData {
  id: number
  name: string
  db_type: string
  host: string
  port: number
  username: string
  password: string
  database_name: string
  notes: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface DbQueryResult {
  columns: string[]
  rows: (string | number | null)[][]
  row_count: number
  affected_rows: number | null
  message: string
  elapsed_ms: number
}

export interface UserData {
  id: number
  username: string
  role: string
  disabled: boolean
  created_at: string
}

export interface InviteCodeData {
  id: number
  code: string
  is_used: boolean
  used_by: number | null
  created_at: string
}

export interface AiAnalysisData {
  batch_id: number
  batch_name: string
  total: number
  passed: number
  failed: number
  rate: string
  summary: string
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
  deleteBatch: (id: number) =>
    http.delete(`/batches/${id}`).then((r) => r.data),
  deleteBatches: (ids: number[]) =>
    http.post('/batches/batch-delete', { ids }).then((r) => r.data),
  runTests: () => http.post('/run-tests').then((r) => r.data),
  rerunBatch: (id: number) =>
    http.post(`/batches/${id}/rerun`).then((r) => r.data),
  getAiAnalysis: (id: number) =>
    http.get<AiAnalysisData>(`/batches/${id}/ai-analysis`).then((r) => r.data),
  sendHttp: (formData: FormData) =>
    http.post('/http/send', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  // 目录管理
  listCategories: () =>
    http.get<TestCaseCategoryData[]>('/test-cases/categories').then((r) => r.data),
  createCategory: (name: string, parentId?: number) =>
    http.post<TestCaseCategoryData>('/test-cases/categories', { name, parent_id: parentId || null }).then((r) => r.data),
  updateCategory: (id: number, name: string) =>
    http.put<TestCaseCategoryData>(`/test-cases/categories/${id}`, { name }).then((r) => r.data),
  deleteCategory: (id: number) =>
    http.delete(`/test-cases/categories/${id}`).then((r) => r.data),
  restoreCategory: (id: number) =>
    http.post(`/test-cases/categories/${id}/restore`).then((r) => r.data),
  permanentDeleteCategory: (id: number) =>
    http.delete(`/test-cases/categories/${id}/permanent`).then((r) => r.data),
  listDeletedCategories: () =>
    http.get<TestCaseCategoryData[]>('/test-cases/categories/deleted').then((r) => r.data),

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
  batchDeleteTestCases: (ids: number[]) =>
    http.post('/test-cases/batch-delete', { ids }).then((r) => r.data),
  restoreTestCase: (id: number) =>
    http.post(`/test-cases/${id}/restore`).then((r) => r.data),
  permanentDeleteTestCase: (id: number) =>
    http.delete(`/test-cases/${id}/permanent`).then((r) => r.data),
  batchRestoreTestCases: (ids: number[]) =>
    http.post('/test-cases/batch-restore', { ids }).then((r) => r.data),
  batchPermanentDeleteTestCases: (ids: number[]) =>
    http.post('/test-cases/batch-permanent-delete', { ids }).then((r) => r.data),
  batchMigrateTestCases: (ids: number[], targetCategoryId: number) =>
    http.post('/test-cases/batch-migrate', { ids, target_category_id: targetCategoryId }).then((r) => r.data),
  executeTestCase: (id: number) =>
    http.post<ExecuteResultData>(`/test-cases/${id}/execute`).then((r) => r.data),
  batchExecute: (caseIds: number[], batchName: string) =>
    http.post('/test-cases/batch-execute', { case_ids: caseIds, batch_name: batchName }).then((r) => r.data),

  // 平台配置
  getConfig: (key: string) =>
    http.get<ConfigData>(`/config/${key}`).then((r) => r.data),
  setConfig: (key: string, value: string) =>
    http.put(`/config/${key}`, { value }).then((r) => r.data),

  // HTTP 请求报文配置
  listHttpRequestConfigs: () =>
    http.get<HttpRequestConfigData[]>('/http-request-configs').then((r) => r.data),
  getHttpRequestConfig: (id: number) =>
    http.get<HttpRequestConfigData>(`/http-request-configs/${id}`).then((r) => r.data),
  createHttpRequestConfig: (data: Omit<HttpRequestConfigData, 'id' | 'created_at' | 'updated_at' | 'created_by'>) =>
    http.post<HttpRequestConfigData>('/http-request-configs', data).then((r) => r.data),
  updateHttpRequestConfig: (id: number, data: Partial<Omit<HttpRequestConfigData, 'id' | 'created_at' | 'updated_at' | 'created_by'>>) =>
    http.put<HttpRequestConfigData>(`/http-request-configs/${id}`, data).then((r) => r.data),
  deleteHttpRequestConfig: (id: number) =>
    http.delete(`/http-request-configs/${id}`).then((r) => r.data),

  // 数据库配置
  listDatabaseConfigs: () =>
    http.get<DatabaseConfigData[]>('/database-configs').then((r) => r.data),
  getDatabaseConfig: (id: number) =>
    http.get<DatabaseConfigData>(`/database-configs/${id}`).then((r) => r.data),
  createDatabaseConfig: (data: Omit<DatabaseConfigData, 'id' | 'created_at' | 'updated_at' | 'created_by'>) =>
    http.post<DatabaseConfigData>('/database-configs', data).then((r) => r.data),
  updateDatabaseConfig: (id: number, data: Partial<Omit<DatabaseConfigData, 'id' | 'created_at' | 'updated_at' | 'created_by'>>) =>
    http.put<DatabaseConfigData>(`/database-configs/${id}`, data).then((r) => r.data),
  deleteDatabaseConfig: (id: number) =>
    http.delete(`/database-configs/${id}`).then((r) => r.data),

  // 数据库查询
  executeDbQuery: (dbConfigId: number, sql: string) =>
    http.post<DbQueryResult>('/db-query/execute', { db_config_id: dbConfigId, sql }).then((r) => r.data),

  // 用户管理
  listUsers: () =>
    http.get<UserData[]>('/users').then((r) => r.data),
  createUser: (data: { username: string; password: string; role: string }) =>
    http.post<UserData>('/users', data).then((r) => r.data),
  deleteUser: (id: number) =>
    http.delete(`/users/${id}`).then((r) => r.data),
  updateUserRole: (id: number, role: string) =>
    http.put<UserData>(`/users/${id}/role`, { role }).then((r) => r.data),
  updateUserPassword: (id: number, password: string) =>
    http.put<UserData>(`/users/${id}/password`, { password }).then((r) => r.data),
  toggleUserDisabled: (id: number, disabled: boolean) =>
    http.put<UserData>(`/users/${id}/disabled`, { disabled }).then((r) => r.data),

  // 邀请码管理（仅管理员）
  listInviteCodes: () =>
    http.get<InviteCodeData[]>('/invite-codes').then((r) => r.data),
  generateInviteCodes: (count: number) =>
    http.post<InviteCodeData[]>('/invite-codes', { count }).then((r) => r.data),
  deleteInviteCode: (id: number) =>
    http.delete(`/invite-codes/${id}`).then((r) => r.data),
}

export default api
