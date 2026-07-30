import { useState, useEffect, useCallback } from 'react'
import {
  Card, Typography, Button, Select, Input, Table, Space, message, Spin, Tag, Empty, Tooltip,
} from 'antd'
import {
  PlayCircleOutlined, DatabaseOutlined, ClearOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { DatabaseConfigData, DbQueryResult } from '../api/client'
import api from '../api/client'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

const DB_COLORS: Record<string, string> = {
  mysql: '#4479a1', mariadb: '#c0765a', oracle: '#f80000',
  postgresql: '#336791', sqlserver: '#cc2927',
}

export default function DbQuery() {
  const [dbConfigs, setDbConfigs] = useState<DatabaseConfigData[]>([])
  const [selectedDbId, setSelectedDbId] = useState<number | null>(null)
  const [sql, setSql] = useState('')
  const [executing, setExecuting] = useState(false)
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [result, setResult] = useState<DbQueryResult | null>(null)

  const loadDbConfigs = useCallback(async () => {
    setLoadingConfigs(true)
    try {
      const data = await api.listDatabaseConfigs()
      setDbConfigs(Array.isArray(data) ? data : [])
    } catch {
      message.error('加载数据库配置失败')
    } finally {
      setLoadingConfigs(false)
    }
  }, [])

  useEffect(() => { loadDbConfigs() }, [loadDbConfigs])

  const handleExecute = async () => {
    if (!selectedDbId) { message.warning('请先选择数据库配置'); return }
    if (!sql.trim()) { message.warning('请输入 SQL 语句'); return }
    setExecuting(true)
    setResult(null)
    try {
      const data = await api.executeDbQuery(selectedDbId, sql.trim())
      setResult(data)
      if (data.message && !data.message.startsWith('查询成功') && !data.message.startsWith('执行成功')) {
        message.warning(data.message)
      } else {
        message.success(data.message)
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '执行失败')
    } finally {
      setExecuting(false)
    }
  }

  // 从结果构建表格列
  const buildColumns = () => {
    if (!result || result.columns.length === 0) return []
    return result.columns.map((col, idx) => ({
      title: <Text style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12 }}>{col}</Text>,
      dataIndex: `col_${idx}`,
      key: col,
      ellipsis: true,
      width: 180,
      render: (val: any) => (
        <Tooltip title={val === null ? 'NULL' : String(val)}>
          <Text
            style={{
              color: val === null ? '#f59e0b' : '#cbd5e1',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            {val === null ? 'NULL' : String(val)}
          </Text>
        </Tooltip>
      ),
    }))
  }

  const buildDataSource = () => {
    if (!result || result.rows.length === 0) return []
    return result.rows.map((row, idx) => {
      const record: Record<string, any> = { key: idx }
      row.forEach((val, colIdx) => { record[`col_${colIdx}`] = val })
      return record
    })
  }

  const selectedConfig = dbConfigs.find((c) => c.id === selectedDbId)

  return (
    <div>
      <Title level={4} style={{ color: '#f1f5f9', marginBottom: 20 }}>
        <DatabaseOutlined style={{ marginRight: 8 }} />
        数据库查询
      </Title>

      {/* 数据库选择 + SQL 编辑 */}
      <Card
        size="small"
        style={{ background: '#1e293b', borderColor: '#334155', marginBottom: 20 }}
        headStyle={{ color: '#e2e8f0', borderColor: '#334155', fontSize: 14 }}
        title="SQL 查询"
        extra={
          <Space>
            <Button
              size="small" icon={<ReloadOutlined />}
              onClick={loadDbConfigs}
            >
              刷新配置
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {/* 选择目标数据库 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: '#cbd5e1', whiteSpace: 'nowrap', fontSize: 13 }}>目标数据库：</Text>
            <Select
              placeholder="选择已保存的数据库配置"
              style={{ width: 360 }}
              value={selectedDbId}
              onChange={(val) => setSelectedDbId(val)}
              loading={loadingConfigs}
              notFoundContent={
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: '#94a3b8' }}>暂无配置，请先在配置中心新建</span>}
                />
              }
              dropdownStyle={{ background: '#1e293b' }}
            >
              {dbConfigs.map((c) => (
                <Option key={c.id} value={c.id}>
                  <Space>
                    <Tag color={DB_COLORS[c.db_type] || '#666'} style={{ margin: 0 }}>
                      {c.db_type.toUpperCase()}
                    </Tag>
                    <Text style={{ color: '#e2e8f0' }}>{c.name}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 11 }}>
                      {c.host}:{c.port}/{c.database_name}
                    </Text>
                  </Space>
                </Option>
              ))}
            </Select>
            {selectedConfig && (
              <Tag color={DB_COLORS[selectedConfig.db_type]}>
                {selectedConfig.host}:{selectedConfig.port}/{selectedConfig.database_name}
              </Tag>
            )}
          </div>

          {/* SQL 输入 */}
          <TextArea
            rows={8}
            placeholder={`输入 SQL 语句，例如：\nSELECT * FROM users LIMIT 10;\n\n支持 SELECT / INSERT / UPDATE / DELETE 等语句`}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            style={{
              background: '#0f172a',
              borderColor: '#334155',
              color: '#e2e8f0',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: 13,
            }}
          />

          {/* 操作按钮 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleExecute}
                loading={executing}
                disabled={!selectedDbId || !sql.trim()}
              >
                执行
              </Button>
              <Button
                icon={<ClearOutlined />}
                onClick={() => { setSql(''); setResult(null) }}
                disabled={!sql && !result}
              >
                清空
              </Button>
            </Space>
            {selectedConfig && (
              <Text style={{ color: '#64748b', fontSize: 12 }}>
                快捷键提示：Ctrl+Enter 执行
              </Text>
            )}
          </div>
        </Space>
      </Card>

      {/* 查询结果 */}
      {executing ? (
        <Card style={{ background: '#1e293b', borderColor: '#334155', textAlign: 'center', padding: 40 }}>
          <Spin tip={<span style={{ color: '#94a3b8' }}>执行中...</span>} />
        </Card>
      ) : result ? (
        <Card
          size="small"
          style={{ background: '#1e293b', borderColor: '#334155' }}
          headStyle={{ color: '#e2e8f0', borderColor: '#334155', fontSize: 14 }}
          title="查询结果"
          extra={
            <Space>
              {result.elapsed_ms > 0 && (
                <Tag color="default">{result.elapsed_ms}ms</Tag>
              )}
              {result.row_count > 0 && (
                <Tag color="blue">{result.row_count} 行</Tag>
              )}
              {result.affected_rows !== null && (
                <Tag color="green">影响 {result.affected_rows} 行</Tag>
              )}
            </Space>
          }
        >
          {result.rows.length > 0 ? (
            <Table
              columns={buildColumns()}
              dataSource={buildDataSource()}
              size="small"
              scroll={{ x: 'max-content', y: 400 }}
              pagination={result.row_count > 100 ? { pageSize: 100, showSizeChanger: false } : false}
              style={{ background: 'transparent' }}
              locale={{
                emptyText: <Empty description={<span style={{ color: '#94a3b8' }}>无数据</span>} />,
              }}
            />
          ) : (
            <Empty
              description={
                <Text style={{ color: '#94a3b8' }}>
                  {result.message || (result.affected_rows !== null ? `影响 ${result.affected_rows} 行` : '无返回结果')}
                </Text>
              }
              style={{ padding: 30 }}
            />
          )}
        </Card>
      ) : null}
    </div>
  )
}
