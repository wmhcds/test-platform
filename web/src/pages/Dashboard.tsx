import { useNavigate } from 'react-router-dom'
import { RocketOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons'

export default function Dashboard() {
  const navigate = useNavigate()

  const cards = [
    {
      key: 'ai',
      title: 'AI用例执行平台',
      icon: <RocketOutlined style={{ fontSize: 48 }} />,
      desc: '测试批次管理 · 用例管理 · HTTP 请求调试',
      color: '#6366f1',
      glow: 'rgba(99, 102, 241, 0.4)',
      onClick: () => navigate('/'),
    },
    {
      key: 'user',
      title: '用户管理中心',
      icon: <TeamOutlined style={{ fontSize: 48 }} />,
      desc: '用户管理 · 邀请码管理 · 权限控制',
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.4)',
      onClick: () => navigate('/users'),
    },
    {
      key: 'config',
      title: '配置中心',
      icon: <SettingOutlined style={{ fontSize: 48 }} />,
      desc: '定时器配置 · 数据库配置',
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.4)',
      onClick: () => navigate('/config/scheduler'),
    },
  ]

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <h1 className="dashboard-title">控制台</h1>
        <p className="dashboard-subtitle">选择要访问的功能模块</p>
      </div>

      <div className="dashboard-cards">
        {cards.map((card) => (
          <div
            key={card.key}
            className="dashboard-card"
            onClick={card.onClick}
            style={{
              '--card-color': card.color,
              '--card-glow': card.glow,
            } as React.CSSProperties}
          >
            <div className="dashboard-card-bg" />
            <div className="dashboard-card-icon" style={{ color: card.color }}>
              {card.icon}
            </div>
            <h2 className="dashboard-card-title">{card.title}</h2>
            <p className="dashboard-card-desc">{card.desc}</p>
            <div className="dashboard-card-border" />
          </div>
        ))}
      </div>
    </div>
  )
}
