import { Layout, Menu, Button, Tooltip, message, Dropdown, Avatar } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  HomeOutlined,
  RocketOutlined,
  TeamOutlined,
  SettingOutlined,
  LeftOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useState, useMemo } from 'react'

const { Sider, Content, Header } = Layout

interface Props {
  children: ReactNode
  onLogout: () => void
}

interface ModuleConfig {
  key: string
  prefix: string
  label: string
  icon: ReactNode
  color: string
  children: { key: string; icon: string; label: string }[]
}

const MODULES: ModuleConfig[] = [
  {
    key: 'ai',
    prefix: '/ai',
    label: 'AI用例执行平台',
    icon: <RocketOutlined />,
    color: '#818cf8',
    children: [
      { key: '/ai/batches', icon: '📋', label: '测试批次列表' },
      { key: '/ai/test-cases', icon: '🧪', label: '测试用例管理' },
      { key: '/ai/http', icon: '🌐', label: 'HTTP请求' },
    ],
  },
  {
    key: 'user',
    prefix: '/user',
    label: '用户管理中心',
    icon: <TeamOutlined />,
    color: '#34d399',
    children: [
      { key: '/user/users', icon: '👥', label: '用户管理' },
      { key: '/user/invite-codes', icon: '🔑', label: '邀请码管理' },
    ],
  },
  {
    key: 'config',
    prefix: '/config',
    label: '配置中心',
    icon: <SettingOutlined />,
    color: '#fbbf24',
    children: [
      { key: '/config/scheduler', icon: '⏰', label: '定时器配置' },
      { key: '/config/database', icon: '🗄️', label: '数据库配置' },
      { key: '/config/http-request', icon: '📨', label: '请求报文配置' },
    ],
  },
]

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

  const activeModule = useMemo(() => {
    const p = location.pathname
    return MODULES.find((m) => p === m.prefix || p.startsWith(`${m.prefix}/`))
  }, [location.pathname])

  const selectedKey = useMemo(() => {
    const p = location.pathname
    if (p === '/dashboard') return '/dashboard'
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

  // 控制台页面：展示模块快捷入口
  const dashboardMenuItems = collapsed
    ? [
        { key: '/dashboard', icon: <HomeOutlined />, label: '控制台' },
        ...MODULES.map((m) => ({
          key: m.children[0].key,
          icon: m.icon,
          label: m.label,
        })),
      ]
    : [
        { key: '/dashboard', icon: <HomeOutlined />, label: '控制台' },
        {
          type: 'group',
          label: '功能模块',
          children: MODULES.map((m) => ({
            key: m.children[0].key,
            icon: m.icon,
            label: m.label,
          })),
        },
      ]

  // 模块内页面：只展示当前模块的功能
  const moduleMenuItems = activeModule
    ? [
        { key: '/dashboard', icon: <HomeOutlined />, label: '控制台' },
        {
          type: 'group',
          label: collapsed ? '' : activeModule.label,
          children: activeModule.children.map((c) => ({
            key: c.key,
            icon: c.icon,
            label: c.label,
          })),
        },
      ]
    : dashboardMenuItems

  const menuItems = activeModule ? moduleMenuItems : dashboardMenuItems
  const isDashboard = location.pathname === '/dashboard'

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      {!isDashboard && (
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

          {/* 模块返回按钮（在模块内时显示） */}
          {activeModule && !collapsed && (
            <div style={{ padding: '0 16px', marginBottom: 8 }}>
              <Button
                type="text"
                block
                icon={<LeftOutlined />}
                onClick={() => navigate('/dashboard')}
                style={{
                  color: activeModule.color,
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 10,
                  textAlign: 'left',
                  fontWeight: 500,
                }}
              >
                返回控制台
              </Button>
            </div>
          )}

          {/* 导航菜单 */}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={({ key }) => navigate(key)}
            inlineCollapsed={collapsed}
            style={{ background: 'transparent', borderRight: 0, flex: 1 }}
            items={menuItems}
          />
        </Sider>
      )}

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
