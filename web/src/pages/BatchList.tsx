import { useEffect, useState } from 'react'
import { Table, Button, Space, Tag, message, Card, Tooltip, Carousel, Row, Col, Statistic } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  ReloadOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  RedoOutlined,
} from '@ant-design/icons'
import api, { BatchSummary } from '../api/client'

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
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api
      .listBatches()
      .then(setData)
      .catch(() => message.error('加载批次失败'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleRun = () => {
    setRunning(true)
    api
      .runTests()
      .then(() => {
        message.success('测试已触发，执行完成后自动刷新')
        // 记录触发前的批次数，用于判断是否有新批次产生
        api.listBatches().then((batches) => {
          const prevCount = batches.length
          let pollTimer: ReturnType<typeof setInterval>
          let elapsed = 0
          setPolling(true)
          pollTimer = setInterval(() => {
            elapsed += 3
            api
              .listBatches()
              .then((newBatches) => {
                if (newBatches.length > prevCount || elapsed >= 120) {
                  clearInterval(pollTimer)
                  setPolling(false)
                  setRunning(false)
                  setData(newBatches)
                }
              })
              .catch(() => {})
          }, 3000)
        })
      })
      .catch(() => {
        message.error('触发失败')
        setRunning(false)
      })
  }

  const handleRerun = (id: number) => {
    setRerunId(id)
    api
      .rerunBatch(id)
      .then(() => message.success('该批次已重新触发执行，完成后请刷新'))
      .catch(() => message.error('重新执行失败'))
      .finally(() => setTimeout(() => setRerunId(null), 1000))
  }

  // 统计数据
  const stats = data.reduce(
    (acc, item) => ({
      total: acc.total + (item.total_cases ?? 0),
      passed: acc.passed + (item.passed ?? 0),
      failed: acc.failed + (item.failed ?? 0),
    }),
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
      render: (v: string | null) => v || '-',
    },
    {
      title: '总数',
      dataIndex: 'total_cases',
      key: 'total_cases',
      width: 80,
      render: (v: number) => v ?? 0,
    },
    {
      title: '通过',
      dataIndex: 'passed',
      key: 'passed',
      width: 80,
      render: (v: number) => (
        <Tag color="green" className="tech-tag">
          {v ?? 0}
        </Tag>
      ),
    },
    {
      title: '失败',
      dataIndex: 'failed',
      key: 'failed',
      width: 80,
      render: (v: number) => (
        <Tag color="red" className="tech-tag">
          {v ?? 0}
        </Tag>
      ),
    },
    {
      title: '通过率',
      dataIndex: 'rate',
      key: 'rate',
      width: 100,
      render: (v: string) => <span className="rate-text">{v}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, row: BatchSummary) => (
        <Space size={8}>
          <Button
            type="link"
            className="action-btn"
            onClick={() => navigate(`/batch/${row.id}`)}
          >
            查看详情
          </Button>
          <Button
            type="link"
            className="action-btn"
            onClick={() => navigate(`/report/${row.id}`)}
          >
            查看报告
          </Button>
          <Button
            type="link"
            className="action-btn rerun-btn"
            icon={<RedoOutlined />}
            loading={rerunId === row.id}
            onClick={() => handleRerun(row.id)}
          >
            重新执行
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="batch-list-page">
      {/* ====== 轮播图区域 ====== */}
      <Carousel autoplay dots={{ className: 'carousel-dots' }} className="hero-carousel" autoplaySpeed={4000}>
        {carouselSlides.map((slide, idx) => (
          <div key={idx} className="carousel-slide" style={{ background: slide.gradient }}>
            <div className="slide-content">
              <div className="slide-left">
                <div className="slide-icon" style={{ color: slide.accent }}>
                  {slide.icon}
                </div>
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

      {/* ====== 统计卡片 ====== */}
      <Row gutter={[16, 16]} className="stats-row">
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card stat-total" bordered={false}>
            <Statistic
              title={<span className="stat-label">总批次数</span>}
              value={data.length}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#00e5ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card stat-passed" bordered={false}>
            <Statistic
              title={<span className="stat-label">总通过数</span>}
              value={stats.passed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card stat-failed" bordered={false}>
            <Statistic
              title={<span className="stat-label">总失败数</span>}
              value={stats.failed}
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card stat-rate" bordered={false}>
            <Statistic
              title={<span className="stat-label">整体通过率</span>}
              value={overallRate}
              suffix="%"
              precision={1}
              valueStyle={{ color: '#7c3aed' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ====== 数据表格 ====== */}
      <Card
        className="batch-table-card"
        title={
          <span className="card-title-text">
            <RocketOutlined /> 测试批次列表
          </span>
        }
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={running || polling}
              onClick={handleRun}
              className="run-all-btn"
            >
              {polling ? '执行中...' : '一键执行全部用例'}
            </Button>
            <Tooltip title="刷新列表">
              <Button
                icon={<ReloadOutlined />}
                onClick={load}
                loading={loading}
                className="refresh-btn"
              >
                刷新
              </Button>
            </Tooltip>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, size) => {
              setCurrent(page)
              setPageSize(size)
            },
          }}
          className="tech-table"
        />
      </Card>
    </div>
  )
}
