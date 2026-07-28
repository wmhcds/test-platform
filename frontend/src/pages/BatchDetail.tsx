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
    } catch (e: any) {
      console.error('加载用例源码失败:', e?.response?.data?.detail || e?.message || e)
      setCaseModal((prev) => ({
        ...prev,
        source: `// 源码加载失败: ${e?.response?.data?.detail || e?.message || '未知错误'}`,
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

  const tableData = (dataAny.folders || []).map((folder: any, fi: number) => ({
    ...folder,
    key: `folder-${fi}`,
    isFolder: true,
    children: folder.cases.map((c: any, ci: number) => ({
      ...c,
      key: `case-${fi}-${ci}`,
      isFolder: false,
    })),
  }))

  const columns = [
    {
      title: '用例名称 / 文件夹',
      dataIndex: 'folder',
      key: 'name',
      render: (_: any, record: any) => {
        if (record.isFolder) {
          return (
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              📁 {record.folder}
            </span>
          )
        }
        return (
          <a onClick={() => handleCaseClick(record)} style={{ cursor: 'pointer', paddingLeft: 8 }}>
            {record.case_name}
          </a>
        )
      },
    },
    {
      title: '用例数 / 路径',
      dataIndex: 'case_count',
      key: 'info',
      width: 200,
      render: (_: any, record: any) => {
        if (record.isFolder) {
          return <span style={{ color: '#666' }}>共 {record.case_count} 个用例</span>
        }
        return <span style={{ fontSize: 12 }}>{record.case_path}</span>
      },
    },
    {
      title: '通过 / 失败 / 状态',
      dataIndex: 'passed_count',
      key: 'pass_fail',
      width: 130,
      render: (_: any, record: any) => {
        if (record.isFolder) {
          return (
            <span>
              <span style={{ color: '#52c41a', marginRight: 12 }}>✅ {record.passed_count}</span>
              <span style={{ color: '#ff4d4f' }}>❌ {record.failed_count}</span>
            </span>
          )
        }
        return (
          <Tag color={record.status === 'passed' ? 'green' : record.status === 'failed' ? 'red' : 'orange'}>
            {record.status === 'passed' ? '✅ 通过' : record.status === 'failed' ? '❌ 失败' : record.status}
          </Tag>
        )
      },
    },
    {
      title: '通过率 / 耗时',
      dataIndex: 'rate',
      key: 'rate_duration',
      width: 130,
      render: (_: any, record: any) => {
        if (record.isFolder) {
          const rateNum = parseFloat(record.rate)
          const color = rateNum >= 90 ? '#52c41a' : rateNum >= 60 ? '#faad14' : '#ff4d4f'
          return <span style={{ color, fontWeight: 600 }}>{record.rate}</span>
        }
        return record.duration != null ? `${record.duration}ms` : '-'
      },
    },
  ]

  return (
    <Card title={`批次 #${dataAny.id} (${dataAny.batch_name})`}>
      <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
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
        <Button type="primary" onClick={() => navigate(`/report/${dataAny.id}`)}>
          查看测试报告
        </Button>
        <Button onClick={() => navigate('/')}>返回列表</Button>
      </Space>

      <Table
        rowKey="key"
        columns={columns}
        dataSource={tableData}
        pagination={false}
        expandable={{
          defaultExpandAllRows: true,
          rowExpandable: (record: any) => record.isFolder,
        }}
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
            <Text strong style={{ display: 'block', marginBottom: 4, color: '#ef4444' }}>
              ❌ 错误信息
            </Text>
            <Paragraph
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 6,
                padding: '8px 12px',
                whiteSpace: 'pre-wrap',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: 13,
                maxHeight: 200,
                overflow: 'auto',
                color: '#f87171',
              }}
            >
              {caseModal.caseData.error_message}
            </Paragraph>
          </div>
        )}

        {/* 源码 */}
        <Text strong style={{ display: 'block', marginBottom: 4, color: '#f1f5f9' }}>
          📄 源代码
        </Text>
        <pre
          style={{
            background: '#0f172a',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            borderRadius: 6,
            padding: '12px',
            overflow: 'auto',
            maxHeight: 400,
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            color: '#e2e8f0',
          }}
        >
          {caseModal.sourceLoading ? '加载中...' : caseModal.source || '(无源码)'}
        </pre>

        <Text style={{ fontSize: 12, marginTop: 8, display: 'block', color: '#cbd5e1' }}>
          文件路径：{caseModal.caseData?.case_path}
        </Text>
      </Modal>
    </Card>
  )
}
