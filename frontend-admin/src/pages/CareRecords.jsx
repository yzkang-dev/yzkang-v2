import React, { useState } from 'react';
import {
  Table, Typography, Tag, DatePicker, Select, Space,
  Button, Modal, Form, Input, Switch, message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';
import useApi from '../hooks/useApi';
import { useElders } from '../context/EldersContext';

const { Title } = Typography;
const { TextArea } = Input;

const careTypes = [
  '喂药', '翻身', '测血压', '测血糖', '测体温',
  '洗澡', '康复训练', '心理疏导', '陪同散步', '其他',
];

export default function CareRecords() {
  const [date, setDate] = useState(dayjs());
  const [abnormalOnly, setAbnormalOnly] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const { filterElders } = useElders();
  const elders = filterElders({ status: 'checked_in' });

  const { data, loading, refetch } = useApi(
    () => api.get('/care-records/', {
      params: { record_date: date.format('YYYY-MM-DD'), is_abnormal: abnormalOnly, page_size: 100 },
    }),
    { defaultData: [], deps: [date, abnormalOnly] }
  );

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({ is_abnormal: false });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      await api.post('/care-records/', values);
      message.success('护理记录已添加');
      setModalOpen(false);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: '时间', dataIndex: 'record_time', key: 'time', width: 100,
      render: (v) => dayjs(v).format('HH:mm'),
    },
    { title: '老人ID', dataIndex: 'elder_id', key: 'elder', width: 80 },
    { title: '护理类型', dataIndex: 'care_type', key: 'type', width: 120 },
    { title: '描述', dataIndex: 'description', key: 'desc' },
    {
      title: '状态', dataIndex: 'is_abnormal', key: 'abnormal', width: 80,
      render: (v) => v
        ? <Tag color="red">异常</Tag>
        : <Tag color="green">正常</Tag>,
    },
    { title: '异常说明', dataIndex: 'abnormal_detail', key: 'detail', width: 200 },
  ];

  return (
    <div>
      <Title level={3}>护理记录</Title>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker value={date} onChange={setDate} />
        <Select
          placeholder="全部状态"
          allowClear
          style={{ width: 120 }}
          value={abnormalOnly}
          onChange={setAbnormalOnly}
          options={[
            { label: '仅看异常', value: true },
            { label: '仅看正常', value: false },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增护理记录
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 700 }}
      />

      <Modal
        title="新增护理记录"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="提交"
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
            name="care_type" label="护理类型"
            rules={[{ required: true, message: '请选择护理类型' }]}
          >
            <Select options={careTypes.map((t) => ({ label: t, value: t }))} />
          </Form.Item>
          <Form.Item name="description" label="护理详情">
            <TextArea rows={3} placeholder="记录护理过程..." />
          </Form.Item>
          <Form.Item name="is_abnormal" label="标记异常" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="abnormal_detail" label="异常说明">
            <TextArea rows={2} placeholder="如有异常请详细说明..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
