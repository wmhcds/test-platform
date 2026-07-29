import { Card, Typography, Empty } from 'antd'
import { DatabaseOutlined } from '@ant-design/icons'

const { Title } = Typography

export default function DatabaseConfig() {
  return (
    <div>
      <Title level={4} style={{ color: '#f1f5f9', marginBottom: 20 }}>
        <DatabaseOutlined style={{ marginRight: 8 }} />
        数据库配置
      </Title>
      <Card style={{ background: '#1e293b', borderColor: '#334155', minHeight: 300 }}>
        <Empty description={<span style={{ color: '#94a3b8' }}>功能开发中...</span>} />
      </Card>
    </div>
  )
}
