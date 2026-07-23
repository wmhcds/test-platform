import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Statistic, Row, Col, List, Tag, Button, message } from 'antd'
import api, { ReportData } from '../api/client'

export default function Report() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .getReport(Number(id))
      .then(setData)
      .catch(() => message.error('加载报告失败'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Card loading={loading} />
  if (!data) return <Card>批次不存在</Card>

  return (
    <Card
      title={`测试报告 - 批次 #${data.id}`}
      headStyle={{ background: '#1e293b', color: '#f1f5f9', borderBottom: '1px solid rgba(148,163,184,0.15)' }}
      bodyStyle={{ background: '#1e293b' }}
      style={{
        background: '#1e293b',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 12,
      }}
    >
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Statistic title="总数" value={data.total} valueStyle={{ color: '#f1f5f9' }} />
        </Col>
        <Col span={6}>
          <Statistic title="✅ 通过" value={data.passed} valueStyle={{ color: '#22c55e' }} />
        </Col>
        <Col span={6}>
          <Statistic title="❌ 失败" value={data.failed} valueStyle={{ color: '#ef4444' }} />
        </Col>
        <Col span={6}>
          <Statistic title="通过率" value={data.rate} valueStyle={{ color: '#f1f5f9' }} />
        </Col>
      </Row>

      <Card
        type="inner"
        title="失败用例"
        headStyle={{ background: '#0f172a', color: '#f1f5f9', borderBottom: '1px solid rgba(148,163,184,0.15)' }}
        bodyStyle={{ background: '#1e293b' }}
        style={{
          marginBottom: 16,
          background: '#1e293b',
          border: '1px solid rgba(148,163,184,0.15)',
        }}
      >
        {data.failed_cases.length === 0 ? (
          <span style={{ color: '#22c55e' }}>无失败用例 🎉</span>
        ) : (
          <List
            size="small"
            dataSource={data.failed_cases}
            renderItem={(item) => (
              <List.Item>
                <Tag color="red">❌ {item.status}</Tag>
                <span style={{ marginRight: 8 }}>{item.case_name}</span>
                <span style={{ color: '#999' }}>{item.case_path}</span>
              </List.Item>
            )}
          />
        )}
      </Card>

      <Button onClick={() => navigate(`/batch/${data.id}`)}>返回详情</Button>
    </Card>
  )
}
