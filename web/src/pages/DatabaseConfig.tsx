import { useState, useEffect, useCallback } from 'react'
import {
  Card, Typography, Button, Input, Select, Form, Space, List, Popconfirm,
  message, Empty, Spin, Tag, Row, Col,
} from 'antd'
import {
  PlusOutlined, DatabaseOutlined, DeleteOutlined, EditOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { DatabaseConfigData } from '../api/client'
import api from '../api/client'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL', color: '#4479a1' },
  { value: 'mariadb', label: 'MariaDB', color: '#c0765a' },
  { value: 'oracle', label: 'Oracle', color: '#f80000' },
  { value: 'postgresql', label: 'PostgreSQL', color: '#336791' },
  { value: 'sqlserver', label: 'SQL Server', color: '#cc2927' },
]

const DEFAULT_PORT: Record<string, number> = {
  mysql: 3306, mariadb: 3306, oracle: 1521, postgresql: 5432, sqlserver: 1433,
}

interface FormData {
  name: string
  db_type: string
  host: string
  port: number
  username: string
  password: string
  database_name: string
  notes: string
}

const EMPTY_FORM: FormData = {
  name: '', db_type: 'mysql', host: '', port: 3306,
  username: '', password: '', database_name: '', notes: '',
}

export default function DatabaseConfig() {
  const [configs, setConfigs] = useState<DatabaseConfigData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listDatabaseConfigs()
      setConfigs(Array.isArray(data) ? data : [])
    } catch {
      message.error('加载数据库配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  const selectConfig = async (id: number) => {
    try {
      const data = await api.getDatabaseConfig(id)
      setSelectedId(id)
      setForm({
        name: data.name, db_type: data.db_type, host: data.host,
        port: data.port, username: data.username, password: data.password,
        database_name: data.database_name, notes: data.notes || '',
      })
    } catch {
      message.error('加载配置详情失败')
    }
  }

  const resetForm = () => {
    setSelectedId(null)
    setForm({ ...EMPTY_FORM })
  }

  const handleDbTypeChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      db_type: value,
      port: DEFAULT_PORT[value] || prev.port,
    }))
  }

  const validate = (): boolean => {
    if (!form.name.trim()) { message.warning('请输入配置名称'); return false }
    if (!form.host.trim()) { message.warning('请输入主机地址'); return false }
    if (!form.port || form.port <= 0) { message.warning('请输入有效端口'); return false }
    if (!form.username.trim()) { message.warning('请输入账号'); return false }
    if (!form.database_name.trim()) { message.warning('请输入数据库名'); return false }
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (selectedId) {
        await api.updateDatabaseConfig(selectedId, form)
        message.success('配置已更新')
      } else {
        await api.createDatabaseConfig(form)
        message.success('配置已创建')
      }
      resetForm()
      await loadConfigs()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.deleteDatabaseConfig(id)
      message.success('配置已删除')
      if (selectedId === id) resetForm()
      await loadConfigs()
    } catch {
      message.error('删除失败')
    }
  }

  const filtered = configs.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const dbTypeTag = (type: string) => {
    const item = DB_TYPES.find((d) => d.value === type)
    return item ? <Tag color={item.color}>{item.label}</Tag> : <Tag>{type}</Tag>
  }

  return (
    <div>
      <Title level={4} style={{ color: '#f1f5f9', marginBottom: 20 }}>
        <DatabaseOutlined style={{ marginRight: 8 }} />
        数据库配置
      </Title>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* 左侧：配置列表 */}
        <Card
          title="配置列表"
          size="small"
          extra={
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={resetForm}>
              新建
            </Button>
          }
          style={{
            width: 360, flexShrink: 0,
            background: '#1e293b', borderColor: '#334155',
          }}
          headStyle={{ color: '#e2e8f0', borderColor: '#334155', fontSize: 14 }}
          bodyStyle={{ padding: 0, maxHeight: 560, overflow: 'auto' }}
        >
          <div style={{ padding: '8px 12px' }}>
            <Input
              placeholder="搜索配置名称..."
              allowClear
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
            />
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : filtered.length === 0 ? (
            <Empty
              description={<span style={{ color: '#94a3b8' }}>暂无配置</span>}
              style={{ padding: 40 }}
            />
          ) : (
            <List
              dataSource={filtered}
              renderItem={(item) => (
                <List.Item
                  onClick={() => selectConfig(item.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 16px',
                    background: selectedId === item.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                    borderBottom: '1px solid #334155',
                    transition: 'background 0.2s',
                  }}
                  className="db-config-list-item"
                  actions={[
                    <Popconfirm
                      key="del"
                      title="确认删除该数据库配置？"
                      onConfirm={(e) => { e?.stopPropagation(); handleDelete(item.id) }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <Button
                        type="text" size="small" danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>
                        {item.name}
                      </span>
                    }
                    description={
                      <Space size={4} wrap>
                        {dbTypeTag(item.db_type)}
                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>
                          {item.host}:{item.port}/{item.database_name}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #334155' }}>
            <Button block size="small" icon={<ReloadOutlined />} onClick={loadConfigs} style={{ color: '#94a3b8' }}>
              刷新
            </Button>
          </div>
        </Card>

        {/* 右侧：编辑表单 */}
        <Card
          title={selectedId ? `编辑配置 #${selectedId}` : '新建配置'}
          size="small"
          extra={
            <Space>
              <Button size="small" onClick={resetForm}>清空</Button>
              <Button
                type="primary" size="small"
                loading={saving}
                icon={<EditOutlined />}
                onClick={handleSave}
              >
                {selectedId ? '更新' : '保存'}
              </Button>
            </Space>
          }
          style={{
            flex: 1, background: '#1e293b', borderColor: '#334155',
          }}
          headStyle={{ color: '#e2e8f0', borderColor: '#334155', fontSize: 14 }}
        >
          <Form layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label={<span style={{ color: '#cbd5e1' }}>配置名称 *</span>}>
                  <Input
                    placeholder="如：测试库-MySQL"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={<span style={{ color: '#cbd5e1' }}>数据库类型 *</span>}>
                  <Select
                    value={form.db_type}
                    onChange={handleDbTypeChange}
                    style={{ width: '100%' }}
                    dropdownStyle={{ background: '#1e293b' }}
                  >
                    {DB_TYPES.map((t) => (
                      <Option key={t.value} value={t.value}>
                        <Tag color={t.color}>{t.label}</Tag>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item label={<span style={{ color: '#cbd5e1' }}>主机地址 *</span>}>
                  <Input
                    placeholder="如：192.168.1.100 或 db.example.com"
                    value={form.host}
                    onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                    style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={<span style={{ color: '#cbd5e1' }}>端口 *</span>}>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) || 0 }))}
                    style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label={<span style={{ color: '#cbd5e1' }}>账号 *</span>}>
                  <Input
                    placeholder="数据库账号"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={<span style={{ color: '#cbd5e1' }}>密码</span>}>
                  <Input.Password
                    placeholder="数据库密码"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                    iconRender={(visible) => (visible ? <span style={{ color: '#94a3b8' }}>👁</span> : <span style={{ color: '#94a3b8' }}>👁‍🗨</span>)}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item label={<span style={{ color: '#cbd5e1' }}>数据库名 *</span>}>
                  <Input
                    placeholder="数据库名 / SID / Service Name"
                    value={form.database_name}
                    onChange={(e) => setForm((p) => ({ ...p, database_name: e.target.value }))}
                    style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label={<span style={{ color: '#cbd5e1' }}>备注</span>}>
              <TextArea
                placeholder="备注信息（选填）"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                style={{ background: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
              />
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  )
}
