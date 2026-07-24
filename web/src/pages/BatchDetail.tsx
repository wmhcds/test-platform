import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Descriptions, Table, Tag, Button, Space, message, Card, Modal, Typography } from 'antd'
import api, { CaseRun, BatchDetailData } from '../api/client'

const { Text, Paragraph } = Typography

export default function BatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<BatchDetailData | null>(null)
  const [loading, setLoading] = useState(false)

  // 用例详情弹窗
  const [caseModal, setCaseModal] = useState<{
    visible: boolean
    caseData: CaseRun | null
    source: string
    sourceLoading: boolean
  }>({ visible: false, caseData: null, source: '', sourceLoading: false })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .getBatch(Number(id))
      .then(setData)
      .catch(() => message.error('加载详情失败'))
      .finally(() => setLoading(false))
  }, [id])

  /** 点击用例名称 → 加载源码并打开弹窗 */
  async function handleCaseClick(record: CaseRun) {
    setCaseModal({ visible: true, caseData: record, source: '', sourceLoading: true })
    try {
      const src = await api.getCaseSource(record.case_path, record.case_name)
      setCaseModal((prev) => ({ ...prev, source: src.source, sourceLoading: false }))
    } catch {
      setCaseModal((prev) => ({
        ...prev,
        source: '// 源码加载失败',
        sourceLoading: false,
      }))
    }
  }

  function closeModal() {
    setCaseModal({ visible: false, caseData: null, source: '', sourceLoading: false })
  }

  if (loading) return <Card loading={loading} />

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataAny = data as any

  if (!dataAny) return <Card>批次不存在</Card>

  const columns = [
    {
      title: '用例名称',
      dataIndex: 'case_name',
      key: 'case_name',
      render: (v: string, record: CaseRun) => (
        <a onClick={() => handleCaseClick(record)} style={{ cursor: 'pointer' }}>
          {v}
        </a>
      ),
    },
    { title: '用例路径', dataIndex: 'case_path', key: 'case_path', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => (
        <Tag color={v === 'passed' ? 'green' : v === 'failed' ? 'red' : 'orange'}>
          {v === 'passed' ? '✅ 通过' : v === 'failed' ? '❌ 失败' : v}
        </Tag>
      ),
    },
    {
      title: '耗时(ms)',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (v: number | null) => (v != null ? `${v}ms` : '-'),
    },
  ]

  const cardBodyStyle = {
    background: '#1e293b',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 12,
  }

  return (
    <Card
      title={`批次 #${dataAny.id} (${dataAny.batch_name})`}
      headStyle={{ background: '#1e293b', color: '#f1f5f9', borderBottom: '1px solid rgba(148,163,184,0.15)' }}
      bodyStyle={{ background: '#1e293b' }}
      style={cardBodyStyle}
    >
      <Descriptions
        bordered
        column={2}
        style={{ marginBottom: 16 }}
        labelStyle={{ background: '#0f172a', color: '#94a3b8' }}
        contentStyle={{ background: '#1e293b', color: '#f1f5f9' }}
      >
        <Descriptions.Item label="开始时间">
          {dataAny.start_time || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {dataAny.end_time || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="总数">{dataAny.total_cases}</Descriptions.Item>
        <Descriptions.Item label="通过率">
          <b>{dataAny.rate}</b>
        </Descriptions.Item>
      </Descriptions>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          className="btn-float-primary"
          onClick={() => navigate(`/report/${dataAny.id}`)}
        >
          查看测试报告
        </Button>
        <Button className="btn-float-default" onClick={() => navigate('/')}>
          返回列表
        </Button>
      </Space>

      <Table
        className="tech-table"
        rowKey="id"
        columns={columns}
        dataSource={dataAny.cases}
        pagination={false}
      />

      {/* 用例详情弹窗 */}
      <Modal
        title={
          <span>
            {caseModal.caseData?.case_name}
            {caseModal.caseData?.status && (
              <Tag
                color={caseModal.caseData.status === 'passed' ? 'green' : 'red'}
                style={{ marginLeft: 8 }}
              >
                {caseModal.caseData.status === 'passed' ? '通过' : '失败'}
              </Tag>
            )}
          </span>
        }
        open={caseModal.visible}
        onCancel={closeModal}
        footer={<Button onClick={closeModal}>关闭</Button>}
        width={720}
        destroyOnHidden
      >
        {/* 报错信息（仅失败用例显示） */}
        {caseModal.caseData?.error_message && (
          <div style={{ marginBottom: 16 }}>
            <Text strong type="danger" style={{ display: 'block', marginBottom: 4 }}>
              ❌ 错误信息
            </Text>
            <Paragraph
              type="danger"
              style={{
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: 6,
                padding: '8px 12px',
                whiteSpace: 'pre-wrap',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: 13,
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {caseModal.caseData.error_message}
            </Paragraph>
          </div>
        )}

        {/* 源码 */}
        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          📄 源代码
        </Text>
        <pre
          style={{
            background: '#f6f8fa',
            border: '1px solid #d0d7de',
            borderRadius: 6,
            padding: '12px',
            overflow: 'auto',
            maxHeight: 400,
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          }}
        >
          {caseModal.sourceLoading ? '加载中...' : caseModal.source || '(无源码)'}
        </pre>

        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          文件路径：{caseModal.caseData?.case_path}
        </Text>
      </Modal>
    </Card>
  )
}
