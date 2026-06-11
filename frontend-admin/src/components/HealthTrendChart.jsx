import React, { useState, useEffect } from 'react';
import { Card, Select, Space, Spin, Empty } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api';

const COLORS = {
  blood_pressure_systolic: '#ff4d4f',
  blood_pressure_diastolic: '#ff7a45',
  heart_rate: '#1677ff',
  blood_sugar: '#fa8c16',
  temperature: '#eb2f96',
  oxygen_saturation: '#52c41a',
};

const LABELS = {
  blood_pressure_systolic: '收缩压',
  blood_pressure_diastolic: '舒张压',
  heart_rate: '心率',
  blood_sugar: '血糖',
  temperature: '体温',
  oxygen_saturation: '血氧',
};

const UNITS = {
  blood_pressure_systolic: 'mmHg',
  blood_pressure_diastolic: 'mmHg',
  heart_rate: 'bpm',
  blood_sugar: 'mmol/L',
  temperature: '℃',
  oxygen_saturation: '%',
};

const INDICATORS = Object.keys(LABELS).map((k) => ({ label: LABELS[k], value: k }));

export default function HealthTrendChart({ elderId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [selectedIndicators, setSelectedIndicators] = useState([
    'blood_pressure_systolic',
    'blood_pressure_diastolic',
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/vital-signs/trend/${elderId}`, { params: { days } });
      setData(res.data);
    } catch (e) {
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [elderId, days]);

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (data.length === 0) return <Empty description="暂无体征数据" />;

  return (
    <Card
      size="small"
      title="健康趋势"
      extra={
        <Space>
          <Select
            mode="multiple"
            value={selectedIndicators}
            onChange={setSelectedIndicators}
            style={{ minWidth: 200 }}
            maxTagCount={2}
            options={INDICATORS}
            placeholder="选择指标"
          />
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 100 }}
            options={[
              { label: '近7天', value: 7 },
              { label: '近14天', value: 14 },
              { label: '近30天', value: 30 },
            ]}
          />
        </Space>
      }
    >
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="record_date" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Legend />
          {selectedIndicators.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={LABELS[key]}
              stroke={COLORS[key]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
