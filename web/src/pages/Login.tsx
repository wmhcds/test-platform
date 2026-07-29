import { useState, useEffect, useRef } from 'react'
import { Input, Button, Card, message, Typography, Tabs } from 'antd'
import { UserOutlined, LockOutlined, RocketOutlined, KeyOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const QUOTE_TEXT = '近来常思，人生百年，蜉蝣一日，长生于我何有哉？不过又入樊笼尔。不若二三好友，弈棋饮酒，良缘佳侣，人间携手，风光百年，同归尘土。但，问道之心，终归难改，纵使蹉跎一生，也要争那一线天机。只因幼时便知，人生如棋，落子无悔。'

interface Props {
  onLoginSuccess: (token: string) => void
}

export default function Login({ onLoginSuccess }: Props) {
  const [activeTab, setActiveTab] = useState('login')
  const [displayText, setDisplayText] = useState('')
  const [glowIndex, setGlowIndex] = useState(-1)
  const quoteRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 打字机效果：逐字显示
  useEffect(() => {
    quoteRef.current = 0
    setDisplayText('')

    timerRef.current = setInterval(() => {
      quoteRef.current++
      if (quoteRef.current <= QUOTE_TEXT.length) {
        setDisplayText(QUOTE_TEXT.slice(0, quoteRef.current))
        setGlowIndex(quoteRef.current - 1)
      } else {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }, 70)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // 登录表单
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // 注册表单
  const [regUser, setRegUser] = useState('')
  const [regPass, setRegPass] = useState('')
  const [regPass2, setRegPass2] = useState('')
  const [regCode, setRegCode] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  const handleLogin = async () => {
    if (!loginUser.trim() || !loginPass.trim()) {
      message.warning('请输入账号和密码')
      return
    }
    setLoginLoading(true)
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPass }),
      })
      const data = await resp.json()
      if (resp.ok && data.ok) {
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_role', data.role || 'user')
        localStorage.setItem('auth_username', data.username || loginUser.trim())
        onLoginSuccess(data.token)
        message.success('登录成功')
      } else {
        message.error(data.detail || '账号或密码错误')
      }
    } catch {
      message.error('网络错误，请稍后重试')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!regUser.trim()) {
      message.warning('请输入用户名')
      return
    }
    if (regUser.trim().length < 2) {
      message.warning('用户名至少2个字符')
      return
    }
    if (!regPass || regPass.length < 6) {
      message.warning('密码至少6位')
      return
    }
    if (regPass !== regPass2) {
      message.warning('两次密码不一致')
      return
    }
    if (!regCode.trim()) {
      message.warning('请输入邀请码')
      return
    }
    if (regCode.trim().length !== 6) {
      message.warning('邀请码为6位')
      return
    }
    setRegLoading(true)
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUser.trim(),
          password: regPass,
          invite_code: regCode.trim().toUpperCase(),
        }),
      })
      const data = await resp.json()
      if (resp.ok && data.ok) {
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_role', data.role || 'user')
        localStorage.setItem('auth_username', data.username || regUser.trim())
        onLoginSuccess(data.token)
        message.success('注册成功，已自动登录')
      } else {
        message.error(data.detail || '注册失败')
      }
    } catch {
      message.error('网络错误，请稍后重试')
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* 文案层：动画仅在文案背后展示 */}
      <div className="login-quote-wrapper">
        <div className="quote-aurora" />
        <div className="quote-particles">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={`qp-${i}`}
              className="quote-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${4 + Math.random() * 5}s`,
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
              }}
            />
          ))}
        </div>

        <div className="login-quote-text modern-quote">
          {displayText.split('').map((char, i) => (
            <span
              key={i}
              className={`quote-char ${i === glowIndex ? 'just-typed' : ''}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {char}
            </span>
          ))}
          {displayText.length >= QUOTE_TEXT.length && (
            <span className="quote-cursor">|</span>
          )}
        </div>
      </div>

      <Card className="login-card" bordered={false}>
        <div className="login-header">
          <RocketOutlined className="login-logo" />
          <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
            AI 测试平台
          </Title>
          <Text style={{ color: '#cbd5e1' }}>请登录或注册以继续使用</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          style={{ marginTop: 8 }}
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <>
                  <Input
                    size="large"
                    prefix={<UserOutlined />}
                    placeholder="账号"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    onPressEnter={handleLogin}
                    style={{ marginBottom: 16 }}
                  />
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="密码"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    onPressEnter={handleLogin}
                    style={{ marginBottom: 24 }}
                  />
                  <Button type="primary" size="large" block loading={loginLoading} onClick={handleLogin}>
                    登 录
                  </Button>
                </>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <>
                  <Input
                    size="large"
                    prefix={<UserOutlined />}
                    placeholder="用户名"
                    value={regUser}
                    onChange={(e) => setRegUser(e.target.value)}
                    style={{ marginBottom: 16 }}
                  />
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="密码（至少6位）"
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    style={{ marginBottom: 16 }}
                  />
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="确认密码"
                    value={regPass2}
                    onChange={(e) => setRegPass2(e.target.value)}
                    style={{ marginBottom: 16 }}
                  />
                  <Input
                    size="large"
                    prefix={<KeyOutlined />}
                    placeholder="6位邀请码"
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    onPressEnter={handleRegister}
                    style={{ marginBottom: 24 }}
                  />
                  <Button type="primary" size="large" block loading={regLoading} onClick={handleRegister}>
                    注 册
                  </Button>
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
