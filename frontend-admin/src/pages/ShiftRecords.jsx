import React, { useState } from 'react';
import {
  Table, Typography, Tag, DatePicker, Select, Space, Button,
  Modal, Form, Input, message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';
import useApi from '../hooks/useApi';

const { Title } = Typography;
const { TextArea } = Input;

const shiftLabels = { morning: '白班', night: '夜班' };
const shiftColors = { morning: 'blue', night: 'purple' };

export default function ShiftRecords() {
  const [nurses, setNurses] = useState([]);
  const [shiftDate, setShiftDate] = useState(dayjs());
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const { data, loading, refetch } = useApi(
    () => api.get('/shifts/', { params: { shift_date: shiftDate.format('YYYY-MM-DD'), page_size: 100 } }),
    { defaultData: [], deps: [shiftDate] }
  );

  // 护工列表（懒加载一次）
  const [nursesLoaded, setNursesLoaded] = useState(false);
  if (!nursesLoaded) {
    api.get('/auth/nurses').then((res) => { setNurses(res.data); setNursesLoaded(true); });
  }

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({ shift_type: 'morning' });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      await api.post('/shifts/', values);
      message.success('交接班记录已提交');
      setModalOpen(false);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: '日期', dataIndex: 'shift_date', key: 'date', width: 110 },
    {
      title: '班次', dataIndex: 'shift_type', key: 'type', width: 80,
      render: (v) => <Tag color={shiftColors[v]}>{shiftLabels[v]}</Tag>,
    },
    { title: '交班人ID', dataIndex: 'from_nurse_id', key: 'from', width: 90 },
    { title: '接班人ID', dataIndex: 'to_nurse_id', key: 'to', width: 90 },
    { title: '交班概要', dataIndex: 'summary', key: 'summary', ellipsis: true },
    { title: '特殊事项', dataIndex: 'special_notes', key: 'notes', ellipsis: true,
      render: (v) => v ? <span style={{ color: '#ff4d4f' }}>{v}</span> : '-',
    },
  ];

  return (
    <div>
      <Title level={3}>交接班记录</Title>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker value={shiftDate} onChange={setShiftDate} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          填写交班记录
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
        title="填写交接班记录"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="提交"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="shift_type" label="班次"
            rules={[{ required: true, message: '请选择班次' }]}
          >
            <Select options={[
              { label: '白班', value: 'morning' },
              { label: '夜班', value: 'night' },
            ]} />
          </Form.Item>
          <Form.Item
            name="to_nurse_id" label="接班人"
            rules={[{ required: true, message: '请选择接班人' }]}
          >
            <Select
              showSearch
              placeholder="选择接班人"
              optionFilterProp="label"
              options={nurses.map((n) => ({
                label: `${n.real_name} (${n.role === 'admin' ? '管理员' : '护理员'})`,
                value: n.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="summary" label="交班概要">
            <TextArea rows={3} placeholder="本班次工作情况概述..." />
          </Form.Item>
          <Form.Item name="special_notes" label="特殊注意事项">
            <TextArea rows={2} placeholder="需要接班人特别注意的事项..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
