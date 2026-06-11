import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Select, Tag, Space, Typography } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';
import useApi from '../hooks/useApi';

const { Title } = Typography;

const statusColors = {
  checked_in: 'green',
  checked_out: 'default',
  leave_temp: 'orange',
};
const statusLabels = {
  checked_in: '在住',
  checked_out: '已退住',
  leave_temp: '临时外出',
};

export default function ElderList() {
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState(''); // 确认后才更新
  const [status, setStatus] = useState(undefined);
  const navigate = useNavigate();

  const { data, loading } = useApi(
    () => api.get('/elders/', { params: { keyword: searchKeyword, status, page_size: 100 } }),
    { defaultData: [], deps: [status, searchKeyword] }
  );

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 80 },
    {
      title: '性别', dataIndex: 'gender', key: 'gender', width: 60,
      render: (v) => v === 'male' ? '男' : '女',
    },
    { title: '年龄', key: 'age', width: 60,
      render: (_, r) => dayjs().diff(dayjs(r.birth_date), 'year'),
    },
    { title: '房间', dataIndex: 'room_number', key: 'room', width: 80 },
    { title: '护理等级', dataIndex: 'care_level', key: 'care_level', width: 100 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    { title: '月费', dataIndex: 'monthly_fee', key: 'fee', width: 80,
      render: (v) => `¥${v}`,
    },
    { title: '入住日期', dataIndex: 'check_in_date', key: 'date', width: 110 },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, r) => (
        <Button type="link" onClick={() => navigate(`/elders/${r.id}`)}>详情</Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>老人管理</Title>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索姓名"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => setSearchKeyword(keyword)}
          style={{ width: 200 }}
        />
        <Select
          placeholder="筛选状态"
          allowClear
          style={{ width: 120 }}
          value={status}
          onChange={setStatus}
          options={[
            { label: '在住', value: 'checked_in' },
            { label: '已退住', value: 'checked_out' },
          ]}
        />
        <Button type="primary" onClick={() => setSearchKeyword(keyword)}>查询</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/elders/new')}>
          登记入住
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 800 }}
      />
    </div>
  );
}
