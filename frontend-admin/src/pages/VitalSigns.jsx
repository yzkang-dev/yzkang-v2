import React, { useState } from 'react';
import { Table, Button, Modal, Form, Select, InputNumber, Input, DatePicker, Space, Tag, Card, message, Popconfirm } from 'antd';
import { PlusOutlined, WarningOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import useApi from '../hooks/useApi';
import { useElders } from '../context/EldersContext';
import dayjs from 'dayjs';

const { TextArea } = Input;

const MEASURE_TYPES = [
  { label: '常规测量', value: 'routine' },
  { label: '空腹血糖', value: 'fasting' },
  { label: '餐后血糖', value: 'postprandial' },
  { label: '紧急测量', value: 'emergency' },
];

export default function VitalSigns() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({ elder_id: undefined });

  const { elders } = useElders();

  const { data: records, loading, refetch } = useApi(
    () => {
      const params = {};
      if (filters.elder_id) params.elder_id = filters.elder_id;
      return api.get('/vital-signs/', { params });
    },
    { defaultData: [], deps: [filters.elder_id] }
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/vital-signs/', values);
      message.success('体征记录已保存');
      setModalOpen(false);
      form.resetFields();
      refetch();
    } catch {
      // 表单校验失败或 API 错误由 api.js 处理
    }
  };

  const bpColor = (sys, dia) => {
    if (!sys && !dia) return 'default';
    if (sys > 140 || dia > 90 || sys < 90 || dia < 60) return 'red';
    return 'green';
  };

  const columns = [
    {
      title: '老人',
      dataIndex: 'elder_id',
      width: 80,
      render: (id) => {
        const elder = elders.find((e) => e.id === id);
        return elder?.name || `#${id}`;
      },
    },
    {
      title: '测量时间',
      dataIndex: 'record_time',
      width: 170,
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => new Date(a.record_time) - new Date(b.record_time),
      defaultSortOrder: 'descend',
    },
    {
      title: '血压 (mmHg)',
      width: 130,
      render: (_, r) => {
        if (!r.blood_pressure_systolic && !r.blood_pressure_diastolic) return '-';
        return (
          <Tag color={bpColor(r.blood_pressure_systolic, r.blood_pressure_diastolic)}>
            {r.blood_pressure_systolic || '-'}/{r.blood_pressure_diastolic || '-'}
          </Tag>
        );
      },
    },
    {
      title: '心率',
      dataIndex: 'heart_rate',
      width: 80,
      render: (v) =>
        v ? (
          <span style={{ color: v > 100 || v < 60 ? '#ff4d4f' : '#52c41a' }}>{v} bpm</span>
        ) : (
          '-'
        ),
    },
    {
      title: '血糖',
      dataIndex: 'blood_sugar',
      width: 90,
      render: (v) =>
        v ? (
          <span style={{ color: v > 7 || v < 3.9 ? '#ff4d4f' : '#52c41a' }}>{v} mmol/L</span>
        ) : (
          '-'
        ),
    },
    {
      title: '体温',
      dataIndex: 'temperature',
      width: 80,
      render: (v) =>
        v ? (
          <span style={{ color: v > 37.3 ? '#ff4d4f' : '#52c41a' }}>{v} ℃</span>
        ) : (
          '-'
        ),
    },
    {
      title: '血氧',
      dataIndex: 'oxygen_saturation',
      width: 80,
      render: (v) =>
        v ? (
          <span style={{ color: v < 95 ? '#ff4d4f' : '#52c41a' }}>{v}%</span>
        ) : (
          '-'
        ),
    },
    {
      title: '体重',
      dataIndex: 'weight',
      width: 80,
      render: (v) => (v ? `${v} kg` : '-'),
    },
    {
      title: '类型',
      dataIndex: 'measurement_type',
      width: 90,
      render: (v) => MEASURE_TYPES.find((t) => t.value === v)?.label || v,
    },
    {
      title: '状态',
      dataIndex: 'is_abnormal',
      width: 70,
      render: (v) =>
        v ? <Tag color="red" icon={<WarningOutlined />}>异常</Tag> : <Tag color="green">正常</Tag>,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      ellipsis: true,
      width: 120,
    },
  ];

  return (
    <div>
      <Card
        title="生命体征记录"
        extra={
          <Space>
            <Select
              placeholder="筛选老人"
              allowClear
              style={{ width: 150 }}
              value={filters.elder_id}
              onChange={(v) => {
                setFilters({ elder_id: v });
                refetch();
              }}
              options={elders.map((e) => ({ label: e.name, value: e.id }))}
            />
            <Button icon={<SearchOutlined />} onClick={refetch}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              录入体征
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title="录入生命体征"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="elder_id" label="选择老人" rules={[{ required: true }]}>
            <Select
              placeholder="请选择"
              options={elders.map((e) => ({ label: `${e.name} - ${e.room_number}房`, value: e.id }))}
            />
          </Form.Item>
          <Form.Item name="measurement_type" label="测量类型" initialValue="routine">
            <Select options={MEASURE_TYPES} />
          </Form.Item>

          <Space size="large" wrap>
            <Form.Item name="blood_pressure_systolic" label="收缩压 (mmHg)">
              <InputNumber min={0} max={300} placeholder="高压" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="blood_pressure_diastolic" label="舒张压 (mmHg)">
              <InputNumber min={0} max={200} placeholder="低压" style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Space size="large" wrap>
            <Form.Item name="heart_rate" label="心率 (bpm)">
              <InputNumber min={0} max={300} placeholder="次/分" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="blood_sugar" label="血糖 (mmol/L)">
              <InputNumber min={0} max={50} step={0.1} placeholder="毫摩尔/升" style={{ width: 140 }} />
            </Form.Item>
          </Space>

          <Space size="large" wrap>
            <Form.Item name="temperature" label="体温 (℃)">
              <InputNumber min={30} max={45} step={0.1} placeholder="摄氏度" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="oxygen_saturation" label="血氧 (%)">
              <InputNumber min={0} max={100} placeholder="百分比" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="weight" label="体重 (kg)">
              <InputNumber min={0} max={300} step={0.1} placeholder="公斤" style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Form.Item name="notes" label="备注">
            <TextArea rows={2} placeholder="其他说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
