import React, { useEffect, useState } from 'react';
import { Table, Input, Select, DatePicker, Card, Tag, Space, Typography } from 'antd';
import { SearchOutlined, AuditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Title } = Typography;
const { RangePicker } = DatePicker;

// 操作类型 → 颜色映射
const actionColorMap = {
  '用户登录': 'blue',
  '用户注册': 'green',
  '创建用户': 'cyan',
  '更新用户': 'orange',
  '删除用户': 'red',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({ username: '', action: '', days: 7 });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', {
        params: {
          username: filters.username || undefined,
          action: filters.action || undefined,
          days: filters.days,
          page,
          page_size: pageSize,
        },
      });
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('获取审计日志失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, filters]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (t) => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作人',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action) => (
        <Tag color={actionColorMap[action] || 'default'}>{action}</Tag>
      ),
    },
    {
      title: '操作对象',
      dataIndex: 'target',
      key: 'target',
      width: 150,
      render: (t) => t || '-',
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (d) => d ? <code style={{ fontSize: 12 }}>{d}</code> : '-',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <AuditOutlined style={{ fontSize: 24, marginRight: 12, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>操作审计日志</Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="操作人"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 160 }}
            value={filters.username}
            onChange={(e) => { setFilters({ ...filters, username: e.target.value }); setPage(1); }}
          />
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 140 }}
            value={filters.action || undefined}
            onChange={(v) => { setFilters({ ...filters, action: v || '' }); setPage(1); }}
          >
            <Select.Option value="用户登录">用户登录</Select.Option>
            <Select.Option value="用户注册">用户注册</Select.Option>
            <Select.Option value="创建用户">创建用户</Select.Option>
            <Select.Option value="更新用户">更新用户</Select.Option>
            <Select.Option value="删除用户">删除用户</Select.Option>
          </Select>
          <Select
            style={{ width: 140 }}
            value={filters.days}
            onChange={(v) => { setFilters({ ...filters, days: v }); setPage(1); }}
          >
            <Select.Option value={1}>最近1天</Select.Option>
            <Select.Option value={3}>最近3天</Select.Option>
            <Select.Option value={7}>最近7天</Select.Option>
            <Select.Option value={30}>最近30天</Select.Option>
          </Select>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `共 ${t} 条记录`,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          size="middle"
        />
      </Card>
    </div>
  );
}
