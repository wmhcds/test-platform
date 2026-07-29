import { useEffect, useState } from 'react'
import {
  Card,
  Select,
  Input,
  Button,
  Space,
  message,
  Typography,
  Divider,
  List,
  Tag,
  Empty,
  Popconfirm,
  Tooltip,
} from 'antd'
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ClearOutlined,
  ApiOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import api from '../api/client'
import type { HttpRequestConfigData, HttpRequestHeaderItem } from '../api/client'

const { TextArea } = Input
const { Title, Text } = Typography

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
const BODY_TYPE_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'json', label: 'JSON' },
  { value: 'raw', label: 'Raw' },
  { value: 'form-data', label: 'form-data' },
  { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
]

const EMPTY_FORM: Omit<HttpRequestConfigData, 'id' | 'created_at' | 'updated_at' | 'created_by'> = {
  name: '',
  method: 'GET',
  url: '',
  headers: [],
  body: '',
  body_type: 'none',
  description: '',
}

export default function HttpRequestConfigPage() {
  const [configs, setConfigs] = useState<HttpRequestConfigData[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const [status, setStatus] = useState('')
  const [respBody, setRespBody] = useState('等待发送请求...')

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const data = await api.listHttpRequestConfigs()
      setConfigs(data)
    } catch {
      message.error('加载配置列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const filteredConfigs = configs.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.url.toLowerCase().includes(search.toLowerCase()) ||
      c.method.toLowerCase().includes(search.toLowerCase()),
  )

  const resetForm = () => {
    setSelectedId(null)
    setForm(EMPTY_FORM)
    setStatus('')
    setRespBody('等待发送请求...')
  }

  const selectConfig = (config: HttpRequestConfigData) => {
    setSelectedId(config.id)
    setForm({
      name: config.name,
      method: config.method,
      url: config.url,
      headers: config.headers?.length ? config.headers : [],
      body: config.body,
      body_type: config.body_type,
      description: config.description,
    })
    setStatus('')
    setRespBody('等待发送请求...')
  }

  const updateField = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const addHeader = () => {
    setForm((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }],
    }))
  }

  const updateHeader = (idx: number, field: keyof HttpRequestHeaderItem, val: string) => {
    setForm((prev) => ({
      ...prev,
      headers: prev.headers.map((h, i) => (i === idx ? { ...h, [field]: val } : h)),
    }))
  }

  const removeHeader = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== idx),
    }))
  }

  const validateForm = (checkName = true) => {
    if (checkName && !form.name.trim()) {
      message.warning('配置名称为必填项')
      return false
    }
    if (!form.method) {
      message.warning('请求方法为必填项')
      return false
    }
    if (!form.url.trim()) {
      message.warning('请求 URL 为必填项')
      return false
    }
    if (form.body_type === 'json' && form.body.trim()) {
      try {
        JSON.parse(form.body)
      } catch {
        message.warning('Body 类型为 JSON 时，内容必须是合法 JSON')
        return false
      }
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        method: form.method,
        url: form.url.trim(),
        headers: form.headers.filter((h) => h.key.trim()),
        body: form.body,
        body_type: form.body_type,
        description: form.description,
      }
      if (selectedId) {
        await api.updateHttpRequestConfig(selectedId, payload)
        message.success('保存成功')
      } else {
        const created = await api.createHttpRequestConfig(payload)
        setSelectedId(created.id)
        message.success('创建成功')
      }
      await loadConfigs()
    } catch (e: any) {
      message.error(e.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    if (!validateForm(false)) return
    setSending(true)
    try {
      const headerObj: Record<string, string> = {}
      form.headers.forEach((h) => {
        if (h.key.trim()) headerObj[h.key.trim()] = h.value
      })

      let url = form.url.trim()
      if (!/^https?:\/\//.test(url) && !url.startsWith('/')) {
        url = `http://${url}`
      }

      const formData = new FormData()
      formData.append('method', form.method)
      formData.append('login_type', '')
      formData.append('url', url)
      if (Object.keys(headerObj).length) {
        formData.append('headers', JSON.stringify(headerObj))
      }
      if (form.body.trim() && form.method !== 'GET') {
        formData.append('body', form.body)
      }

      const res = await api.sendHttp(formData)
      if (res.error) {
        setStatus(`异常: ${res.error}`)
        setRespBody(res.error)
        message.error(res.error)
      } else {
        setStatus(`状态码: ${res.status_code} · 耗时: ${res.elapsed_ms}ms · 大小: ${res.size}B`)
        setRespBody(res.body)
        message.success(`完成 → ${res.status_code}`)
      }
    } catch {
      message.error('请求失败')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.deleteHttpRequestConfig(id)
      message.success('删除成功')
      if (selectedId === id) resetForm()
      await loadConfigs()
    } catch {
      message.error('删除失败')
    }
  }

  const methodColor = (m: string) => {
    const map: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
      HEAD: 'cyan',
      OPTIONS: 'default',
    }
    return map[m] || 'default'
  }

  const inputStyle = {
    background: 'rgba(30, 41, 59, 0.7)',
    borderColor: 'rgba(148,163,184,0.15)',
    color: '#fff',
  }

  return (
    <div className="http-request-config-page">
      <Title level={4} style={{ color: '#f1f5f9', marginBottom: 16 }}>
        <ApiOutlined style={{ marginRight: 8 }} />
        请求报文配置
      </Title>

      <div style={{ display: 'flex', gap: 16, width: '100%', alignItems: 'flex-start' }}>
        {/* 左侧配置列表 */}
        <Card
          style={{
            width: 360,
            flexShrink: 0,
            background: 'rgba(17, 25, 40, 0.75)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
          }}
          bodyStyle={{ padding: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              block
              onClick={resetForm}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
              }}
            >
              新建配置
            </Button>
            <Input
              prefix={<SearchOutlined style={{ color: '#64748b' }} />}
              placeholder="搜索名称 / URL / 方法"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
          </Space>

          <Divider style={{ borderColor: 'rgba(148,163,184,0.1)', margin: '16px 0' }} />

          <List
            loading={loading}
            dataSource={filteredConfigs}
            locale={{ emptyText: <Empty description="暂无配置" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            renderItem={(item) => (
              <List.Item
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 8,
                  background: selectedId === item.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                  border: `1px solid ${selectedId === item.id ? 'rgba(99, 102, 241, 0.35)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => selectConfig(item)}
                actions={[
                  <Popconfirm
                    key="del"
                    title="确定删除？"
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      handleDelete(item.id)
                    }}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={methodColor(item.method)}>{item.method}</Tag>
                      <Text ellipsis style={{ maxWidth: 150, color: '#f1f5f9' }}>
                        {item.name}
                      </Text>
                    </Space>
                  }
                  description={
                    <Text ellipsis style={{ maxWidth: 260, color: '#94a3b8', fontSize: 12 }}>
                      {item.url}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        {/* 右侧编辑区 */}
        <Card
          style={{
            flex: 1,
            minWidth: 0,
            background: 'rgba(17, 25, 40, 0.75)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
          }}
          bodyStyle={{ padding: 20 }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Input
              placeholder="配置名称（必填，如：登录接口）"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              style={inputStyle}
            />

            <Space.Compact style={{ width: '100%' }}>
              <Select
                value={form.method}
                onChange={(v) => updateField('method', v)}
                options={METHOD_OPTIONS.map((m) => ({ value: m, label: m }))}
                style={{ width: 110, color: '#fff' }}
              />
              <Input
                placeholder="example.com/api/login 或 /api/login（必填）"
                value={form.url}
                onChange={(e) => updateField('url', e.target.value)}
                style={{ flex: 1, ...inputStyle }}
              />
            </Space.Compact>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: '#e2e8f0' }}>自定义 Headers（选填）</Text>
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addHeader}>
                  新增 Header
                </Button>
              </div>
              {form.headers.length === 0 ? (
                <Text style={{ fontSize: 12, color: '#64748b' }}>暂无自定义 Header</Text>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {form.headers.map((h, idx) => (
                    <Space.Compact key={idx} style={{ width: '100%' }}>
                      <Input
                        placeholder="Header 名称"
                        value={h.key}
                        onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                        style={{ width: '35%', ...inputStyle }}
                      />
                      <Input
                        placeholder="Header 值"
                        value={h.value}
                        onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                        style={{ flex: 1, ...inputStyle }}
                      />
                      <Button danger icon={<DeleteOutlined />} onClick={() => removeHeader(idx)} />
                    </Space.Compact>
                  ))}
                </Space>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#e2e8f0' }}>请求 Body（选填）</Text>
                <Select
                  value={form.body_type}
                  onChange={(v) => updateField('body_type', v)}
                  options={BODY_TYPE_OPTIONS}
                  style={{ width: 180, color: '#fff' }}
                  size="small"
                />
              </div>
              {form.body_type !== 'none' && (
                <TextArea
                  rows={5}
                  placeholder={
                    form.body_type === 'json'
                      ? '{"username":"admin","password":"123456"}'
                      : '输入请求体内容'
                  }
                  value={form.body}
                  onChange={(e) => updateField('body', e.target.value)}
                  style={inputStyle}
                />
              )}
            </div>

            <TextArea
              rows={2}
              placeholder="描述（选填）"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              style={inputStyle}
            />

            <Space>
              <Tooltip title="保存当前配置">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSave}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                    border: 'none',
                  }}
                >
                  保存
                </Button>
              </Tooltip>
              <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={handleSend}>
                发送请求
              </Button>
              <Button icon={<ClearOutlined />} onClick={resetForm}>
                清空
              </Button>
            </Space>

            <Divider style={{ borderColor: 'rgba(148,163,184,0.1)' }} />

            <Card
              size="small"
              title="响应结果"
              style={{ background: 'rgba(10, 16, 28, 0.6)', border: '1px solid rgba(148,163,184,0.08)' }}
            >
              <Text style={{ color: '#a5b4fc' }}>{status}</Text>
              <pre
                style={{
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: 16,
                  borderRadius: 6,
                  overflowX: 'auto',
                  maxHeight: 360,
                  fontSize: 13,
                  marginTop: 12,
                }}
              >
                {respBody}
              </pre>
            </Card>
          </Space>
        </Card>
      </div>
    </div>
  )
}
