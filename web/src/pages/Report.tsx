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
    <Card title={`测试报告 - 批次 #${data.id}`}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Statistic title="总数" value={data.total} />
        </Col>
        <Col span={6}>
          <Statistic title="✅ 通过" value={data.passed} valueStyle={{ color: '#3f8600' }} />
        </Col>
        <Col span={6}>
          <Statistic title="❌ 失败" value={data.failed} valueStyle={{ color: '#cf1322' }} />
        </Col>
        <Col span={6}>
          <Statistic title="通过率" value={data.rate} />
        </Col>
      </Row>

      <Card type="inner" title="失败用例" style={{ marginBottom: 16 }}>
        {data.failed_cases.length === 0 ? (
          <span style={{ color: '#3f8600' }}>无失败用例 🎉</span>
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
