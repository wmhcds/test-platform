import { useEffect, useState, lazy, Suspense, useCallback } from 'react'
import {
  Card, Table, Button, Input, Modal, Space, message, Tag, Drawer,
  Typography, Popconfirm, Tooltip, Spin, Select,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  PlayCircleOutlined, SearchOutlined, ThunderboltOutlined,
  FolderAddOutlined, FolderOutlined, AppstoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api, { TestCaseData, TestCaseCategoryData, ExecuteResultData } from '../api/client'
import { registerPythonCompletions } from '../utils/pythonCompletions'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

const { Text, Paragraph } = Typography

export default function TestCaseManager() {
  const [data, setData] = useState<TestCaseData[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // 目录
  const [categories, setCategories] = useState<TestCaseCategoryData[]>([])
  const [activeCategory, setActiveCategory] = useState<number | undefined>(undefined)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<TestCaseCategoryData | null>(null)
  const [catName, setCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  // 编辑弹窗
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<number | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  // 执行结果抽屉
  const [resultOpen, setResultOpen] = useState(false)
  const [execResult, setExecResult] = useState<ExecuteResultData | null>(null)
  const [executing, setExecuting] = useState(false)

  // 选中行
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [batchExecuting, setBatchExecuting] = useState(false)

  const loadCategories = () => {
    api.listCategories().then(setCategories).catch(() => {})
  }

  const fetchData = () => {
    setLoading(true)
    api.listTestCases(search || undefined, activeCategory)
      .then(setData)
      .catch(() => message.error('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadCategories() }, [])
  useEffect(() => { fetchData() }, [search, activeCategory])

  // ---------- 目录操作 ----------
  const openCatCreate = () => {
    setEditingCat(null)
    setCatName('')
    setCatModalOpen(true)
  }

  const openCatEdit = (cat: TestCaseCategoryData) => {
    setEditingCat(cat)
    setCatName(cat.name)
    setCatModalOpen(true)
  }

  const handleCatSave = async () => {
    if (!catName.trim()) { message.warning('请输入目录名称'); return }
    setCatSaving(true)
    try {
      if (editingCat) {
        await api.updateCategory(editingCat.id, catName.trim())
        message.success('修改成功')
      } else {
        await api.createCategory(catName.trim())
        message.success('创建成功')
      }
      setCatModalOpen(false)
      loadCategories()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    } finally { setCatSaving(false) }
  }

  const handleCatDelete = async (cat: TestCaseCategoryData) => {
    try {
      await api.deleteCategory(cat.id)
      message.success('删除成功')
      if (activeCategory === cat.id) setActiveCategory(undefined)
      loadCategories()
    } catch { message.error('删除失败') }
  }

  // ---------- 用例操作 ----------
  const openCreate = () => {
    setEditingId(null)
    setEditName('')
    setEditContent('')
    setEditCategoryId(activeCategory)
    setModalOpen(true)
  }

  const openEdit = (row: TestCaseData) => {
    setEditingId(row.id)
    setEditName(row.name)
    setEditContent(row.script_content)
    setEditCategoryId(row.category_id ?? undefined)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!editName.trim()) { message.warning('请输入用例名称'); return }
    if (!editContent.trim()) { message.warning('请输入脚本内容'); return }
    setSaving(true)
    try {
      if (editingId) {
        await api.updateTestCase(editingId, { name: editName.trim(), script_content: editContent, category_id: editCategoryId })
        message.success('修改成功')
      } else {
        await api.createTestCase({ name: editName.trim(), script_content: editContent, category_id: editCategoryId })
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchData()
      loadCategories()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.deleteTestCase(id)
      message.success('删除成功')
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      fetchData()
      loadCategories()
    } catch { message.error('删除失败') }
  }

  const handleExecute = async (row: TestCaseData) => {
    setExecuting(true)
    setResultOpen(true)
    setExecResult(null)
    try {
      const result = await api.executeTestCase(row.id)
      setExecResult(result)
    } catch {
      message.error('执行失败')
      setResultOpen(false)
    } finally { setExecuting(false) }
  }

  const handleBatchExecute = async () => {
    if (selectedIds.length === 0) { message.warning('请至少选择一个测试用例'); return }
    setBatchExecuting(true)
    try {
      const result = await api.batchExecute(selectedIds, '')
      message.success(`批次 "${result.batch_name}" 执行完成：${result.passed} 通过, ${result.failed} 失败`)
      setSelectedIds([])
      fetchData()
    } catch { message.error('批量执行失败') }
    finally { setBatchExecuting(false) }
  }

  // Monaco 加载前注册 Python 补全提供者
  const handleMonacoBeforeMount = useCallback((monaco: any) => {
    registerPythonCompletions(monaco)
  }, [])

  const columns: ColumnsType<TestCaseData> = [
    {
      title: '用例名称', dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, row) => (
        <Space>
          <Text style={{ color: '#f1f5f9', fontWeight: 500 }}>{name}</Text>
          {row.category_name && <Tag color="blue" style={{ fontSize: 11 }}>{row.category_name}</Tag>}
        </Space>
      ),
    },
    { title: '脚本长度', dataIndex: 'script_content', width: 100,
      render: (c: string) => <Text style={{ color: '#f1f5f9' }}>{c.length} 字符</Text> },
    { title: '更新时间', dataIndex: 'updated_at', width: 180,
      sorter: (a, b) => a.updated_at.localeCompare(b.updated_at),
      render: (t: string) => <Text style={{ color: '#f1f5f9' }}>{t?.replace('T', ' ').substring(0, 19)}</Text> },
    {
      title: '操作', key: 'action', width: 260,
      render: (_, row) => (
        <Space size="small">
          <Tooltip title="编辑"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} style={{ color: '#818cf8' }} /></Tooltip>
          <Tooltip title="调试执行"><Button type="text" size="small" icon={<PlayCircleOutlined />} loading={executing} onClick={() => handleExecute(row)} style={{ color: '#22c55e' }} /></Tooltip>
          <Popconfirm title="确认删除" description={`确定删除 "${row.name}" 吗？`} onConfirm={() => handleDelete(row.id)} okText="删除" cancelText="取消">
            <Tooltip title="删除"><Button type="text" size="small" icon={<DeleteOutlined />} danger /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const cardBodyStyle = { background: '#1e293b' }

  return (
    <div style={{ display: 'flex', gap: 16, maxWidth: 1300, margin: '0 auto' }}>
      {/* ======= 左侧目录栏 ======= */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <Card
          bodyStyle={{ ...cardBodyStyle, padding: 12 }}
          style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 12 }}
          title={<span style={{ color: '#f1f5f9', fontSize: 14 }}><AppstoreOutlined /> 目录</span>}
          extra={
            <Tooltip title="新建目录">
              <Button type="text" size="small" icon={<FolderAddOutlined />} onClick={openCatCreate} style={{ color: '#818cf8' }} />
            </Tooltip>
          }
        >
          <div
            onClick={() => setActiveCategory(undefined)}
            style={{
              padding: '8px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
              background: activeCategory === undefined ? 'rgba(129,140,248,0.15)' : 'transparent',
              color: activeCategory === undefined ? '#818cf8' : '#e2e8f0',
              fontWeight: activeCategory === undefined ? 600 : 400,
            }}
          >
            <FolderOutlined style={{ marginRight: 8 }} />全部
          </div>
          {categories.map((cat) => (
            <div key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '8px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: activeCategory === cat.id ? 'rgba(129,140,248,0.15)' : 'transparent',
                color: activeCategory === cat.id ? '#818cf8' : '#e2e8f0',
              }}
            >
              <span style={{ fontWeight: activeCategory === cat.id ? 600 : 400 }}>
                <FolderOutlined style={{ marginRight: 8 }} />{cat.name}
                <span style={{ marginLeft: 6, fontSize: 12, color: '#cbd5e1' }}>({cat.case_count})</span>
              </span>
              <span>
                <Button type="text" size="small"
                  onClick={(e) => { e.stopPropagation(); openCatEdit(cat) }}
                  style={{ color: '#cbd5e1', fontSize: 12 }}>✎</Button>
                <Popconfirm title={`删除目录"${cat.name}"？用例将移至未分类`} onConfirm={(e) => { e?.stopPropagation(); handleCatDelete(cat) }} onCancel={(e) => e?.stopPropagation()}>
                  <Button type="text" size="small" danger
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 12 }}>✕</Button>
                </Popconfirm>
              </span>
            </div>
          ))}
        </Card>
      </div>

      {/* ======= 右侧主区域 ======= */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>00004#</span>
            <Input
              className="tc-page-input"
              placeholder="搜索用例名称..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 280 }}
            />
          </span>
          <Space>
            <Button icon={<ThunderboltOutlined />} onClick={handleBatchExecute} loading={batchExecuting}
              disabled={selectedIds.length === 0} className="btn-float-primary">
              批量执行 ({selectedIds.length})
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} className="btn-float-primary">
              新建用例
            </Button>
          </Space>
        </div>

        <Card bodyStyle={cardBodyStyle} style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 12 }}>
          <Table
            className="tech-table" rowKey="id" columns={columns} dataSource={data} loading={loading}
            rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{ emptyText: '暂无测试用例，点击右上角"新建用例"创建' }}
          />
        </Card>
      </div>

      {/* 目录弹窗 */}
      <Modal
        title={editingCat ? '编辑目录' : '新建目录'}
        open={catModalOpen}
        onCancel={() => setCatModalOpen(false)}
        onOk={handleCatSave}
        confirmLoading={catSaving}
        okText="保存" cancelText="取消"
        styles={{ content: { background: '#1e293b' }, header: { background: '#1e293b' } }}
      >
        <Text style={{ color: '#e2e8f0', display: 'block', marginBottom: 6 }}>目录名称</Text>
        <Input placeholder="输入目录名称" value={catName} onChange={(e) => setCatName(e.target.value)} />
      </Modal>

      {/* 用例新建/编辑弹窗 */}
      <Modal
        title={editingId ? '编辑测试用例' : '新建测试用例'}
        open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave}
        confirmLoading={saving} okText="保存" cancelText="取消" width={800} destroyOnClose
        styles={{ content: { background: '#1e293b' }, header: { background: '#1e293b' } }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: '#e2e8f0', display: 'block', marginBottom: 6 }}>用例名称</Text>
          <Input placeholder="输入用例名称（不可与已有名称重复）" value={editName}
            onChange={(e) => setEditName(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: '#e2e8f0', display: 'block', marginBottom: 6 }}>所属目录</Text>
          <Select
            placeholder="选择目录（可选）" allowClear style={{ width: '100%' }}
            value={editCategoryId}
            onChange={(val) => setEditCategoryId(val)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div>
          <Text style={{ color: '#e2e8f0', display: 'block', marginBottom: 6 }}>Python 脚本</Text>
          <div style={{ border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, overflow: 'hidden' }}>
            <Suspense fallback={
              <div style={{ height: 420, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin tip="编辑器加载中..." />
              </div>
            }>
              <MonacoEditor
                height="420px" language="python" theme="vs-dark"
                value={editContent} onChange={(val) => setEditContent(val || '')}
                beforeMount={handleMonacoBeforeMount}
                loading={
                  <div style={{ height: 420, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin tip="编辑器加载中..." />
                  </div>
                }
                options={{
                  fontSize: 14, fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
                  minimap: { enabled: false }, lineNumbers: 'on', scrollBeyondLastLine: false,
                  wordWrap: 'on', tabSize: 4, automaticLayout: true,
                  suggestOnTriggerCharacters: true, quickSuggestions: true,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            </Suspense>
          </div>
        </div>
      </Modal>

      {/* 执行结果抽屉 */}
      <Drawer
        title={
          <Space>
            <span style={{ color: '#f1f5f9' }}>执行结果 - {execResult?.case_name}</span>
            {execResult && <Tag color={execResult.status === 'passed' ? 'green' : 'red'}>{execResult.status === 'passed' ? '通过' : '失败'}</Tag>}
          </Space>
        }
        open={resultOpen} onClose={() => setResultOpen(false)} width={600} loading={executing}
      >
        {execResult && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ display: 'block', marginBottom: 4, color: '#cbd5e1' }}>耗时</Text>
              <Text style={{ color: '#f1f5f9' }}>{execResult.duration}s</Text>
            </div>
            {execResult.error_message && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 4, color: '#ef4444' }}>错误信息</Text>
                <Paragraph style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8 }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{execResult.error_message}</pre>
                </Paragraph>
              </div>
            )}
            <div>
              <Text style={{ display: 'block', marginBottom: 4, color: '#cbd5e1' }}>输出</Text>
              <pre style={{ background: '#0f172a', color: '#a5f3fc', padding: 12, borderRadius: 8, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13 }}>
                {execResult.output}
              </pre>
            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}
