import { Layout, Menu, Button, Tooltip, message, Dropdown, Avatar } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useState, useMemo } from 'react'

const { Sider, Content, Header } = Layout

interface Props {
  children: ReactNode
  onLogout: () => void
}

export default function AppLayout({ children, onLogout }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const username = localStorage.getItem('auth_username') || '用户'

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
      localStorage.removeItem('auth_role')
      localStorage.removeItem('auth_username')
      onLogout()
      message.success('已退出登录')
    }
  }

  const selectedKey = useMemo(() => {
    const p = location.pathname
    if (p === '/dashboard') return '/dashboard'
    if (p === '/') return '/'
    if (p.startsWith('/report')) return '/report'
    if (p.startsWith('/test-cases')) return '/test-cases'
    if (p.startsWith('/http')) return '/http'
    if (p.startsWith('/invite-codes')) return '/invite-codes'
    if (p.startsWith('/users')) return '/users'
    if (p.startsWith('/config/scheduler')) return '/config/scheduler'
    if (p.startsWith('/config/database')) return '/config/database'
    return p
  }, [location.pathname])

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ]

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
            height: 56,
            padding: collapsed ? '0 12px' : '0 20px',
            borderBottom: '1px solid rgba(148,163,184,0.14)',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/dashboard')}
        >
          <span style={{ fontSize: 20 }}>🚀</span>
          {!collapsed && (
            <span style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
              AI测试平台
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
              style={{ color: '#cbd5e1', borderRadius: 8 }}
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
          style={{ background: 'transparent', borderRight: 0, marginTop: 8, flex: 1 }}
          items={[
            { key: '/dashboard', icon: <HomeOutlined />, label: '控制台' },
            {
              type: 'group',
              label: collapsed ? '' : 'AI用例执行平台',
              children: [
                { key: '/', icon: '📋', label: '测试批次列表' },
                { key: '/test-cases', icon: '🧪', label: '测试用例管理' },
                { key: '/http', icon: '🌐', label: 'HTTP请求' },
              ],
            },
            {
              type: 'group',
              label: collapsed ? '' : '用户管理中心',
              children: [
                { key: '/users', icon: '👥', label: '用户管理' },
                { key: '/invite-codes', icon: '🔑', label: '邀请码管理' },
              ],
            },
            {
              type: 'group',
              label: collapsed ? '' : '配置中心',
              children: [
                { key: '/config/scheduler', icon: '⏰', label: '定时器配置' },
                { key: '/config/database', icon: '🗄️', label: '数据库配置' },
              ],
            },
          ]}
        />
      </Sider>

      <Layout>
        {/* 顶部栏：用户名 + 退出登录 */}
        <Header
          style={{
            height: 56,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(148,163,184,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
          }}
        >
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: 8,
                transition: 'background 0.2s',
              }}
              className="header-user-btn"
            >
              <Avatar size={28} icon={<UserOutlined />} style={{ background: '#6366f1' }} />
              <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 500 }}>{username}</span>
            </div>
          </Dropdown>
        </Header>

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
