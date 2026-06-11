import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, Card, Tabs, Badge, message, Descriptions } from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FileProtectOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import api from '../api';
import useApi from '../hooks/useApi';
import dayjs from 'dayjs';

const TYPE_LABELS = {
  checkin: '老人入住',
  medication_change: '用药调整',
  leave: '请假外出',
  fee_adjust: '费用减免',
};

const TYPE_COLORS = {
  checkin: 'blue',
  medication_change: 'orange',
  leave: 'purple',
  fee_adjust: 'green',
};

const STATUS_LABELS = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
};

const STATUS_COLORS = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
};

export default function Approvals() {
  const [activeTab, setActiveTab] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [users, setUsers] = useState([]);
  const [form] = Form.useForm();

  // 审批列表（根据 tab 切换 URL）
  const { data: approvals, loading, refetch } = useApi(
    () => {
      let url = '/approvals/';
      if (activeTab === 'pending') url = '/approvals/pending';
      else if (activeTab === 'my') url = '/approvals/my';
      return api.get(url);
    },
    { defaultData: [], deps: [activeTab] }
  );

  // 统计
  const { data: stats } = useApi(
    () => api.get('/approvals/stats/summary'),
    { defaultData: { total_pending: 0, my_pending: 0, today_approved: 0 }, deps: [activeTab] }
  );

  // 用户列表（懒加载）
  const [usersLoaded, setUsersLoaded] = useState(false);
  if (!usersLoaded) {
    api.get('/users/').then(res => { setUsers(res.data); setUsersLoaded(true); });
  }

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/approvals/', values);
      message.success('审批已提交');
      setCreateOpen(false);
      form.resetFields();
      refetch();
    } catch {
      // 表单校验或 API 错误由 api.js 处理
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/approvals/${id}/handle`, { action: 'approve' });
      message.success('已通过');
      refetch();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/approvals/${id}/handle`, { action: 'reject' });
      message.success('已驳回');
      refetch();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const showDetail = async (id) => {
    try {
      const res = await api.get(`/approvals/${id}`);
      setDetailData(res.data);
      setDetailOpen(true);
    } catch (e) {}
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (v) => <Tag color={TYPE_COLORS[v]}>{TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v) => <Badge status={STATUS_COLORS[v] || 'default'} text={STATUS_LABELS[v] || v} />,
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      width: 100,
    },
    {
      title: '审批人',
      dataIndex: 'approver_name',
      width: 100,
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      width: 160,
      render: (t) => dayjs(t).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 200,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" onClick={() => showDetail(r.id)}>详情</Button>
          {r.status === 'pending' && (
            <>
              <Button type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => handleApprove(r.id)}>
                通过
              </Button>
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleReject(r.id)}>
                驳回
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'all',
      label: '全部',
      children: <Table columns={columns} dataSource={approvals} rowKey="id" loading={loading} size="small" />,
    },
    {
      key: 'pending',
      label: (
        <Badge count={stats.my_pending} size="small" offset={[6, 0]}>
          <ClockCircleOutlined /> 待审批
        </Badge>
      ),
      children: <Table columns={columns} dataSource={approvals} rowKey="id" loading={loading} size="small" />,
    },
    {
      key: 'my',
      label: '我发起的',
      children: <Table columns={columns} dataSource={approvals} rowKey="id" loading={loading} size="small" />,
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <FileProtectOutlined />
            审批管理
            <Tag>进行中: {stats.total_pending}</Tag>
            <Tag color="green">今日通过: {stats.today_approved}</Tag>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            发起审批
          </Button>
        }
      >
        <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} />
      </Card>

      {/* 发起审批弹窗 */}
      <Modal
        title="发起审批"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="type" label="审批类型" rules={[{ required: true }]}>
            <Select
              placeholder="选择审批类型"
              options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ label: v, value: k }))}
            />
          </Form.Item>
          <Form.Item name="title" label="审批标题" rules={[{ required: true }]}>
            <Input placeholder="如：张大爷入住申请" />
          </Form.Item>
          <Form.Item name="approver_id" label="审批人" rules={[{ required: true }]}>
            <Select
              placeholder="选择审批人"
              options={users.map((u) => ({ label: u.real_name, value: u.id }))}
            />
          </Form.Item>
          <Form.Item name="content" label="详细说明">
            <Input.TextArea rows={3} placeholder="可选：补充说明信息" />
          </Form.Item>
          <Form.Item name="elder_id" label="关联老人">
            <Input placeholder="可选：老人ID" type="number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 审批详情弹窗 */}
      <Modal
        title="审批详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          detailData?.status === 'pending' ? (
            <Space>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => { handleReject(detailData.id); setDetailOpen(false); }}>
                驳回
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => { handleApprove(detailData.id); setDetailOpen(false); }}>
                通过
              </Button>
            </Space>
          ) : null
        }
        width={560}
      >
        {detailData && (
          <Descriptions column={2} size="small" bordered style={{ marginTop: 8 }}>
            <Descriptions.Item label="标题" span={2}>{detailData.title}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={TYPE_COLORS[detailData.type]}>{TYPE_LABELS[detailData.type] || detailData.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge status={STATUS_COLORS[detailData.status]} text={STATUS_LABELS[detailData.status]} />
            </Descriptions.Item>
            <Descriptions.Item label="申请人">{detailData.applicant_name}</Descriptions.Item>
            <Descriptions.Item label="审批人">{detailData.approver_name}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="处理时间">{detailData.handled_at ? dayjs(detailData.handled_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            {detailData.content && (
              <Descriptions.Item label="详细说明" span={2}>{detailData.content}</Descriptions.Item>
            )}
            {detailData.comment && (
              <Descriptions.Item label="审批意见" span={2}>{detailData.comment}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
