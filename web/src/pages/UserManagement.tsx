import { useState, useEffect } from 'react'
import { Card, Button, message, Table, Popconfirm, Space, Typography, Tag, Modal, Input, Select } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api, { UserData } from '../api/client'

const { Title } = Typography

export default function UserManagement() {
  const isAdmin = localStorage.getItem('auth_role') === 'admin'

  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(false)

  // 新增用户弹窗
  const [addOpen, setAddOpen] = useState(false)
  const [newUser, setNewUser] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [saving, setSaving] = useState(false)

  // 修改角色
  const [roleOpen, setRoleOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserData | null>(null)
  const [editRole, setEditRole] = useState('user')

  // 修改密码
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdUser, setPwdUser] = useState<UserData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await api.listUsers()
      setUsers(data)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAdd = async () => {
    if (!newUser.trim() || newUser.trim().length < 2) {
      message.warning('用户名至少2个字符')
      return
    }
    if (!newPass || newPass.length < 6) {
      message.warning('密码至少6位')
      return
    }
    setSaving(true)
    try {
      await api.createUser({ username: newUser.trim(), password: newPass, role: newRole })
      message.success('用户创建成功')
      setAddOpen(false)
      setNewUser('')
      setNewPass('')
      setNewRole('user')
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.deleteUser(id)
      message.success('已删除')
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败')
    }
  }

  const handleDisable = async (id: number, disabled: boolean) => {
    try {
      await api.toggleUserDisabled(id, disabled)
      message.success(disabled ? '已禁用' : '已启用')
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    }
  }

  const handleRoleSave = async () => {
    if (!editUser) return
    try {
      await api.updateUserRole(editUser.id, editRole)
      message.success('权限已更新')
      setRoleOpen(false)
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '更新失败')
    }
  }

  const handlePasswordSave = async () => {
    if (!pwdUser) return
    if (!newPassword || newPassword.length < 6) {
      message.warning('密码至少6位')
      return
    }
    setPwdSaving(true)
    try {
      await api.updateUserPassword(pwdUser.id, newPassword)
      message.success('密码已修改')
      setPwdOpen(false)
      setNewPassword('')
    } catch (err: any) {
      message.error(err.response?.data?.detail || '修改失败')
    } finally {
      setPwdSaving(false)
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '角色', dataIndex: 'role', key: 'role',
      render: (role: string) => role === 'admin'
        ? <Tag color="red">管理员</Tag>
        : <Tag color="blue">普通用户</Tag>,
    },
    {
      title: '状态', dataIndex: 'disabled', key: 'disabled',
      render: (disabled: boolean) => disabled
        ? <Tag color="error">已禁用</Tag>
        : <Tag color="success">正常</Tag>,
    },
    {
      title: '注册时间', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: UserData) => isAdmin ? (
        <Space>
          <Button type="text" icon={<EditOutlined />} size="small" onClick={() => {
            setEditUser(record)
            setEditRole(record.role)
            setRoleOpen(true)
          }}>
            权限
          </Button>
          <Button type="text" icon={<LockOutlined />} size="small" onClick={() => {
            setPwdUser(record)
            setNewPassword('')
            setPwdOpen(true)
          }}>
            密码
          </Button>
          {record.disabled ? (
            <Popconfirm title="确认启用该用户？" onConfirm={() => handleDisable(record.id, false)} okText="启用" cancelText="取消">
              <Button type="text" icon={<CheckCircleOutlined />} size="small" style={{ color: '#10b981' }} />
            </Popconfirm>
          ) : (
            <Popconfirm title="确认禁用该用户？" onConfirm={() => handleDisable(record.id, true)} okText="禁用" cancelText="取消">
              <Button type="text" icon={<StopOutlined />} size="small" style={{ color: '#f59e0b' }} />
            </Popconfirm>
          )}
          <Popconfirm title="确认删除该用户？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ) : <span style={{ color: '#94a3b8' }}>-</span>,
    },
  ]

  return (
    <div>
      <Title level={4} style={{ color: '#f1f5f9', marginBottom: 20 }}>用户管理</Title>

      {isAdmin && (
        <Card style={{ background: '#1e293b', borderColor: '#334155', marginBottom: 20 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            新增用户
          </Button>
        </Card>
      )}

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '暂无用户' }}
        style={{ background: '#1e293b' }}
      />

      {/* 新增用户弹窗 */}
      <Modal
        title="新增用户"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={handleAdd}
        confirmLoading={saving}
        okText="创建" cancelText="取消"
        styles={{ content: { background: '#1e293b' }, header: { background: '#1e293b' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <Input placeholder="用户名" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
          <Input.Password placeholder="密码（至少6位）" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          <div>
            <span style={{ color: '#e2e8f0', marginRight: 8 }}>角色：</span>
            <Select value={newRole} onChange={setNewRole} style={{ width: 120 }}>
              <Select.Option value="user">普通用户</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* 修改角色弹窗 */}
      <Modal
        title={`修改 ${editUser?.username} 的权限`}
        open={roleOpen}
        onCancel={() => setRoleOpen(false)}
        onOk={handleRoleSave}
        okText="保存" cancelText="取消"
        styles={{ content: { background: '#1e293b' }, header: { background: '#1e293b' } }}
      >
        <div style={{ marginTop: 8 }}>
          <span style={{ color: '#e2e8f0', marginRight: 8 }}>角色：</span>
          <Select value={editRole} onChange={setEditRole} style={{ width: 120 }}>
            <Select.Option value="user">普通用户</Select.Option>
            <Select.Option value="admin">管理员</Select.Option>
          </Select>
        </div>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title={`修改 ${pwdUser?.username} 的密码`}
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        onOk={handlePasswordSave}
        confirmLoading={pwdSaving}
        okText="保存" cancelText="取消"
        styles={{ content: { background: '#1e293b' }, header: { background: '#1e293b' } }}
      >
        <div style={{ marginTop: 8 }}>
          <Input.Password
            placeholder="新密码（至少6位）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onPressEnter={handlePasswordSave}
          />
        </div>
      </Modal>
    </div>
  )
}
