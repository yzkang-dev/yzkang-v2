import React, { useState, useRef, useEffect } from 'react';
import {
  Row, Col, Card, Button, Modal, Form, Input, Select, Switch,
  Tag, Space, message, Tooltip, Typography, Badge, Popconfirm, Spin,
} from 'antd';
import {
  VideoCameraOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  FullscreenOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  ReloadOutlined, EyeOutlined, AlertOutlined,
} from '@ant-design/icons';
import api from '../api';
import useApi from '../hooks/useApi';
import { useElders } from '../context/EldersContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = { online: 'green', offline: 'red', maintenance: 'orange' };
const STATUS_LABEL = { online: '在线', offline: '离线', maintenance: '维护中' };
const ALERT_SEVERITY_COLOR = { warning: 'orange', critical: 'red' };

export default function VideoMonitoring() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCam, setEditingCam] = useState(null);
  const [form] = Form.useForm();
  const [viewCam, setViewCam] = useState(null);
  const [previewModal, setPreviewModal] = useState(false);
  const videoRef = useRef(null);
  const [snapshotUrl, setSnapshotUrl] = useState('');

  const { filterElders } = useElders();
  const elders = filterElders({ status: 'checked_in' });

  const { data: cameras, loading, refetch } = useApi(
    () => api.get('/cameras/'),
    { defaultData: [] }
  );

  const { data: alerts, refetch: refetchAlerts } = useApi(
    () => api.get('/cameras/alerts', { params: { handled: false } }),
    { defaultData: [] }
  );

  // 定时刷新告警
  useEffect(() => {
    const timer = setInterval(refetchAlerts, 30000);
    return () => clearInterval(timer);
  }, [refetchAlerts]);

  const handleAdd = () => {
    setEditingCam(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (cam) => {
    setEditingCam(cam);
    form.setFieldsValue({
      name: cam.name, location: cam.location, elder_id: cam.elder_id,
      rtsp_url: cam.rtsp_url, status: cam.status, is_active: cam.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const vals = await form.validateFields();
      if (editingCam) {
        await api.put(`/cameras/${editingCam.id}`, vals);
        message.success('更新成功');
      } else {
        await api.post('/cameras/', vals);
        message.success('添加成功');
      }
      setModalOpen(false);
      refetch();
    } catch {
      // 表单校验或 API 错误由 api.js 处理
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/cameras/${id}`);
      message.success('删除成功');
      refetch();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const handlePreview = async (cam) => {
    setViewCam(cam);
    setPreviewModal(true);
    try {
      const res = await api.get(`/cameras/${cam.id}/snapshot`);
      setSnapshotUrl(res.data.snapshot_url);
    } catch {
      setSnapshotUrl('');
    }
  };

  const handleHandleAlert = async (alertId) => {
    try {
      await api.put(`/cameras/alerts/${alertId}/handle`);
      message.success('已处理');
      refetchAlerts();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  // 模拟视频流：定时刷新截图
  useEffect(() => {
    if (!previewModal || !viewCam) return;
    const timer = setInterval(async () => {
      try {
        const res = await api.get(`/cameras/${viewCam.id}/snapshot`);
        setSnapshotUrl(res.data.snapshot_url + '&t=' + Date.now());
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, [previewModal, viewCam]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <VideoCameraOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          视频监控中心
          {alerts.length > 0 && (
            <Badge count={alerts.length} style={{ marginLeft: 12, backgroundColor: '#ff4d4f' }} />
          )}
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { refetch(); refetchAlerts(); }}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加摄像头
          </Button>
        </Space>
      </div>

      {alerts.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, border: '1px solid #ff4d4f', background: '#fff2f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
            <Text strong style={{ color: '#ff4d4f' }}>
              {alerts.length} 条监控告警待处理
            </Text>
            <Button size="small" type="link" onClick={() => document.getElementById('alert-section').scrollIntoView()}>
              查看详情
            </Button>
          </div>
        </Card>
      )}

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {cameras.map(cam => (
            <Col xs={24} sm={12} lg={8} xl={6} key={cam.id}>
              <Card
                hoverable
                cover={
                  <div style={{ height: 200, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', overflow: 'hidden' }} onClick={() => handlePreview(cam)}>
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <div style={{ textAlign: 'center', color: '#fff', opacity: 0.7 }}>
                        <VideoCameraOutlined style={{ fontSize: 40, marginBottom: 8 }} />
                        <div style={{ fontSize: 12 }}>{cam.name}</div>
                        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>{new Date().toLocaleTimeString()}</div>
                      </div>
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: cam.status === 'online' ? '#52c41a' : '#ff4d4f' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{cam.location || '未设置位置'}</span>
                        <span>{cam.elder_name || '未关联'}</span>
                      </div>
                    </div>
                  </div>
                }
                actions={[
                  <Tooltip title="查看大屏"><EyeOutlined onClick={() => handlePreview(cam)} /></Tooltip>,
                  <Tooltip title="编辑"><EditOutlined onClick={() => handleEdit(cam)} /></Tooltip>,
                  <Popconfirm title="确认删除？" onConfirm={() => handleDelete(cam.id)}>
                    <DeleteOutlined style={{ color: '#ff4d4f' }} />
                  </Popconfirm>,
                ]}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>{cam.name}</Text>
                  <Tag color={STATUS_COLOR[cam.status]}>{STATUS_LABEL[cam.status]}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{cam.location || '未设置位置'}</div>
              </Card>
            </Col>
          ))}
          {cameras.length === 0 && !loading && (
            <Col span={24}>
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
                <VideoCameraOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                <div>暂无摄像头，点击"添加摄像头"开始配置</div>
              </div>
            </Col>
          )}
        </Row>
      </Spin>

      <div id="alert-section" style={{ marginTop: 24 }}>
        <Card title={<span><AlertOutlined /> 监控告警记录</span>} size="small">
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无未处理告警</div>
          ) : (
            alerts.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Space>
                  <Tag color={ALERT_SEVERITY_COLOR[a.severity]}>{a.alert_type === 'fall' ? '摔倒' : a.alert_type === 'out_of_bed' ? '离床' : a.alert_type === 'wander' ? '徘徊' : '异常'}</Tag>
                  <Text>{a.description || `${a.camera_name} 检测到异常`}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{a.elder_name || '-'}</Text>
                </Space>
                <Button size="small" type="primary" onClick={() => handleHandleAlert(a.id)}>处理</Button>
              </div>
            ))
          )}
        </Card>
      </div>

      <Modal title={editingCam ? '编辑摄像头' : '添加摄像头'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={520} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="摄像头名称" rules={[{ required: true }]}>
            <Input placeholder="如：3楼走廊A区" />
          </Form.Item>
          <Form.Item name="location" label="安装位置">
            <Input placeholder="如：3楼A区走廊" />
          </Form.Item>
          <Form.Item name="elder_id" label="关联老人">
            <Select allowClear placeholder="选择关联老人" options={elders.map(e => ({ label: `${e.name}（${e.room_number || '?'}房）`, value: e.id }))} />
          </Form.Item>
          <Form.Item name="rtsp_url" label="RTSP地址（可选）">
            <Input placeholder="rtsp://..." />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="online">
            <Select options={[{ label: '在线', value: 'online' }, { label: '离线', value: 'offline' }, { label: '维护中', value: 'maintenance' }]} />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={viewCam ? `视频监控 - ${viewCam.name}` : '视频监控'} open={previewModal} onCancel={() => setPreviewModal(false)} width="90vw" style={{ top: 20 }} footer={null} destroyOnClose>
        {viewCam && (
          <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '60vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ textAlign: 'center', color: '#fff', opacity: 0.8 }}>
                <VideoCameraOutlined style={{ fontSize: 80, marginBottom: 16 }} />
                <div style={{ fontSize: 20, fontWeight: 600 }}>{viewCam.name}</div>
                <div style={{ fontSize: 14, marginTop: 8, opacity: 0.7 }}>{viewCam.location || '未设置位置'} · {new Date().toLocaleString()}</div>
                <div style={{ fontSize: 12, marginTop: 16, opacity: 0.5 }}>模拟画面 · 实时刷新中</div>
              </div>
              <div style={{ position: 'absolute', bottom: 12, right: 16, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{new Date().toLocaleString()}</div>
              <div style={{ position: 'absolute', top: 12, left: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4d4f' }} />
                <span style={{ color: '#fff', fontSize: 12 }}>REC</span>
              </div>
            </div>
            <div style={{ background: '#111', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space><Tag color="green">在线</Tag><Text style={{ color: '#fff' }}>{viewCam.name}</Text><Text type="secondary" style={{ color: '#999' }}>{viewCam.location}</Text></Space>
              <Space><Text style={{ color: '#999', fontSize: 12 }}>关联：{viewCam.elder_name || '未关联'}</Text><Button size="small" icon={<FullscreenOutlined />} style={{ color: '#fff' }}>全屏</Button></Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
