import { useState } from 'react'
import {
  Card,
  Select,
  Input,
  Button,
  Upload,
  Space,
  Tag,
  List,
  message,
  Typography,
  Divider,
  Drawer,
  Badge,
  Modal,
  Descriptions,
  Empty,
  Tooltip,
} from 'antd'
import {
  UploadOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import api from '../api/client'

const { TextArea } = Input
const { Paragraph, Text } = Typography

interface HeaderItem {
  key: string
  value: string
}

interface HistoryItem {
  method: string
  url: string
  status?: number
  elapsed?: number
  time: string
  body?: string
  error?: string
}

const MAX_HISTORY = 20

// 登录方式枚举（后续接入新系统时在此追加选项）
const LOGIN_OPTIONS = [{ value: 'XBOSS', label: 'XBOSS' }]

export default function HttpClient() {
  const [method, setMethod] = useState<'GET' | 'POST'>('POST')
  const [url, setUrl] = useState('')
  const [headerRows, setHeaderRows] = useState<HeaderItem[]>([])
  const [body, setBody] = useState('')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [sending, setSending] = useState(false)

  const [status, setStatus] = useState<string>('')
  const [respBody, setRespBody] = useState<string>('{ "等待发送请求..." }')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<HistoryItem | null>(null)
  const [loginType, setLoginType] = useState('XBOSS')

  const isPost = method === 'POST'
  const hasFiles = fileList.length > 0

  const addHeader = () =>
    setHeaderRows((r) => [...r, { key: '', value: '' }])
  const updateHeader = (idx: number, field: 'key' | 'value', val: string) =>
    setHeaderRows((r) =>
      r.map((row, i) => (i === idx ? { ...row, [field]: val } : row)),
    )
  const removeHeader = (idx: number) =>
    setHeaderRows((r) => r.filter((_, i) => i !== idx))

  const pushHistory = (item: HistoryItem) =>
    setHistory((h) => [item, ...h].slice(0, MAX_HISTORY))

  const handleSend = async () => {
    if (!url.trim()) {
      message.warning('请输入 URL')
      return
    }
    // 有文件时校验 body 是否为合法 JSON
    if (hasFiles && body.trim()) {
      try {
        JSON.parse(body)
      } catch {
        message.error('上传文件时，请求参数必须为 JSON 对象格式（如 {"fileName":"a.png","applyNo":"xxx"}）')
        return
      }
    }
    setSending(true)
    try {
      // 把多行 Header 收敛成对象（忽略空 key），再序列化为 JSON 字符串
      const headerObj: Record<string, string> = {}
      headerRows.forEach((h) => {
        if (h.key.trim()) headerObj[h.key.trim()] = h.value
      })
      const headersStr = Object.keys(headerObj).length
        ? JSON.stringify(headerObj)
        : ''

      const formData = new FormData()
      formData.append('method', method)
      formData.append('login_type', loginType)
      formData.append('url', url.trim())
      if (headersStr) formData.append('headers', headersStr)
      if (body.trim()) formData.append('body', body)
      fileList.forEach((f) => {
        if (f.originFileObj) formData.append('files', f.originFileObj)
      })

      const res = await api.sendHttp(formData)
      if (res.error) {
        setStatus(`异常: ${res.error}`)
        setRespBody(res.error)
        pushHistory({
          method,
          url: url.trim(),
          error: res.error,
          time: new Date().toLocaleString(),
        })
        message.error(res.error)
      } else {
        setStatus(`状态码: ${res.status_code}`)
        setRespBody(res.body)
        pushHistory({
          method,
          url: url.trim(),
          status: res.status_code,
          elapsed: res.elapsed_ms,
          body: res.body,
          time: new Date().toLocaleString(),
        })
        message.success(`完成 → ${res.status_code} (${res.elapsed_ms}ms)`)
      }
    } catch (e) {
      message.error('请求失败')
    } finally {
      setSending(false)
    }
  }

  const handleClear = () => {
    setHeaderRows([])
    setBody('')
    setFileList([])
  }

  // 根据「是否选择了文件」动态切换提示文案和示例
  const bodyLabel = hasFiles
    ? '表单字段（JSON 对象，与文件一起以 multipart/form-data 提交）'
    : '请求参数 Body（JSON 格式，POST 时使用）'
  const bodyPlaceholder = hasFiles
    ? '{"fileName":"tupian.png","applyNo":"A20260717GZIIIGIA","preApplyNo":"260717GZIIIGIA","docType":"bankStatements"}'
    : '{"status":[50,70],"pageNum":1,"pageSize":20}'

  return (
    <div className="http-page">
      <Card
        title={
          <span className="card-title-text">
            🌐 HTTP 请求测试
          </span>
        }
        className="http-client-card"
      >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space>
          <Text type="secondary">登录方式</Text>
          <Select
            value={loginType}
            style={{ width: 160 }}
            onChange={(v) => setLoginType(v)}
            options={LOGIN_OPTIONS}
          />
        </Space>

        <Space.Compact style={{ width: '100%' }}>
          <Select
            value={method}
            style={{ width: 120 }}
            onChange={(v) => setMethod(v)}
            options={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
            ]}
          />
          <Input
            placeholder="https://beta.vb.oa.com/... 或填接口 path 自动拼接"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1 }}
          />
        </Space.Compact>

        {/* 自定义 Headers */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text type="secondary">
              自定义 Headers（可选，默认仅携带 User-Agent）
            </Text>
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addHeader}
            >
              新增 Header
            </Button>
          </div>

          {headerRows.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              暂无自定义 Header，点击「新增 Header」按需添加
            </Text>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {headerRows.map((row, idx) => (
                <Space.Compact key={idx} style={{ width: '100%' }}>
                  <Input
                    placeholder="Header 名称，如 Content-Type"
                    value={row.key}
                    onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                    style={{ width: '40%' }}
                  />
                  <Input
                    placeholder="Header 值"
                    value={row.value}
                    onChange={(e) =>
                      updateHeader(idx, 'value', e.target.value)
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeHeader(idx)}
                  />
                </Space.Compact>
              ))}
            </Space>
          )}
        </div>

        {/* Body / 表单字段 — 根据是否有文件自动切换模式 */}
        {isPost && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text type="secondary">{bodyLabel}</Text>
              {hasFiles && (
                <Tooltip title="选择文件后，此处填写的内容会作为 multipart 表单字段提交（而非 JSON Body）。适合文件上传接口需要额外传 fileName / applyNo 等参数的场景。">
                  <QuestionCircleOutlined style={{ color: '#999', cursor: 'help' }} />
                </Tooltip>
              )}
            </div>
            <TextArea
              rows={4}
              placeholder={bodyPlaceholder}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        )}

        {/* 文件上传 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text type="secondary">上传文件（图片/文档，可选）</Text>
            {hasFiles && (
              <Tag color="blue" style={{ fontSize: 11 }}>
                已选 {fileList.length} 个文件 · 上方切换为「表单字段」模式
              </Tag>
            )}
          </div>
          <Upload
            multiple
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList: l }) => setFileList(l)}
          >
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
        </div>

        <Space>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={sending}
            onClick={handleSend}
          >
            发送请求
          </Button>
          <Button onClick={handleClear}>清空</Button>
          <Badge count={history.length} size="small" offset={[-2, 2]}>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => setHistoryOpen(true)}
            >
              请求历史
            </Button>
          </Badge>
        </Space>

        <Divider />

        <Card size="small" title="响应结果">
          <Paragraph>
            <Text strong>{status}</Text>
          </Paragraph>
          <Paragraph>
            <pre
              style={{
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: 16,
                borderRadius: 6,
                overflowX: 'auto',
                maxHeight: 400,
                fontSize: 13,
              }}
            >
              {respBody}
            </pre>
          </Paragraph>
        </Card>
      </Space>

      {/* 请求历史抽屉 */}
      <Drawer
        title="请求历史"
        placement="right"
        width={520}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        extra={
          history.length > 0 && (
            <Text type="secondary">
              共 {history.length} / {MAX_HISTORY} 条
            </Text>
          )
        }
      >
        {history.length === 0 ? (
          <Empty description="暂无请求记录" />
        ) : (
          <List
            dataSource={history}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => setDetailItem(item)}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag
                      color={
                        item.status && item.status < 300 ? 'green' : 'red'
                      }
                    >
                      {item.method} {item.status ?? 'ERR'}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.time}
                    </Text>
                    {item.elapsed != null && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.elapsed}ms
                      </Text>
                    )}
                  </Space>
                  <Text ellipsis style={{ maxWidth: '100%' }}>
                    {item.url}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Drawer>

      {/* 请求详情弹窗 */}
      <Modal
        title="请求详情"
        open={!!detailItem}
        footer={null}
        width={680}
        onCancel={() => setDetailItem(null)}
      >
        {detailItem && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="方法">
                {detailItem.method}
              </Descriptions.Item>
              <Descriptions.Item label="URL">
                {detailItem.url}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={
                    detailItem.status && detailItem.status < 300
                      ? 'green'
                      : 'red'
                  }
                >
                  {detailItem.status ?? 'ERR'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {detailItem.elapsed != null ? `${detailItem.elapsed} ms` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="时间">
                {detailItem.time}
              </Descriptions.Item>
            </Descriptions>
            <div>
              <Text strong>响应内容</Text>
              <pre
                style={{
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: 16,
                  borderRadius: 6,
                  overflow: 'auto',
                  maxHeight: 360,
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                {detailItem.body || detailItem.error || '(空)'}
              </pre>
            </div>
          </Space>
        )}
      </Modal>
    </Card>
    </div>
  )
}
