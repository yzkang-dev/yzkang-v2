import React from 'react';
import { Row, Col, Card, Spin, Typography, Statistic, Badge } from 'antd';
import {
  TeamOutlined,
  RiseOutlined,
  DollarOutlined,
  WarningOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  ExclamationCircleOutlined,
  PieChartOutlined,
  BellOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import api from '../api';
import useApi from '../hooks/useApi';

const { Title } = Typography;

export default function Dashboard() {
  const { data, loading } = useApi(() => api.get('/dashboard/'), { defaultData: null });
  const { data: alertCount } = useApi(() => api.get('/alerts/count'), {
    defaultData: { unread: 0, unresolved: 0 },
  });

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!data) return <div>加载失败</div>;

  const cards = [
    { title: '在住老人', value: data.total_elders, icon: <TeamOutlined />, suffix: '人', color: '#1677ff' },
    { title: '今日入住', value: data.checked_in_today, icon: <UserAddOutlined />, suffix: '人', color: '#52c41a' },
    { title: '今日退住', value: data.checked_out_today, icon: <UserDeleteOutlined />, suffix: '人', color: '#8c8c8c' },
    { title: '入住率', value: data.occupancy_rate, icon: <PieChartOutlined />, suffix: '%', color: '#1677ff' },
    { title: '本月营收', value: data.monthly_revenue.toLocaleString(), icon: <DollarOutlined />, prefix: '¥', color: '#52c41a' },
    { title: '未缴账单', value: data.unpaid_bills, icon: <RiseOutlined />, suffix: '笔', color: data.unpaid_bills > 0 ? '#fa8c16' : '#8c8c8c' },
    { title: '逾期账单', value: data.overdue_bills, icon: <WarningOutlined />, suffix: '笔', color: data.overdue_bills > 0 ? '#ff4d4f' : '#8c8c8c' },
    { title: '今日异常', value: data.abnormal_today, icon: <ExclamationCircleOutlined />, suffix: '条', color: data.abnormal_today > 0 ? '#ff4d4f' : '#8c8c8c' },
    { title: '未处理告警', value: alertCount.unresolved, icon: <AlertOutlined />, suffix: '条', color: alertCount.unresolved > 0 ? '#ff4d4f' : '#52c41a' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>院长看板</Title>
        {alertCount.unresolved > 0 && (
          <Badge count={alertCount.unresolved} overflowCount={99}>
            <BellOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />
          </Badge>
        )}
      </div>
      <Row gutter={[16, 16]}>
        {cards.map((card, i) => (
          <Col xs={12} sm={8} md={8} lg={6} key={i}>
            <Card bordered={false} style={{ background: '#fafafa', borderTop: `3px solid ${card.color}` }}>
              <div style={{ fontSize: 28, color: card.color, marginBottom: 8 }}>{card.icon}</div>
              <Statistic
                value={card.value}
                prefix={card.prefix}
                suffix={card.suffix}
                valueStyle={{ fontSize: 28, fontWeight: 700 }}
              />
              <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 4 }}>{card.title}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
