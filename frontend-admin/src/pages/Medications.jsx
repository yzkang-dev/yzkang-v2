import React, { useState } from 'react';
import {
  Table, Typography, Tag, Select, Space, Button, Modal,
  Form, Input, DatePicker, message,
} from 'antd';
import { PlusOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';
import useApi from '../hooks/useApi';
import { useElders } from '../context/EldersContext';

const { Title } = Typography;
const { TextArea } = Input;

export default function Medications() {
  const [elderFilter, setElderFilter] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const { filterElders } = useElders();
  const elders = filterElders({ status: 'checked_in' });

  const { data, loading, refetch } = useApi(
    () => {
      const params = { page_size: 100 };
      if (elderFilter) params.elder_id = elderFilter;
      return api.get('/medications/', { params });
    },
    { defaultData: [], deps: [elderFilter] }
  );

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({ start_date: dayjs() });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = { ...values, start_date: values.start_date.format('YYYY-MM-DD') };
      if (values.end_date) payload.end_date = values.end_date.format('YYYY-MM-DD');
      await api.post('/medications/', payload);
      message.success('用药已添加');
      setModalOpen(false);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (record) => {
    try {
      await api.post(`/medications/${record.id}/toggle`);
      message.success(record.is_active ? '已停用' : '已启用');
      refetch();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const columns = [
    { title: '老人ID', dataIndex: 'elder_id', key: 'elder', width: 80 },
    { title: '药品名称', dataIndex: 'drug_name', key: 'drug', width: 150 },
    { title: '剂量', dataIndex: 'dosage', key: 'dosage', width: 80 },
    { title: '频率', dataIndex: 'frequency', key: 'freq', width: 100 },
    { title: '开始日期', dataIndex: 'start_date', key: 'start', width: 110 },
    { title: '结束日期', dataIndex: 'end_date', key: 'end', width: 110,
      render: (v) => v || '-',
    },
    {
      title: '状态', dataIndex: 'is_active', key: 'status', width: 80,
      render: (v) => v
        ? <Tag color="green">使用中</Tag>
        : <Tag color="default">已停用</Tag>,
    },
    { title: '备注', dataIndex: 'notes', key: 'notes', ellipsis: true },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, r) => (
        <Button
          type="link"
          danger={r.is_active}
          icon={r.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
          onClick={() => handleToggle(r)}
        >
          {r.is_active ? '停用' : '启用'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>用药管理</Title>
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="筛选老人"
          allowClear
          showSearch
          style={{ width: 200 }}
          value={elderFilter}
          onChange={setElderFilter}
          optionFilterProp="label"
          options={elders.map((e) => ({
            label: `${e.name} (${e.room_number || '未分配'}房)`,
            value: e.id,
          }))}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加用药
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 900 }}
      />

      <Modal
        title="添加用药"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="添加"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="elder_id" label="选择老人"
            rules={[{ required: true, message: '请选择老人' }]}
          >
            <Select
              showSearch
              placeholder="请选择老人"
              optionFilterProp="label"
              options={elders.map((e) => ({
                label: `${e.name} (${e.room_number || '未分配'}房)`,
                value: e.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="drug_name" label="药品名称"
            rules={[{ required: true, message: '请输入药品名称' }]}
          >
            <Input placeholder="如：阿司匹林肠溶片" />
          </Form.Item>
          <Form.Item name="dosage" label="剂量">
            <Input placeholder="如：1片 / 5mg" />
          </Form.Item>
          <Form.Item name="frequency" label="频率">
            <Input placeholder="如：每日3次 / 饭前服用" />
          </Form.Item>
          <Form.Item
            name="start_date" label="开始日期"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_date" label="结束日期（选填）">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={2} placeholder="用药注意事项..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
