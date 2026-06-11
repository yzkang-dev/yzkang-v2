import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Spin, Typography, Modal,
  Form, Input, Select, DatePicker, InputNumber, Row, Col, Divider, Space,
  Tabs, Table, Empty, Badge, message
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, LogoutOutlined, ExclamationCircleOutlined,
  HeartOutlined, MedicineBoxOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';
import useApi from '../hooks/useApi';
import HealthTrendChart from '../components/HealthTrendChart';

const { Title } = Typography;
const { TextArea } = Input;

const statusColors = { checked_in: 'green', checked_out: 'default', leave_temp: 'orange' };
const statusLabels = { checked_in: '在住', checked_out: '已退住', leave_temp: '临时外出' };
const careLevelLabels = { basic: '基础护理', level_1: '一级护理', level_2: '二级护理', level_3: '三级护理', special: '特级护理' };

const careLevelOptions = [
  { label: '基础护理', value: 'basic' },
  { label: '一级护理', value: 'level_1' },
  { label: '二级护理', value: 'level_2' },
  { label: '三级护理', value: 'level_3' },
  { label: '特级护理', value: 'special' },
];

export default function ElderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 健康Tab数据（懒加载）
  const [vitalSigns, setVitalSigns] = useState([]);
  const [medications, setMedications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [careRecords, setCareRecords] = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthLoaded, setHealthLoaded] = useState(false);

  const { data: elder, loading, refetch } = useApi(
    () => api.get(`/elders/${id}`),
    { defaultData: null, deps: [id] }
  );

  const fetchHealthData = async () => {
    if (healthLoaded) return;
    setHealthLoading(true);
    try {
      const [vsRes, medRes, alertRes, careRes] = await Promise.all([
        api.get('/vital-signs/', { params: { elder_id: id, limit: 20 } }),
        api.get('/medications/', { params: { elder_id: id } }),
        api.get('/alerts/', { params: { status: 'unresolved' } }),
        api.get('/care-records/', { params: { elder_id: id, limit: 10 } }),
      ]);
      setVitalSigns(vsRes.data);
      setMedications(medRes.data.filter(m => m.is_active));
      setAlerts(alertRes.data.filter(a => a.elder_id === parseInt(id)));
      setCareRecords(careRes.data);
      setHealthLoaded(true);
    } catch {
      // 部分API可能404，忽略
    }
    setHealthLoading(false);
  };

  const handleEdit = () => {
    form.setFieldsValue({
      ...elder,
      birth_date: elder.birth_date ? dayjs(elder.birth_date) : undefined,
    });
    setEditOpen(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = { ...values };
      if (values.birth_date) payload.birth_date = values.birth_date.format('YYYY-MM-DD');
      await api.put(`/elders/${id}`, payload);
      message.success('信息已更新');
      setEditOpen(false);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = () => {
    Modal.confirm({
      title: '确认退住',
      icon: <ExclamationCircleOutlined />,
      content: `确定要为「${elder.name}」办理退住吗？`,
      okText: '确认退住',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.post(`/elders/${id}/checkout`);
          message.success('退住成功');
          refetch();
        } catch {
          // 错误提示由 api.js 统一处理
        }
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!elder) return <div>未找到该老人信息</div>;

  const isCheckedIn = elder.status === 'checked_in';

  // 体征表格列
  const vsColumns = [
    { title: '时间', dataIndex: 'record_time', width: 150, render: t => dayjs(t).format('MM-DD HH:mm') },
    {
      title: '血压', width: 110,
      render: (_, r) => r.blood_pressure_systolic ? `${r.blood_pressure_systolic}/${r.blood_pressure_diastolic || '-'}` : '-',
    },
    { title: '心率', dataIndex: 'heart_rate', width: 70, render: v => v ? `${v}` : '-' },
    { title: '血糖', dataIndex: 'blood_sugar', width: 70, render: v => v ? `${v}` : '-' },
    { title: '体温', dataIndex: 'temperature', width: 70, render: v => v ? `${v}` : '-' },
    { title: '血氧', dataIndex: 'oxygen_saturation', width: 70, render: v => v ? `${v}%` : '-' },
    { title: '状态', dataIndex: 'is_abnormal', width: 70, render: v => v ? <Tag color="red">异常</Tag> : <Tag color="green">正常</Tag> },
  ];

  // 用药表格列
  const medColumns = [
    { title: '药品', dataIndex: 'drug_name' },
    { title: '剂量', dataIndex: 'dosage', width: 80 },
    { title: '频率', dataIndex: 'frequency', width: 100 },
    { title: '开始日期', dataIndex: 'start_date', width: 110 },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
  ];

  // 护理表格列
  const careColumns = [
    { title: '时间', dataIndex: 'record_time', width: 150, render: t => dayjs(t).format('MM-DD HH:mm') },
    { title: '类型', dataIndex: 'care_type', width: 100 },
    { title: '详情', dataIndex: 'description', ellipsis: true },
    { title: '异常', dataIndex: 'is_abnormal', width: 70, render: v => v ? <Tag color="red">是</Tag> : '-' },
  ];

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="middle">
          <Descriptions.Item label="姓名">{elder.name}</Descriptions.Item>
          <Descriptions.Item label="性别">{elder.gender === 'male' ? '男' : '女'}</Descriptions.Item>
          <Descriptions.Item label="年龄">{dayjs().diff(dayjs(elder.birth_date), 'year')}岁</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[elder.status]}>{statusLabels[elder.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="身份证号">{elder.id_card || '-'}</Descriptions.Item>
          <Descriptions.Item label="电话">{elder.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="房间">{elder.room_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="床位">{elder.bed_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="护理等级">{careLevelLabels[elder.care_level] || elder.care_level}</Descriptions.Item>
          <Descriptions.Item label="月费">¥{elder.monthly_fee}</Descriptions.Item>
          <Descriptions.Item label="入住日期">{elder.check_in_date}</Descriptions.Item>
          <Descriptions.Item label="退住日期">{elder.check_out_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="紧急联系人">{elder.emergency_contact || '-'}</Descriptions.Item>
          <Descriptions.Item label="紧急电话">{elder.emergency_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="既往病史" span={2}>{elder.medical_history || '-'}</Descriptions.Item>
          <Descriptions.Item label="过敏史" span={2}>{elder.allergies || '-'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{elder.notes || '-'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'health',
      label: (
        <span>
          <HeartOutlined /> 健康档案
          {alerts.length > 0 && <Badge count={alerts.length} size="small" style={{ marginLeft: 8 }} />}
        </span>
      ),
      children: (
        <div>
          {alerts.length > 0 && (
            <Card size="small" style={{ marginBottom: 16, borderColor: '#ff4d4f', background: '#fff2f0' }}>
              <Space>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                <span style={{ color: '#ff4d4f', fontWeight: 600 }}>该老人有 {alerts.length} 条未处理的告警</span>
              </Space>
              <div style={{ marginTop: 8 }}>
                {alerts.slice(0, 3).map(a => (
                  <div key={a.id} style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                    · {a.message}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <HealthTrendChart elderId={parseInt(id)} />

          <Divider />

          <Card size="small" title="最近体征记录" style={{ marginTop: 16 }}>
            {vitalSigns.length === 0 ? (
              <Empty description="暂无体征记录" />
            ) : (
              <Table columns={vsColumns} dataSource={vitalSigns} rowKey="id" size="small" pagination={false} />
            )}
          </Card>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card size="small" title={<span><MedicineBoxOutlined /> 当前用药</span>}>
                {medications.length === 0 ? (
                  <Empty description="无用药记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Table columns={medColumns} dataSource={medications} rowKey="id" size="small" pagination={false} />
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title={<span><HeartOutlined /> 最近护理</span>}>
                {careRecords.length === 0 ? (
                  <Empty description="无护理记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Table columns={careColumns} dataSource={careRecords} rowKey="id" size="small" pagination={false} />
                )}
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/elders')}>返回列表</Button>
        <Space>
          <Button icon={<EditOutlined />} onClick={handleEdit}>编辑信息</Button>
          {isCheckedIn && (
            <Button icon={<LogoutOutlined />} danger onClick={handleCheckout}>办理退住</Button>
          )}
        </Space>
      </div>
      <Title level={3}>{elder.name} - 详细信息</Title>

      <Card>
        <Tabs
          items={tabItems}
          onChange={(key) => {
            if (key === 'health') fetchHealthData();
          }}
        />
      </Card>

      <Modal
        title="编辑老人信息"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="保存"
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="name" label="姓名">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="phone" label="电话">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="care_level" label="护理等级">
                <Select options={careLevelOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="room_number" label="房间号">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bed_number" label="床位号">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="monthly_fee" label="月费">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="emergency_contact" label="紧急联系人">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="emergency_phone" label="紧急电话">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="medical_history" label="既往病史">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="allergies" label="过敏史">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
