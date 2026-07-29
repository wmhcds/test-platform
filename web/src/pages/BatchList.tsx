import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Space, Tag, message, Card, Tooltip, Carousel, Row, Col, Statistic, Modal, Tree, Typography } from 'antd'
import type { TreeProps } from 'antd/es/tree'
import { useNavigate } from 'react-router-dom'
import {
  ReloadOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  RedoOutlined,
  SelectOutlined,
  DeleteOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import api, { BatchSummary, TestCaseData, TestCaseCategoryData } from '../api/client'

const carouselSlides = [
  {
    title: 'AI 智能测试执行平台',
    desc: '自动化用例执行 · 实时结果分析 · 可视化报告生成',
    gradient: 'linear-gradient(135deg, #0c1929 0%, #0f2744 50%, #0a1f35 100%)',
    accent: '#00e5ff',
    icon: <RocketOutlined style={{ fontSize: 48 }} />,
  },
  {
    title: '高效批量执行',
    desc: '一键触发全部测试用例 · 多线程并行执行 · 秒级响应',
    gradient: 'linear-gradient(135deg, #0a1628 0%, #1a0f2e 50%, #0d1b2a 100%)',
    accent: '#7c3aed',
    icon: <ThunderboltOutlined style={{ fontSize: 48 }} />,
  },
  {
    title: '精准结果统计',
    desc: '通过率实时计算 · 失败原因追踪 · 历史趋势对比',
    gradient: 'linear-gradient(135deg, #0f1a14 0%, #0a2a1f 50%, #082018 100%)',
    accent: '#10b981',
    icon: <CheckCircleOutlined style={{ fontSize: 48 }} />,
  },
]

export default function BatchList() {
  const [data, setData] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [rerunId, setRerunId] = useState<number | null>(null)
  const [polling, setPolling] = useState(false)
  const [pageSize, setPageSize] = useState(10)
  const [current, setCurrent] = useState(1)
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([])
  const navigate = useNavigate()

  // 用例选择
  const [selectModalOpen, setSelectModalOpen] = useState(false)
  const [allCases, setAllCases] = useState<TestCaseData[]>([])
  const [allCategories, setAllCategories] = useState<TestCaseCategoryData[]>([])
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([])
  const [selectLoading, setSelectLoading] = useState(false)
  const [selectSaving, setSelectSaving] = useState(false)

  // AI 分析
  const [aiLoading, setAiLoading] = useState<number | null>(null)
  const [aiModal, setAiModal] = useState<{ open: boolean; data: string | null }>({ open: false, data: null })

  const handleAiAnalysis = (id: number) => {
    setAiLoading(id)
    api.getAiAnalysis(id)
      .then((res) => setAiModal({ open: true, data: res.summary }))
      .catch(() => message.error('AI 分析失败'))
      .finally(() => setAiLoading(null))
  }

  const load = () => {
    setLoading(true)
    api.listBatches().then(setData).catch(() => message.error('加载批次失败')).finally(() => setLoading(false))
  }

  // 加载已保存的用例选择配置
  const loadSelection = () => {
    api.getConfig('selected_case_ids').then((cfg) => {
      if (cfg.value) {
        try { setSelectedCaseIds(JSON.parse(cfg.value)) } catch { /* ignore */ }
      }
    }).catch(() => {})
  }

  useEffect(() => { load(); loadSelection() }, [])

  const openSelectModal = () => {
    setSelectLoading(true)
    setSelectModalOpen(true)
    Promise.all([
      api.listCategories().then((cats) => setAllCategories(cats)).catch(() => {}),
      api.listTestCases().then((cases) => setAllCases(cases)).catch(() => message.error('加载用例失败')),
    ]).finally(() => setSelectLoading(false))
  }

  const treeData = useMemo(() => {
    const categorized = allCategories.map((cat) => {
      const children = allCases
        .filter((c) => c.category_id === cat.id)
        .map((c) => ({
          title: (
            <span style={{ color: '#f1f5f9' }}>
              {c.name}
              <span style={{ marginLeft: 12, color: '#cbd5e1', fontSize: 12 }}>{c.script_content.length} 字符</span>
            </span>
          ),
          key: String(c.id),
          isLeaf: true,
        }))
      return {
        title: (
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {cat.name} <span style={{ color: '#cbd5e1', fontWeight: 400 }}>({children.length})</span>
          </span>
        ),
        key: `cat-${cat.id}`,
        children,
      }
    })

    const uncategorized = allCases
      .filter((c) => !c.category_id)
      .map((c) => ({
        title: (
          <span style={{ color: '#f1f5f9' }}>
              {c.name}
              <span style={{ marginLeft: 12, color: '#cbd5e1', fontSize: 12 }}>{c.script_content.length} 字符</span>
            </span>
          ),
          key: String(c.id),
          isLeaf: true,
        }))

    return [...categorized, ...uncategorized]
  }, [allCases, allCategories])

  const handleTreeCheck: TreeProps['onCheck'] = (checkedKeysValue) => {
    const keys = Array.isArray(checkedKeysValue) ? checkedKeysValue : checkedKeysValue.checked
    const caseIds = keys
      .filter((key) => !String(key).startsWith('cat-'))
      .map((key) => Number(key))
    setSelectedCaseIds(caseIds)
  }

  const handleSelectSave = async () => {
    setSelectSaving(true)
    try {
      await api.setConfig('selected_case_ids', JSON.stringify(selectedCaseIds))
      message.success(`已保存，选中 ${selectedCaseIds.length} 个用例`)
      setSelectModalOpen(false)
    } catch { message.error('保存失败') }
    finally { setSelectSaving(false) }
  }

  const handleRun = () => {
    // 如果有选中的用例，使用选中的用例执行；否则使用传统的 pytest 执行
    if (selectedCaseIds.length > 0) {
      setRunning(true)
      setPolling(true)
      api.batchExecute(selectedCaseIds, `自动批次_${new Date().toISOString().slice(0, 10)}`)
        .then((result) => {
          message.success(`批次 "${result.batch_name}" 执行完成：${result.passed} 通过, ${result.failed} 失败`)
          setPolling(false)
          setRunning(false)
          load()
        })
        .catch(() => {
          message.error('执行失败')
          setPolling(false)
          setRunning(false)
        })
      return
    }

    // 传统 pytest 模式（兜底）
    setRunning(true)
    api.runTests().then(() => {
      message.success('测试已触发，执行完成后自动刷新')
      api.listBatches().then((batches) => {
        const prevCount = batches.length
        let pollTimer: ReturnType<typeof setInterval>
        let elapsed = 0
        setPolling(true)
        pollTimer = setInterval(() => {
          elapsed += 3
          api.listBatches().then((newBatches) => {
            if (newBatches.length > prevCount || elapsed >= 120) {
              clearInterval(pollTimer)
              setPolling(false)
              setRunning(false)
              setData(newBatches)
            }
          }).catch(() => {})
        }, 3000)
      })
    }).catch(() => { message.error('触发失败'); setRunning(false) })
  }

  const handleRerun = (id: number) => {
    setRerunId(id)
    api.rerunBatch(id).then(() => message.success('该批次已重新触发执行，完成后请刷新'))
      .catch(() => message.error('重新执行失败'))
      .finally(() => setTimeout(() => setRerunId(null), 1000))
  }

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除批次？',
      content: '删除后该批次及其用例执行记录将无法恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.deleteBatch(id)
          message.success('批次已删除')
          load()
        } catch {
          message.error('删除批次失败')
        }
      },
    })
  }

  const handleBatchDelete = () => {
    if (selectedBatchIds.length === 0) {
      message.warning('请先勾选要删除的批次')
      return
    }
    Modal.confirm({
      title: `确认删除选中的 ${selectedBatchIds.length} 个批次？`,
      content: '删除后这些批次及其用例执行记录将无法恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.deleteBatches(selectedBatchIds)
          message.success('批量删除成功')
          setSelectedBatchIds([])
          load()
        } catch {
          message.error('批量删除失败')
        }
      },
    })
  }

  const stats = data.reduce(
    (acc, item) => ({ total: acc.total + (item.total_cases ?? 0), passed: acc.passed + (item.passed ?? 0), failed: acc.failed + (item.failed ?? 0) }),
    { total: 0, passed: 0, failed: 0 },
  )
  const overallRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0.0'

  const columns = [
    { title: '批次ID', dataIndex: 'id', key: 'id', width: 90 },
    { title: '批次名称', dataIndex: 'batch_name', key: 'batch_name' },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (v: string | null) => {
        if (!v) return '-'
        const d = new Date(v)
        if (isNaN(d.getTime())) return v
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      },
    },
    { title: '总数', dataIndex: 'total_cases', key: 'total_cases', width: 80, render: (v: number) => v ?? 0 },
    { title: '通过', dataIndex: 'passed', key: 'passed', width: 80,
      render: (v: number) => <Tag color="green" className="tech-tag">{v ?? 0}</Tag> },
    { title: '失败', dataIndex: 'failed', key: 'failed', width: 80,
      render: (v: number) => <Tag color="red" className="tech-tag">{v ?? 0}</Tag> },
    { title: '通过率', dataIndex: 'rate', key: 'rate', width: 100,
      render: (v: string) => <span className="rate-text">{v}</span> },
    {
      title: '操作', key: 'action', width: 260,
      render: (_: unknown, row: BatchSummary) => (
        <Space size={8}>
          <Button type="link" className="action-btn" onClick={() => navigate(`/ai/batch/${row.id}`)}>查看详情</Button>
          <Button type="link" className="action-btn" onClick={() => navigate(`/ai/report/${row.id}`)}>查看报告</Button>
          <Button type="link" className="action-btn rerun-btn" icon={<RedoOutlined />}
            loading={rerunId === row.id} onClick={() => handleRerun(row.id)}>重新执行</Button>
          <Button type="link" style={{ color: '#818cf8' }} icon={<RobotOutlined />}
            loading={aiLoading === row.id} onClick={() => handleAiAnalysis(row.id)}>AI分析</Button>
          <Button type="link" danger className="action-btn" icon={<DeleteOutlined />}
            onClick={() => handleDelete(row.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="batch-list-page">
      <Carousel autoplay dots={{ className: 'carousel-dots' }} className="hero-carousel" autoplaySpeed={4000}>
        {carouselSlides.map((slide, idx) => (
          <div key={idx} className="carousel-slide" style={{ background: slide.gradient }}>
            <div className="slide-content">
              <div className="slide-left">
                <div className="slide-icon" style={{ color: slide.accent }}>{slide.icon}</div>
                <h1 className="slide-title">{slide.title}</h1>
                <p className="slide-desc">{slide.desc}</p>
              </div>
              <div className="slide-right">
                <div className="deco-grid"></div>
                <div className="deco-circle c1" style={{ borderColor: `${slide.accent}30` }}></div>
                <div className="deco-circle c2" style={{ borderColor: `${slide.accent}20` }}></div>
                <div className="deco-line" style={{ background: `linear-gradient(180deg, ${slide.accent}, transparent)` }}></div>
              </div>
            </div>
          </div>
        ))}
      </Carousel>

      <Row gutter={[16, 16]} className="stats-row">
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card stat-total" bordered={false}>
            <Statistic title={<span className="stat-label">总批次数</span>} value={data.length}
              prefix={<ExperimentOutlined />} valueStyle={{ color: '#00e5ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card stat-passed" bordered={false}>
            <Statistic title={<span className="stat-label">总通过数</span>} value={stats.passed}
              prefix={<CheckCircleOutlined />} valueStyle={{ color: '#10b981' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card stat-failed" bordered={false}>
            <Statistic title={<span className="stat-label">总失败数</span>} value={stats.failed}
              valueStyle={{ color: '#ef4444' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card stat-rate" bordered={false}>
            <Statistic title={<span className="stat-label">整体通过率</span>} value={overallRate}
              suffix="%" precision={1} valueStyle={{ color: '#7c3aed' }} />
          </Card>
        </Col>
      </Row>

      <Card
        className="batch-table-card"
        title={<span className="card-title-text"><span style={{ color: '#64748b', fontSize: 12, marginRight: 6, fontFamily: 'monospace' }}>00001#</span><RocketOutlined /> 测试批次列表</span>}
        extra={
          <Space>
            <span style={{ color: '#e2e8f0', fontSize: 12 }}>
              已选 {selectedBatchIds.length} 个批次
            </span>
            <Button
              className="refresh-btn"
              onClick={() =>
                selectedBatchIds.length === data.length && data.length > 0
                  ? setSelectedBatchIds([])
                  : setSelectedBatchIds(data.map((b) => b.id))
              }
            >
              {selectedBatchIds.length === data.length && data.length > 0 ? '取消全选' : '全选'}
            </Button>
            <Button danger className="refresh-btn" icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              批量删除
            </Button>
            <Button icon={<SelectOutlined />} onClick={openSelectModal} className="refresh-btn">
              用例选择{selectedCaseIds.length > 0 ? ` (${selectedCaseIds.length})` : ''}
            </Button>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={running || polling}
              onClick={handleRun} className="run-all-btn">
              {polling ? '执行中...' : '一键执行全部用例'}
            </Button>
            <Tooltip title="刷新列表">
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading} className="refresh-btn">刷新</Button>
            </Tooltip>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          scroll={{ x: 800 }}
          rowSelection={{
            selectedRowKeys: selectedBatchIds,
            onChange: (keys) => setSelectedBatchIds(keys as number[]),
          }}
          pagination={{
            current, pageSize, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'],
            showQuickJumper: true, showTotal: (total: number) => `共 ${total} 条`,
            onChange: (page, size) => { setCurrent(page); setPageSize(size) },
          }}
          className="tech-table"
        />
      </Card>

      {/* 用例选择弹窗 */}
      <Modal
        title="选择要执行的测试用例"
        open={selectModalOpen}
        onCancel={() => setSelectModalOpen(false)}
        onOk={handleSelectSave}
        confirmLoading={selectSaving}
        okText="保存选择"
        cancelText="取消"
        width={700}
        styles={{ content: { background: '#1e293b' }, header: { background: '#1e293b' } }}
      >
        <div style={{ color: '#e2e8f0', marginBottom: 12 }}>
          勾选需要执行的测试用例，保存后点击「一键执行全部用例」将只执行已勾选的用例。
        </div>
        {selectLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#cbd5e1' }}>加载中...</div>
        ) : allCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#cbd5e1' }}>
            暂无测试用例，请先在「测试用例管理」页面创建用例
          </div>
        ) : (
          <div style={{ background: '#0f172a', borderRadius: 8, padding: 12, border: '1px solid rgba(148,163,184,0.15)' }}>
            <Space style={{ marginBottom: 12 }}>
              <Button size="small" onClick={() => setSelectedCaseIds(allCases.map((c) => c.id))}>
                全选
              </Button>
              <Button size="small" onClick={() => setSelectedCaseIds([])}>
                取消全选
              </Button>
              <span style={{ color: '#cbd5e1', fontSize: 12 }}>
                已选择 {selectedCaseIds.length} 个用例
              </span>
            </Space>
            <div style={{ maxHeight: 380, overflow: 'auto' }}>
              <Tree
                checkable
                defaultExpandAll
                treeData={treeData}
                checkedKeys={selectedCaseIds.map(String)}
                onCheck={handleTreeCheck}
                selectable={false}
                showLine={{ showLeafIcon: false }}
                className="case-select-tree"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* AI 分析弹窗 */}
      <Modal
        title={<span style={{ color: '#f1f5f9' }}><RobotOutlined style={{ marginRight: 8, color: '#818cf8' }} />AI 分析结果</span>}
        open={aiModal.open}
        onCancel={() => setAiModal({ open: false, data: null })}
        footer={<Button onClick={() => setAiModal({ open: false, data: null })}>关闭</Button>}
        width={700}
        styles={{ content: { background: '#1e293b' }, header: { background: '#1e293b' } }}
      >
        {aiModal.data ? (
          <pre style={{
            background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: 8,
            padding: 20,
            color: '#e2e8f0',
            fontSize: 14,
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            maxHeight: 500,
            overflow: 'auto',
          }}>
            {aiModal.data}
          </pre>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#cbd5e1' }}>暂无分析数据</div>
        )}
      </Modal>
    </div>
  )
}
