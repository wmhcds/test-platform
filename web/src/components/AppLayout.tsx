import { Layout, Menu, Button, Tooltip, message } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useState } from 'react'

const { Sider, Content } = Layout

interface Props {
  children: ReactNode
  onLogout: () => void
}

export default function AppLayout({ children, onLogout }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('auth_token') || ''
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('auth_token')
      onLogout()
      message.success('已退出登录')
    }
  }

  const selectedKey =
    location.pathname === '/'
      ? '/'
      : location.pathname.startsWith('/report')
        ? '/report'
        : location.pathname

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        width={220}
        breakpoint="md"
        collapsedWidth={64}
        trigger={null}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderRight: '1px solid rgba(148,163,184,0.12)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo 区域 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            height: 64,
            padding: collapsed ? '0 12px' : '0 20px',
            borderBottom: '1px solid rgba(148,163,184,0.14)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 20 }}>🚀</span>
          {!collapsed && (
            <span
              style={{
                color: '#f1f5f9',
                fontSize: 15,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                letterSpacing: 0.3,
              }}
            >
              AI用例执行平台
            </span>
          )}
        </div>

        {/* 折叠按钮 */}
        <div style={{ textAlign: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <Tooltip title={collapsed ? '展开菜单' : '收起菜单'}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              size="small"
              style={{
                color: '#94a3b8',
                borderRadius: 8,
              }}
            />
          </Tooltip>
        </div>

        {/* 导航菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          inlineCollapsed={collapsed}
          style={{
            background: 'transparent',
            borderRight: 0,
            marginTop: 8,
            flex: 1,
          }}
          items={[
            { key: '/', icon: '📋', label: '测试批次列表' },
            { key: '/http', icon: '🌐', label: 'HTTP请求' },
          ]}
        />

        {/* 底部登出按钮 */}
        <div
          style={{
            borderTop: '1px solid rgba(148,163,184,0.12)',
            padding: collapsed ? '12px 0' : '12px 16px',
            flexShrink: 0,
          }}
        >
          <Tooltip title="退出登录">
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              block
              style={{
                color: '#ef4444',
                textAlign: collapsed ? 'center' : 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 8,
                borderRadius: 8,
                padding: collapsed ? '4px 0' : '4px 12px',
              }}
            >
              {!collapsed && '退出登录'}
            </Button>
          </Tooltip>
        </div>
      </Sider>

      <Layout>
        <Content
          style={{
            padding: 24,
            background: 'linear-gradient(180deg, #0b1120 0%, #0f172a 100%)',
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
