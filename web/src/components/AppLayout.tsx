import { Layout, Menu, Button, Tooltip } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useState } from 'react'

const { Sider, Content } = Layout

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

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
        collapsedWidth={0}
        trigger={null}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderRight: '1px solid rgba(148,163,184,0.12)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'auto',
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
            padding: collapsed ? '0 16px' : '0 20px',
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
          }}
          items={[
            { key: '/', icon: '📋', label: '测试批次列表' },
            { key: '/http', icon: '🌐', label: 'HTTP请求' },
          ]}
        />
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
