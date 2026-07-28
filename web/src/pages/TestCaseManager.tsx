import { useEffect, useState, lazy, Suspense } from 'react'
import {
  Card, Table, Button, Input, Modal, Space, message, Tag, Drawer,
  Typography, Popconfirm, Tooltip, Spin,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  PlayCircleOutlined, SearchOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api, { TestCaseData, ExecuteResultData } from '../api/client'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

const { Text, Paragraph } = Typography

export default function TestCaseManager() {
  const [data, setData] = useState<TestCaseData[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // 编辑弹窗
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  // 执行结果抽屉
  const [resultOpen, setResultOpen] = useState(false)
  const [execResult, setExecResult] = useState<ExecuteResultData | null>(null)
  const [executing, setExecuting] = useState(false)

  // 选中行
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // 批量执行
  const [batchExecuting, setBatchExecuting] = useState(false)

  const fetchData = () => {
    setLoading(true)
    api.listTestCases(search || undefined)
      .then(setData)
      .catch(() => message.error('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [search])

  // 新增
  const openCreate = () => {
    setEditingId(null)
    setEditName('')
    setEditContent('')
    setModalOpen(true)
  }

  // 编辑
  const openEdit = (row: TestCaseData) => {
    setEditingId(row.id)
    setEditName(row.name)
    setEditContent(row.script_content)
    setModalOpen(true)
  }

  // 保存
  const handleSave = async () => {
    if (!editName.trim()) {
      message.warning('请输入用例名称')
      return
    }
    if (!editContent.trim()) {
      message.warning('请输入脚本内容')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await api.updateTestCase(editingId, { name: editName.trim(), script_content: editContent })
        message.success('修改成功')
      } else {
        await api.createTestCase({ name: editName.trim(), script_content: editContent })
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchData()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除
  const handleDelete = async (id: number) => {
    try {
      await api.deleteTestCase(id)
      message.success('删除成功')
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      fetchData()
    } catch {
      message.error('删除失败')
    }
  }

  // 单条执行
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
    } finally {
      setExecuting(false)
    }
  }

  // 批量执行
  const handleBatchExecute = async () => {
    if (selectedIds.length === 0) {
      message.warning('请至少选择一个测试用例')
      return
    }
    setBatchExecuting(true)
    try {
      const result = await api.batchExecute(selectedIds, '')
      message.success(`批次 "${result.batch_name}" 执行完成：${result.passed} 通过, ${result.failed} 失败`)
      setSelectedIds([])
      fetchData()
      // 刷新批次列表（通过跳转到首页让用户看到新批次）
    } catch {
      message.error('批量执行失败')
    } finally {
      setBatchExecuting(false)
    }
  }

  const columns: ColumnsType<TestCaseData> = [
    {
      title: '用例名称',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string) => (
        <Text style={{ color: '#f1f5f9', fontWeight: 500 }}>{name}</Text>
      ),
    },
    {
      title: '脚本长度',
      dataIndex: 'script_content',
      width: 100,
      render: (c: string) => <Text type="secondary">{c.length} 字符</Text>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
      sorter: (a, b) => a.updated_at.localeCompare(b.updated_at),
      render: (t: string) => <Text type="secondary">{t?.replace('T', ' ').substring(0, 19)}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_, row) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(row)}
              style={{ color: '#818cf8' }}
            />
          </Tooltip>
          <Tooltip title="调试执行">
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={executing}
              onClick={() => handleExecute(row)}
              style={{ color: '#22c55e' }}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定删除 "${row.name}" 吗？`}
            onConfirm={() => handleDelete(row.id)}
            okText="删除"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const cardBodyStyle = { background: '#1e293b' }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Input
          className="tc-page-input"
          placeholder="搜索用例名称..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <Space>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleBatchExecute}
            loading={batchExecuting}
            disabled={selectedIds.length === 0}
            className="btn-float-primary"
          >
            批量执行 ({selectedIds.length})
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            className="btn-float-primary"
          >
            新建用例
          </Button>
        </Space>
      </div>

      {/* 表格 */}
      <Card bodyStyle={cardBodyStyle} style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 12 }}>
        <Table
          className="tech-table"
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as number[]),
          }}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          locale={{ emptyText: '暂无测试用例，点击右上角"新建用例"创建' }}
        />
      </Card>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingId ? '编辑测试用例' : '新建测试用例'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={800}
        destroyOnClose
        styles={{
          content: { background: '#1e293b' },
          header: { background: '#1e293b' },
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>用例名称</Text>
          <Input
            placeholder="输入用例名称（不可与已有名称重复）"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <Text style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Python 脚本</Text>
          <div style={{ border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, overflow: 'hidden' }}>
            <Suspense fallback={
              <div style={{ height: 420, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin tip="编辑器加载中..." />
              </div>
            }>
              <MonacoEditor
                height="420px"
                language="python"
                theme="vs-dark"
                value={editContent}
                onChange={(val) => setEditContent(val || '')}
                loading={
                  <div style={{ height: 420, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin tip="编辑器加载中..." />
                  </div>
                }
                options={{
                  fontSize: 14,
                  fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 4,
                  automaticLayout: true,
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
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
            <span style={{ color: '#f1f5f9' }}>
              执行结果 - {execResult?.case_name}
            </span>
            {execResult && (
              <Tag color={execResult.status === 'passed' ? 'green' : 'red'}>
                {execResult.status === 'passed' ? '通过' : '失败'}
              </Tag>
            )}
          </Space>
        }
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        width={600}
        loading={executing}
      >
        {execResult && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>耗时</Text>
              <Text style={{ color: '#f1f5f9' }}>{execResult.duration}s</Text>
            </div>
            {execResult.error_message && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4, color: '#ef4444' }}>错误信息</Text>
                <Paragraph
                  style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8 }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {execResult.error_message}
                  </pre>
                </Paragraph>
              </div>
            )}
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>输出</Text>
              <pre style={{
                background: '#0f172a',
                color: '#a5f3fc',
                padding: 12,
                borderRadius: 8,
                maxHeight: 400,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                fontSize: 13,
              }}>
                {execResult.output}
              </pre>
            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}
