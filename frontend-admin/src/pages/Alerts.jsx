import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Select, InputNumber, Input,
  Switch, Space, Tag, Card, message, Tabs, Badge, Popconfirm,
  Descriptions, Tooltip, Typography, Checkbox, Alert,
} from 'antd';
import {
  PlusOutlined, WarningOutlined, CheckCircleOutlined,
  SettingOutlined, BellOutlined, RobotOutlined,
  RiseOutlined, ApiOutlined, ClearOutlined,
  ExclamationCircleOutlined, PhoneOutlined, MailOutlined,
} from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

const INDICATORS = [
  { label: '收缩压', value: 'blood_pressure_systolic' },
  { label: '舒张压', value: 'blood_pressure_diastolic' },
  { label: '心率', value: 'heart_rate' },
  { label: '血糖', value: 'blood_sugar' },
  { label: '体温', value: 'temperature' },
  { label: '血氧', value: 'oxygen_saturation' },
];

const SEVERITY_COLORS = { warning: 'orange', critical: 'red', info: 'blue' };
const SEVERITY_LABELS = { warning: '警告', critical: '严重', info: '提示' };

const CHANNEL_LABELS = {
  wechat: '企业微信',
  sms: '短信',
  email: '邮件',
  webhook: 'Webhook',
  escalation: '告警升级',
};

const INDICATOR_LABELS = {
  blood_pressure_systolic: '收缩压',
  blood_pressure_diastolic: '舒张压',
  heart_rate: '心率',
  blood_sugar: '血糖',
  temperature: '体温',
  oxygen_saturation: '血氧',
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleForm] = Form.useForm();
  const [editingRule, setEditingRule] = useState(null);
  const [activeTab, setActiveTab] = useState('alerts');
  const [counts, setCounts] = useState({ unread: 0, unresolved: 0 });

  // 选择行（批量操作）
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 告警详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailAlert, setDetailAlert] = useState(null);
  const [detailLogs, setDetailLogs] = useState([]);

  // 处理弹窗（填写备注）
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  // 通知配置
  const [notifyConfigs, setNotifyConfigs] = useState([]);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyForm] = Form.useForm();
  const [editingNotify, setEditingNotify] = useState(null);
  const [templates, setTemplates] = useState({});

  // 升级规则
  const [escalRules, setEscalRules] = useState([]);
  const [escalModalOpen, setEscalModalOpen] = useState(false);
  const [escalForm] = Form.useForm();
  const [editingEscal, setEditingEscal] = useState(null);

  // 通知日志
  const [notifyLogs, setNotifyLogs] = useState([]);

  // ===== 告警记录 =====
  const fetchAlerts = async (status) => {
    setLoading(true);
    try {
      const params = {};
      if (status && status !== 'all') params.status = status;
      const res = await api.get('/alerts/', { params });
      setAlerts(res.data);
    } catch (e) {}
    setLoading(false);
  };

  const fetchRules = async () => {
    try {
      const res = await api.get('/alerts/rules');
      setRules(res.data);
    } catch (e) {}
  };

  const fetchCounts = async () => {
    try {
      const res = await api.get('/alerts/count');
      setCounts(res.data);
    } catch (e) {}
  };

  // ===== 通知配置 =====
  const fetchNotifyConfigs = async () => {
    try {
      const res = await api.get('/notifications/configs');
      setNotifyConfigs(res.data);
    } catch (e) {}
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/notifications/templates');
      setTemplates(res.data);
    } catch (e) {}
  };

  const handleNotifySubmit = async () => {
    try {
      const values = await notifyForm.validateFields();
      try { JSON.parse(values.config_json); } catch {
        message.error('配置参数必须是合法的 JSON 格式');
        return;
      }
      if (editingNotify) {
        await api.put(`/notifications/configs/${editingNotify.id}`, values);
        message.success('配置已更新');
      } else {
        await api.post('/notifications/configs', values);
        message.success('配置已添加');
      }
      setNotifyModalOpen(false);
      notifyForm.resetFields();
      setEditingNotify(null);
      fetchNotifyConfigs();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const handleDeleteNotify = async (id) => {
    await api.delete(`/notifications/configs/${id}`);
    message.success('配置已删除');
    fetchNotifyConfigs();
  };

  const handleFillTemplate = (channel) => {
    if (templates[channel]) {
      notifyForm.setFieldsValue({
        channel,
        config_json: templates[channel].example,
      });
    }
  };

  // ===== 升级规则 =====
  const fetchEscalRules = async () => {
    try {
      const res = await api.get('/notifications/escalation-rules');
      setEscalRules(res.data);
    } catch (e) {}
  };

  const handleEscalSubmit = async () => {
    try {
      const values = await escalForm.validateFields();
      if (editingEscal) {
        await api.put(`/notifications/escalation-rules/${editingEscal.id}`, values);
        message.success('升级规则已更新');
      } else {
        await api.post('/notifications/escalation-rules', values);
        message.success('升级规则已添加');
      }
      setEscalModalOpen(false);
      escalForm.resetFields();
      setEditingEscal(null);
      fetchEscalRules();
    } catch (e) {}
  };

  const handleDeleteEscal = async (id) => {
    await api.delete(`/notifications/escalation-rules/${id}`);
    message.success('规则已删除');
    fetchEscalRules();
  };

  const handleRunEscalation = async () => {
    try {
      const res = await api.post('/alerts/escalation/check');
      message.success(`升级检查完成，已升级 ${res.data.escalated} 条告警`);
      fetchAlerts();
      fetchCounts();
    } catch (e) {}
  };

  // ===== 通知日志 =====
  const fetchNotifyLogs = async () => {
    try {
      const res = await api.get('/notifications/logs', { params: { limit: 30 } });
      setNotifyLogs(res.data);
    } catch (e) {}
  };

  // ===== 告警操作 =====
  const handleResolve = async (id, note = '') => {
    try {
      await api.put(`/alerts/${id}/resolve`, { note });
      message.success('已处理');
      fetchAlerts(activeTab === 'alerts' ? undefined : activeTab);
      fetchCounts();
      setResolveModalOpen(false);
      setResolvingId(null);
      setResolveNote('');
    } catch (e) {
      // 错误提示由 api.js 统一处理
    }
  };

  const handleBatchResolve = async () => {
    if (selectedRowKeys.length === 0) return;
    Modal.confirm({
      title: '批量处理告警',
      content: (
        <div style={{ marginTop: 16 }}>
          <p>将处理 {selectedRowKeys.length} 条告警，请填写处理备注：</p>
          <Input.TextArea
            rows={3}
            placeholder="如：已联系家属，老人情况正常"
            id="batch-resolve-note"
          />
        </div>
      ),
      onOk: async () => {
        const noteEl = document.getElementById('batch-resolve-note');
        const note = noteEl ? noteEl.value : '';
        try {
          const res = await api.post('/alerts/batch/resolve', {
            alert_ids: selectedRowKeys,
            note,
          });
          message.success(`已处理 ${res.data.resolved} 条告警`);
          setSelectedRowKeys([]);
          fetchAlerts(activeTab === 'alerts' ? undefined : activeTab);
          fetchCounts();
        } catch (e) {
          // 错误提示由 api.js 统一处理
        }
      },
    });
  };

  const handleBatchRead = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      const res = await api.post('/alerts/batch/read', { alert_ids: selectedRowKeys });
      message.success(`已标记 ${res.data.marked} 条为已读`);
      setSelectedRowKeys([]);
      fetchAlerts(activeTab === 'alerts' ? undefined : activeTab);
      fetchCounts();
    } catch (e) {
      // 错误提示由 api.js 统一处理
    }
  };

  // ===== 告警详情 =====
  const handleShowDetail = async (alert) => {
    try {
      const res = await api.get(`/alerts/${alert.id}`);
      setDetailAlert(res.data);
      // 拉取该告警的通知日志
      const logRes = await api.get('/notifications/logs', { params: { alert_id: alert.id, limit: 20 } });
      setDetailLogs(logRes.data);
      setDetailModalOpen(true);
    } catch (e) {}
  };

  // ===== 初始化 =====
  useEffect(() => {
    fetchAlerts();
    fetchRules();
    fetchCounts();
    fetchNotifyConfigs();
    fetchTemplates();
    fetchEscalRules();
    fetchNotifyLogs();
  }, []);

  useEffect(() => {
    if (activeTab === 'alerts' || activeTab === 'unresolved') {
      fetchAlerts(activeTab === 'alerts' ? undefined : activeTab);
    }
  }, [activeTab]);

  // ===== 告警表格列 =====
  const alertColumns = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 80,
      render: (v) => <Tag color={SEVERITY_COLORS[v] || 'blue'}>{SEVERITY_LABELS[v] || v}</Tag>,
    },
    {
      title: '告警内容',
      dataIndex: 'message',
      ellipsis: true,
      render: (v, r) => (
        <a onClick={() => handleShowDetail(r)} style={{ color: 'inherit' }}>
          {v}
        </a>
      ),
    },
    {
      title: '老人',
      dataIndex: 'elder_name',
      width: 80,
    },
    {
      title: '指标值',
      width: 100,
      render: (_, r) => {
        const label = INDICATOR_LABELS[r.indicator] || r.indicator;
        return `${label}: ${r.measured_value}`;
      },
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 140,
      render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-',
    },
    {
      title: '状态',
      width: 100,
      render: (_, r) => (
        <Space size={4}>
          {r.is_resolved ? <Tag color="green">已处理</Tag> : <Tag color="red">未处理</Tag>}
          {!r.is_read && <Badge status="processing" />}
        </Space>
      ),
    },
    {
      title: '处理备注',
      dataIndex: 'resolution_note',
      width: 120,
      ellipsis: true,
      render: (v) => v ? <Text style={{ fontSize: 11 }}>{v}</Text> : '-',
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) =>
        !r.is_resolved && (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setResolvingId(r.id);
                setResolveNote('');
                setResolveModalOpen(true);
              }}
            >
              处理
            </Button>
          </Space>
        ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  // ===== Tab 项 =====
  const tabItems = [
    {
      key: 'alerts',
      label: (
        <span>
          <BellOutlined /> 全部告警
          {counts.unread > 0 && (
            <Badge count={counts.unread} size="small" style={{ marginLeft: 6, backgroundColor: '#faad14' }} />
          )}
        </span>
      ),
      children: (
        <div>
          {/* 批量操作栏 */}
          {selectedRowKeys.length > 0 && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#e6f7ff', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>已选 {selectedRowKeys.length} 条</Text>
              <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} onClick={handleBatchResolve}>
                批量处理
              </Button>
              <Button size="small" icon={<ClearOutlined />} onClick={handleBatchRead}>
                标记已读
              </Button>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>取消</Button>
            </div>
          )}
          <Table
            columns={alertColumns}
            dataSource={alerts}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 20 }}
            rowSelection={rowSelection}
            onRow={(r) => ({
              onClick: () => handleShowDetail(r),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      ),
    },
    {
      key: 'unresolved',
      label: (
        <Badge count={counts.unresolved} size="small" offset={[6, 0]}>
          <WarningOutlined /> 未处理
        </Badge>
      ),
      children: (
        <div>
          {selectedRowKeys.length > 0 && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>已选 {selectedRowKeys.length} 条</Text>
              <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} onClick={handleBatchResolve}>
                批量处理
              </Button>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>取消</Button>
            </div>
          )}
          <Table
            columns={alertColumns}
            dataSource={alerts}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 20 }}
            rowSelection={rowSelection}
            onRow={(r) => ({
              onClick: () => handleShowDetail(r),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      ),
    },
    {
      key: 'notify',
      label: <span><ApiOutlined /> 通知配置</span>,
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingNotify(null);
              notifyForm.resetFields();
              setNotifyModalOpen(true);
            }}>
              新增渠道
            </Button>
            <Select
              placeholder="快速模板"
              style={{ width: 140 }}
              onChange={(channel) => {
                setEditingNotify(null);
                notifyForm.resetFields();
                setNotifyModalOpen(true);
                setTimeout(() => handleFillTemplate(channel), 100);
              }}
              options={Object.keys(templates).map(k => ({
                label: CHANNEL_LABELS[k] || k,
                value: k,
              }))}
            />
          </div>
          <Table columns={[]} dataSource={[]} /> {/* placeholder - will be filled */}
          <Table
            columns={[
              { title: '配置名称', dataIndex: 'name', width: 140 },
              {
                title: '渠道', dataIndex: 'channel', width: 90,
                render: (v) => <Tag>{CHANNEL_LABELS[v] || v}</Tag>,
              },
              {
                title: '配置参数', dataIndex: 'config_json', ellipsis: true,
                render: (v) => {
                  try {
                    const obj = JSON.parse(v);
                    const keys = Object.keys(obj).filter(k => !k.includes('secret') && !k.includes('password'));
                    return <Text code style={{ fontSize: 11 }}>{keys.slice(0, 3).join(', ')}{keys.length > 3 ? '...' : ''}</Text>;
                  } catch { return <Text type="secondary">无效配置</Text>; }
                },
              },
              {
                title: '启用', dataIndex: 'is_active', width: 60,
                render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
              },
              {
                title: '操作', width: 140,
                render: (_, r) => (
                  <Space>
                    <Button type="link" size="small" onClick={() => {
                      setEditingNotify(r);
                      notifyForm.setFieldsValue(r);
                      setNotifyModalOpen(true);
                    }}>编辑</Button>
                    <Button type="link" size="small" danger onClick={() => handleDeleteNotify(r.id)}>删除</Button>
                  </Space>
                ),
              },
            ]}
            dataSource={notifyConfigs}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: '暂无通知渠道配置，点击「新增渠道」开始配置' }}
          />
          {notifyConfigs.length === 0 && (
            <Descriptions bordered size="small" column={2} style={{ marginTop: 16 }}>
              <Descriptions.Item label="企业微信">
                在企业微信群中添加机器人，获取 Webhook 地址
              </Descriptions.Item>
              <Descriptions.Item label="短信">
                支持腾讯云短信服务，配置后严重告警自动短信通知
              </Descriptions.Item>
              <Descriptions.Item label="邮件">
                配置 SMTP 服务器后，发送告警通知邮件
              </Descriptions.Item>
              <Descriptions.Item label="Webhook">
                对接客户现有系统，告警时自动回调
              </Descriptions.Item>
            </Descriptions>
          )}
        </div>
      ),
    },
    {
      key: 'escalation',
      label: <span><RiseOutlined /> 升级规则</span>,
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingEscal(null);
              escalForm.resetFields();
              setEscalModalOpen(true);
            }}>
              新增规则
            </Button>
            <Tooltip title="手动检查所有未处理告警，超时的自动升级通知">
              <Button icon={<ClearOutlined />} onClick={handleRunEscalation}>
                检查升级
              </Button>
            </Tooltip>
          </div>
          <Table
            columns={[
              { title: '规则名称', dataIndex: 'name', width: 140 },
              {
                title: '严重程度', dataIndex: 'severity', width: 90,
                render: (v) => <Tag color={SEVERITY_COLORS[v] || 'blue'}>{SEVERITY_LABELS[v] || v}</Tag>,
              },
              {
                title: '超时时间', dataIndex: 'delay_minutes', width: 90,
                render: (v) => `${v} 分钟`,
              },
              { title: '升级目标', dataIndex: 'escalate_to', width: 120 },
              {
                title: '启用', dataIndex: 'is_active', width: 60,
                render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
              },
              {
                title: '操作', width: 140,
                render: (_, r) => (
                  <Space>
                    <Button type="link" size="small" onClick={() => {
                      setEditingEscal(r);
                      escalForm.setFieldsValue(r);
                      setEscalModalOpen(true);
                    }}>编辑</Button>
                    <Button type="link" size="small" danger onClick={() => handleDeleteEscal(r.id)}>删除</Button>
                  </Space>
                ),
              },
            ]}
            dataSource={escalRules}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: '暂无升级规则。示例：严重告警30分钟未处理，自动通知护士长' }}
          />
        </div>
      ),
    },
    {
      key: 'logs',
      label: <span><ApiOutlined /> 通知日志</span>,
      children: (
        <div>
          <Button size="small" onClick={fetchNotifyLogs} style={{ marginBottom: 12 }}>
            刷新日志
          </Button>
          <Table
            columns={[
              {
                title: '时间', dataIndex: 'sent_at', width: 140,
                render: (t) => t ? dayjs(t).format('MM-DD HH:mm:ss') : '-',
              },
              {
                title: '渠道', dataIndex: 'channel', width: 90,
                render: (v) => <Tag>{CHANNEL_LABELS[v] || v}</Tag>,
              },
              { title: '接收人', dataIndex: 'recipient', width: 140, ellipsis: true },
              { title: '内容', dataIndex: 'content', ellipsis: true },
              {
                title: '状态', dataIndex: 'status', width: 80,
                render: (v) => v === 'success' ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
              },
              {
                title: '错误', dataIndex: 'error_msg', width: 120, ellipsis: true,
                render: (v) => v ? <Text type="danger" style={{ fontSize: 11 }}>{v}</Text> : '-',
              },
            ]}
            dataSource={notifyLogs}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 15 }}
            locale={{ emptyText: '暂无通知发送记录' }}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>告警管理中心</span>
            <Badge count={counts.unresolved} style={{ backgroundColor: '#ff4d4f' }} />
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => {
              setEditingRule(null);
              ruleForm.resetFields();
              setRuleModalOpen(true);
            }}>
              新增规则
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>

      {/* 告警规则编辑 Modal */}
      <Modal
        title={editingRule ? '编辑告警规则' : '新增告警规则'}
        open={ruleModalOpen}
        onOk={async () => {
          try {
            const values = await ruleForm.validateFields();
            if (editingRule) {
              await api.put(`/alerts/rules/${editingRule.id}`, values);
              message.success('规则已更新');
            } else {
              await api.post('/alerts/rules', values);
              message.success('规则已添加');
            }
            setRuleModalOpen(false);
            ruleForm.resetFields();
            setEditingRule(null);
            fetchRules();
          } catch (e) {}
        }}
        onCancel={() => {
          setRuleModalOpen(false);
          setEditingRule(null);
          ruleForm.resetFields();
        }}
        width={500}
        destroyOnClose
      >
        <Form form={ruleForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如：收缩压过高" />
          </Form.Item>
          <Form.Item name="indicator" label="监测指标" rules={[{ required: true }]}>
            <Select options={INDICATORS} placeholder="选择指标" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="min_value" label="最低正常值">
              <InputNumber step={0.1} placeholder="不限" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="max_value" label="最高正常值">
              <InputNumber step={0.1} placeholder="不限" style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item name="severity" label="告警级别" initialValue="warning">
            <Select options={[
              { label: '提示 (低)', value: 'info' },
              { label: '警告 (一般)', value: 'warning' },
              { label: '严重 (紧急)', value: 'critical' },
            ]} />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 通知配置编辑 Modal */}
      <Modal
        title={editingNotify ? '编辑通知渠道' : '新增通知渠道'}
        open={notifyModalOpen}
        onOk={handleNotifySubmit}
        onCancel={() => {
          setNotifyModalOpen(false);
          setEditingNotify(null);
          notifyForm.resetFields();
        }}
        width={600}
        destroyOnClose
      >
        <Form form={notifyForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true }]}>
            <Input placeholder="如：企业微信告警群" />
          </Form.Item>
          <Form.Item name="channel" label="通知渠道" rules={[{ required: true }]}>
            <Select options={Object.keys(templates).map(k => ({
              label: CHANNEL_LABELS[k] || k,
              value: k,
            }))} onChange={(val) => {
              setTimeout(() => handleFillTemplate(val), 50);
            }} />
          </Form.Item>
          <Form.Item
            name="config_json"
            label="配置参数 (JSON)"
            rules={[{ required: true, message: '请输入配置参数' }]}
            extra="必须是合法的 JSON 格式。点击渠道选择后可自动填入模板"
          >
            <TextArea rows={8} placeholder='{"webhook_url": "https://...", "timeout": 10}' />
          </Form.Item>
          <Form.Item name="description" label="备注说明">
            <Input placeholder="可选，方便日后识别" />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 升级规则编辑 Modal */}
      <Modal
        title={editingEscal ? '编辑升级规则' : '新增升级规则'}
        open={escalModalOpen}
        onOk={handleEscalSubmit}
        onCancel={() => {
          setEscalModalOpen(false);
          setEditingEscal(null);
          escalForm.resetFields();
        }}
        width={500}
        destroyOnClose
      >
        <Form form={escalForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如：严重告警30分钟未处理升级" />
          </Form.Item>
          <Form.Item name="severity" label="适用告警级别" rules={[{ required: true }]}>
            <Select options={[
              { label: '提示 (info)', value: 'info' },
              { label: '警告 (warning)', value: 'warning' },
              { label: '严重 (critical)', value: 'critical' },
            ]} />
          </Form.Item>
          <Form.Item name="delay_minutes" label="超时时间（分钟）" rules={[{ required: true }]}>
            <InputNumber min={1} max={1440} style={{ width: '100%' }} placeholder="30" />
          </Form.Item>
          <Form.Item name="escalate_to" label="升级通知目标" rules={[{ required: true }]}
            extra="填写用户ID（如护士长admin）或角色名">
            <Input placeholder="如：admin 或 head_nurse" />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 告警详情弹窗 */}
      <Modal
        title={detailAlert ? `告警详情 #${detailAlert.id}` : '告警详情'}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={detailAlert && !detailAlert.is_resolved ? [
          <Button key="resolve" type="primary" icon={<CheckCircleOutlined />}
            onClick={() => {
              setDetailModalOpen(false);
              setResolvingId(detailAlert.id);
              setResolveNote('');
              setResolveModalOpen(true);
            }}
          >
            标记已处理
          </Button>,
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ] : [
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ]}
        width={680}
      >
        {detailAlert && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="严重程度">
                <Tag color={SEVERITY_COLORS[detailAlert.severity] || 'blue'}>
                  {SEVERITY_LABELS[detailAlert.severity] || detailAlert.severity}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detailAlert.is_resolved ? <Tag color="green">已处理</Tag> : <Tag color="red">未处理</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="老人">{detailAlert.elder_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="告警时间">
                {detailAlert.created_at ? dayjs(detailAlert.created_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="告警内容" span={2}>
                {detailAlert.message}
              </Descriptions.Item>
              {detailAlert.is_resolved && (
                <>
                  <Descriptions.Item label="处理人">{detailAlert.resolver_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="处理时间">
                    {detailAlert.resolved_at ? dayjs(detailAlert.resolved_at).format('YYYY-MM-DD HH:mm') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="处理备注" span={2}>
                    {detailAlert.resolution_note || <Text type="secondary">无</Text>}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            {/* 通知发送记录 */}
            <h4 style={{ marginTop: 16, marginBottom: 8 }}>通知发送记录</h4>
            {detailLogs.length === 0 ? (
              <Alert message="暂无通知发送记录" type="info" showIcon />
            ) : (
              <Table
                columns={[
                  {
                    title: '时间', dataIndex: 'sent_at', width: 140,
                    render: (t) => t ? dayjs(t).format('MM-DD HH:mm:ss') : '-',
                  },
                  {
                    title: '渠道', dataIndex: 'channel', width: 90,
                    render: (v) => <Tag>{CHANNEL_LABELS[v] || v}</Tag>,
                  },
                  { title: '接收人', dataIndex: 'recipient', width: 120, ellipsis: true },
                  {
                    title: '状态', dataIndex: 'status', width: 80,
                    render: (v) => v === 'success' ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
                  },
                  {
                    title: '错误', dataIndex: 'error_msg', ellipsis: true,
                    render: (v) => v ? <Text type="danger" style={{ fontSize: 11 }}>{v}</Text> : '-',
                  },
                ]}
                dataSource={detailLogs}
                rowKey="id"
                size="small"
                pagination={false}
              />
            )}
          </div>
        )}
      </Modal>

      {/* 处理弹窗（填写备注） */}
      <Modal
        title="处理告警"
        open={resolveModalOpen}
        onOk={() => handleResolve(resolvingId, resolveNote)}
        onCancel={() => {
          setResolveModalOpen(false);
          setResolvingId(null);
          setResolveNote('');
        }}
        okText="确认处理"
        cancelText="取消"
      >
        <div style={{ marginTop: 16 }}>
          <p>请填写处理备注（可选）：</p>
          <TextArea
            rows={4}
            placeholder="如：已联系家属，老人情况正常，无需特殊处理"
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
