import { useState, useEffect } from 'react'
import { Card, Button, message, Table, Popconfirm, Space, Typography, Tag, InputNumber } from 'antd'
import { PlusOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api, { InviteCodeData } from '../api/client'

const { Title } = Typography

export default function InviteCodes() {
  const [codes, setCodes] = useState<InviteCodeData[]>([])
  const [loading, setLoading] = useState(false)
  const [genCount, setGenCount] = useState(1)
  const [generating, setGenerating] = useState(false)

  const fetchCodes = async () => {
    setLoading(true)
    try {
      const data = await api.listInviteCodes()
      setCodes(data)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCodes() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const data = await api.generateInviteCodes(genCount)
      message.success(`已生成 ${data.length} 个邀请码`)
      fetchCodes()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.deleteInviteCode(id)
      message.success('已删除')
      fetchCodes()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败')
    }
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      message.success('已复制到剪贴板')
    })
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '邀请码', dataIndex: 'code', key: 'code',
      render: (code: string) => (
        <Space>
          <Tag color="blue" style={{ fontSize: 15, fontFamily: 'monospace', padding: '2px 10px' }}>
            {code}
          </Tag>
          <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(code)} />
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'is_used', key: 'is_used',
      render: (used: boolean) => used
        ? <Tag color="default">已使用</Tag>
        : <Tag color="green">可用</Tag>,
    },
    {
      title: '使用者', dataIndex: 'used_by', key: 'used_by',
      render: (v: number | null) => v ? `用户 ID: ${v}` : '-',
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: InviteCodeData) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ color: '#f1f5f9', marginBottom: 20 }}>邀请码管理</Title>

      <Card style={{ background: '#1e293b', borderColor: '#334155', marginBottom: 20 }}>
        <Space>
          <span style={{ color: '#e2e8f0' }}>生成数量：</span>
          <InputNumber min={1} max={100} value={genCount} onChange={(v) => setGenCount(v || 1)} style={{ width: 80 }} />
          <Button type="primary" icon={<PlusOutlined />} loading={generating} onClick={handleGenerate}>
            生成邀请码
          </Button>
        </Space>
      </Card>

      <Table
        dataSource={codes}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '暂无邀请码' }}
        style={{ background: '#1e293b' }}
      />
    </div>
  )
}
