import { useState } from 'react'
import { Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined, RocketOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

interface Props {
  onLoginSuccess: (token: string) => void
}

export default function Login({ onLoginSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      message.warning('请输入账号和密码')
      return
    }
    setLoading(true)
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await resp.json()
      if (resp.ok && data.ok) {
        localStorage.setItem('auth_token', data.token)
        onLoginSuccess(data.token)
        message.success('登录成功')
      } else {
        message.error(data.detail || '账号或密码错误')
      }
    } catch {
      message.error('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <div className="login-header">
          <RocketOutlined className="login-logo" />
          <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
            AI 测试平台
          </Title>
          <Text type="secondary">请登录以继续使用</Text>
        </div>

        <Input
          size="large"
          prefix={<UserOutlined />}
          placeholder="账号"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onPressEnter={handleLogin}
          style={{ marginBottom: 16 }}
        />

        <Input.Password
          size="large"
          prefix={<LockOutlined />}
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={handleLogin}
          style={{ marginBottom: 24 }}
        />

        <Button
          type="primary"
          size="large"
          block
          loading={loading}
          onClick={handleLogin}
        >
          登 录
        </Button>
      </Card>
    </div>
  )
}
