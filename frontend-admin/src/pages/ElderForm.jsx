import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Select, DatePicker, InputNumber,
  Button, message, Typography, Row, Col, Divider,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Title } = Typography;
const { TextArea } = Input;

const careLevelOptions = [
  { label: '基础护理', value: 'basic' },
  { label: '一级护理', value: 'level_1' },
  { label: '二级护理', value: 'level_2' },
  { label: '三级护理', value: 'level_3' },
  { label: '特级护理', value: 'special' },
];

export default function ElderForm() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        birth_date: values.birth_date.format('YYYY-MM-DD'),
        check_in_date: values.check_in_date.format('YYYY-MM-DD'),
      };
      await api.post('/elders/', payload);
      message.success('登记入住成功！');
      navigate('/elders');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/elders')}>
          返回列表
        </Button>
      </div>
      <Title level={3}>登记入住</Title>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            gender: 'male',
            care_level: 'basic',
            monthly_fee: 3000,
            check_in_date: dayjs(),
          }}
          size="large"
        >
          <Title level={5} style={{ marginBottom: 16 }}>基本信息</Title>
          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="请输入老人姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="gender" label="性别" rules={[{ required: true }]}>
                <Select options={[
                  { label: '男', value: 'male' },
                  { label: '女', value: 'female' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="birth_date" label="出生日期" rules={[{ required: true, message: '请选择出生日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="id_card" label="身份证号">
                <Input placeholder="18位身份证号" maxLength={18} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="phone" label="联系电话">
                <Input placeholder="老人手机号" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="address" label="家庭住址">
                <Input placeholder="户籍或常住地址" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Title level={5} style={{ marginBottom: 16 }}>入住信息</Title>
          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="check_in_date" label="入住日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="room_number" label="房间号">
                <Input placeholder="如 301" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="bed_number" label="床位号">
                <Input placeholder="如 A" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="care_level" label="护理等级" rules={[{ required: true }]}>
                <Select options={careLevelOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="monthly_fee" label="月费（元）" rules={[{ required: true }]}>
                <InputNumber min={0} step={100} style={{ width: '100%' }} placeholder="3000" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Title level={5} style={{ marginBottom: 16 }}>紧急联系人</Title>
          <Row gutter={24}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="emergency_contact" label="联系人姓名">
                <Input placeholder="紧急联系人" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="emergency_phone" label="联系人电话">
                <Input placeholder="紧急联系电话" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Title level={5} style={{ marginBottom: 16 }}>健康信息</Title>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="medical_history" label="既往病史">
                <TextArea rows={3} placeholder="如：高血压、糖尿病、冠心病等" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="allergies" label="过敏史">
                <TextArea rows={3} placeholder="如：青霉素过敏、花粉过敏等" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24}>
              <Form.Item name="notes" label="备注">
                <TextArea rows={2} placeholder="其他需要说明的事项" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
              size="large"
            >
              确认登记
            </Button>
            <Button style={{ marginLeft: 16 }} onClick={() => navigate('/elders')} size="large">
              取消
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
