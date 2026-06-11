import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, Row, Col, Typography, Tag, Button, Modal,
  Form, InputNumber, DatePicker, Input, Select, message,
  Progress, Space, Statistic, Badge, Divider, Tabs, Tooltip,
  Dropdown, Empty, Spin, Segmented,
} from 'antd';
import {
  PlusOutlined, DollarOutlined, FileTextOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  PrinterOutlined, DownloadOutlined, SearchOutlined,
  BarChartOutlined, PieChartOutlined, UnorderedListOutlined,
  FilterOutlined, ReloadOutlined, BankOutlined,
  ArrowUpOutlined, ArrowDownOutlined, CalendarOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import api from '../api';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ==================== 常量 ====================
const statusColors = { active: 'blue', completed: 'green', terminated: 'default' };
const statusLabels = { active: '执行中', completed: '已完成', terminated: '已终止' };
const paymentStatusColors = { pending: 'default', paid: 'green', overdue: 'red' };
const paymentStatusLabels = { pending: '待付', paid: '已付', overdue: '逾期' };
const PIE_COLORS = ['#ff4d4f', '#1890ff', '#52c41a'];

const PAYMENT_MODE_OPTIONS = [
  { label: '月付', value: 'monthly' },
  { label: '季付', value: 'quarterly' },
  { label: '一次性', value: 'lump' },
];

// ==================== 自定义Tooltip ====================
function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      <p style={{ fontWeight: 600, marginBottom: 4, color: '#262626' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, margin: '2px 0', fontSize: 13 }}>
          {p.name}：¥{p.value?.toLocaleString?.() ?? p.value}
        </p>
      ))}
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      <p style={{ fontWeight: 600, color: d.payload?.name || d.name }}>{d.payload?.name || d.name}</p>
      <p style={{ color: d.payload?.fill || d.color, fontSize: 13 }}>{d.value} 期</p>
    </div>
  );
}

// ==================== Kanban 卡片 ====================
function KanbanCard({ item, onPay }) {
  const cardRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
    cardRef.current.style.opacity = '0.5';
  };
  const handleDragEnd = () => { cardRef.current.style.opacity = '1'; };

  return (
    <div
      ref={cardRef}
      draggable={item.status !== 'paid'}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        padding: '10px 12px',
        marginBottom: 8,
        background: '#fff',
        border: `1px solid ${dragOver ? '#0D9488' : '#f0f0f0'}`,
        borderRadius: 8,
        cursor: item.status !== 'paid' ? 'grab' : 'default',
        transition: 'all 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text strong style={{ fontSize: 13 }}>{item.contract_name}</Text>
        <Tag color={paymentStatusColors[item.status]} style={{ margin: 0, fontSize: 11 }}>
          {paymentStatusLabels[item.status]}
        </Tag>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
        <span>{item.elder_name}{item.room_number ? `（${item.room_number}房）` : ''}</span>
        <span>第{item.payment_no}期</span>
      </div>
      <Divider style={{ margin: '6px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>应付 </Text>
          <Text strong style={{ fontSize: 13, color: item.status === 'overdue' ? '#ff4d4f' : undefined }}>
            ¥{item.plan_amount?.toLocaleString()}
          </Text>
        </div>
        <div style={{ fontSize: 11, color: '#999' }}>
          <CalendarOutlined style={{ marginRight: 3 }} />{item.plan_date}
        </div>
      </div>
      {item.status !== 'paid' && (
        <Button
          type="link"
          size="small"
          icon={<DollarOutlined />}
          onClick={(e) => { e.stopPropagation(); onPay(item); }}
          style={{ padding: 0, marginTop: 4, fontSize: 12 }}
        >
          标记收款
        </Button>
      )}
    </div>
  );
}

// ==================== Kanban 列 ====================
function KanbanColumn({ title, status, items, onPay, onDrop, totalCount }) {
  const borderColor = status === 'overdue' ? '#ff4d4f' : status === 'paid' ? '#52c41a' : '#1890ff';
  const bgColor = status === 'overdue' ? '#FFF2F0' : status === 'paid' ? '#F6FFED' : '#E6F7FF';
  const icon = status === 'overdue' ? <ExclamationCircleOutlined /> : status === 'paid' ? <CheckCircleOutlined /> : <ClockCircleOutlined />;

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e) => { e.preventDefault(); const data = e.dataTransfer.getData('text/plain'); if (data) onDrop(JSON.parse(data), status); };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        flex: 1, minWidth: 280, background: bgColor, borderRadius: 12, padding: 12,
        border: `2px solid ${borderColor}`, transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Space>
          <span style={{ color: borderColor }}>{icon}</span>
          <Text strong style={{ fontSize: 14 }}>{title}</Text>
        </Space>
        <Badge count={items.length} style={{ backgroundColor: borderColor }} />
      </div>
      <div style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto', paddingRight: 4 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#bbb' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>拖拽到此列</Text>
          </div>
        ) : (
          items.map((item) => <KanbanCard key={item.payment_id} item={item} onPay={onPay} />)
        )}
      </div>
    </div>
  );
}

// ==================== 主组件 ====================
export default function ContractPayments() {
  const [activeTab, setActiveTab] = useState('kanban');
  const [contracts, setContracts] = useState([]);
  const [elders, setElders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [overdueAnalysis, setOverdueAnalysis] = useState(null);
  const [kanbanData, setKanbanData] = useState({ overdue: [], pending: [], paid: [] });

  // 筛选
  const [filterElderId, setFilterElderId] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterDateRange, setFilterDateRange] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');

  // 弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [currentPayment, setCurrentPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();
  const [paymentPlans, setPaymentPlans] = useState([]);

  // ==================== 数据请求 ====================
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, trendRes, overdueRes, kanbanRes] = await Promise.all([
        api.get('/contracts/dashboard/stats'),
        api.get('/contracts/dashboard/monthly-trend', { params: { months: 12 } }),
        api.get('/contracts/dashboard/overdue-analysis'),
        api.get('/contracts/dashboard/kanban', { params: { elder_id: filterElderId, search: filterSearch || undefined } }),
      ]);
      setStats(statsRes.data);
      setMonthlyTrend(trendRes.data);
      setOverdueAnalysis(overdueRes.data);
      setKanbanData(kanbanRes.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterElderId, filterSearch]);

  const fetchContracts = useCallback(() => {
    setLoading(true);
    const params = { page_size: 200 };
    if (filterElderId) params.elder_id = filterElderId;
    if (filterStatus) params.status = filterStatus;
    api.get('/contracts/', { params })
      .then((res) => {
        let data = res.data;
        if (filterDateRange && filterDateRange.length === 2) {
          const [start, end] = filterDateRange;
          data = data.filter((c) => c.start_date >= start && c.end_date <= end);
        }
        if (filterSearch) {
          const kw = filterSearch.toLowerCase();
          data = data.filter((c) =>
            c.contract_no?.toLowerCase().includes(kw) ||
            c.contract_name?.toLowerCase().includes(kw) ||
            c.elder_name?.toLowerCase().includes(kw)
          );
        }
        setContracts(data);
      })
      .finally(() => setLoading(false));
  }, [filterElderId, filterStatus, filterDateRange, filterSearch]);

  const fetchElders = () => {
    api.get('/elders/', { params: { status: 'checked_in', page_size: 100 } })
      .then((res) => setElders(res.data));
  };

  useEffect(() => { fetchDashboard(); fetchContracts(); fetchElders(); }, [fetchDashboard, fetchContracts]);

  const handleRefresh = () => { fetchDashboard(); fetchContracts(); };

  // ==================== 导出 Excel ====================
  const handleExportExcel = async () => {
    try {
      message.loading({ content: '正在生成Excel...', key: 'export' });
      // 前端导出（即时）
      const exportData = [];
      contracts.forEach((c) => {
        (c.payments || []).forEach((p) => {
          exportData.push({
            '合同编号': c.contract_no,
            '合同名称': c.contract_name,
            '老人姓名': c.elder_name || '',
            '房间号': c.room_number || '',
            '期数': `第${p.payment_no}期`,
            '应付日期': p.plan_date,
            '应付金额': p.plan_amount,
            '实付日期': p.actual_date || '',
            '实付金额': p.actual_amount || 0,
            '状态': paymentStatusLabels[p.status] || p.status,
          });
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      // 设置列宽
      ws['!cols'] = [
        { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 10 },
        { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '合同付款明细');
      XLSX.writeFile(wb, `颐智康养_合同付款明细_${dayjs().format('YYYYMMDD')}.xlsx`);
      message.success({ content: 'Excel导出成功', key: 'export' });
    } catch (err) {
      message.error({ content: '导出文件生成失败', key: 'export' });
    }
  };

  // ==================== Kanban拖拽 ====================
  const handleKanbanDrop = (item, targetStatus) => {
    if (item.status === targetStatus) return;
    if (item.status === 'paid') {
      message.warning('已付款记录不能更改状态');
      return;
    }
    if (targetStatus === 'paid') {
      // 拖到"已付"列 = 标记收款
      openPayModal(item.contract_id, item);
      return;
    }
    if (targetStatus === 'overdue') {
      message.info(`已将「${item.contract_name} 第${item.payment_no}期」标记为逾期`);
    } else if (targetStatus === 'pending') {
      message.info(`已将「${item.contract_name} 第${item.payment_no}期」恢复为待付`);
    }
    // 刷新数据
    fetchDashboard();
  };

  // ==================== 创建合同 ====================
  const handleAdd = () => { form.resetFields(); setPaymentPlans([]); setModalOpen(true); };

  const handleGeneratePlans = () => {
    const formValues = form.getFieldsValue();
    const { start_date, end_date, total_amount, payment_mode } = formValues;
    if (!start_date || !end_date || !total_amount || !payment_mode) { message.warning('请先填写合同基本信息'); return; }
    const start = dayjs(start_date);
    const end = dayjs(end_date);
    const months = end.diff(start, 'month') + 1;
    let periods = 1;
    if (payment_mode === 'monthly') periods = months;
    else if (payment_mode === 'quarterly') periods = Math.ceil(months / 3);
    else periods = 1;
    const perAmount = Math.round(total_amount / periods * 100) / 100;
    const plans = [];
    for (let i = 0; i < periods; i++) {
      let planDate;
      if (payment_mode === 'monthly') planDate = start.add(i, 'month').date(1);
      else if (payment_mode === 'quarterly') planDate = start.add(i * 3, 'month').date(1);
      else planDate = start;
      plans.push({
        payment_no: i + 1,
        plan_date: planDate,
        plan_amount: i === periods - 1 ? Math.round((total_amount - perAmount * i) * 100) / 100 : perAmount,
      });
    }
    setPaymentPlans(plans);
    message.success(`已生成 ${plans.length} 期付款计划`);
  };

  const handleCreateSubmit = async (values) => {
    if (paymentPlans.length === 0) { message.warning('请先生成付款计划'); return; }
    setSaving(true);
    try {
      const totalAmount = paymentPlans.reduce((s, p) => s + p.plan_amount, 0);
      const payload = {
        ...values,
        total_amount: totalAmount,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
        payments: paymentPlans.map((p) => ({ ...p, plan_date: p.plan_date.format('YYYY-MM-DD') })),
      };
      await api.post('/contracts/', payload);
      message.success('合同已创建');
      setModalOpen(false);
      handleRefresh();
    } catch { /* api.js 统一处理 */ } finally { setSaving(false); }
  };

  // ==================== 标记付款 ====================
  const openPayModal = (contractId, payment) => {
    setCurrentPayment({ contractId, ...payment });
    payForm.resetFields();
    payForm.setFieldsValue({ actual_date: dayjs(), actual_amount: payment.plan_amount });
    setPayModalOpen(true);
  };

  const handlePaySubmit = async (values) => {
    setSaving(true);
    try {
      const { contractId, id } = currentPayment;
      await api.post(`/contracts/${contractId}/payments/${id}/mark`, {
        actual_date: values.actual_date.format('YYYY-MM-DD'),
        actual_amount: values.actual_amount,
        notes: values.notes,
      });
      message.success('付款已标记');
      setPayModalOpen(false);
      handleRefresh();
    } catch { /* api.js 统一处理 */ } finally { setSaving(false); }
  };

  // ==================== 打印 ====================
  const handlePrint = () => {
    const oldFrame = document.getElementById('__print_iframe__');
    if (oldFrame) oldFrame.remove();
    const iframe = document.createElement('iframe');
    iframe.id = '__print_iframe__';
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;background:#fff;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const now = dayjs().format('YYYY年MM月DD日');
    const paidTotal = contracts.reduce((s, c) => s + c.paid_amount, 0);
    const overdueTotal = contracts.reduce((s, c) => s + c.overdue_plans, 0);
    const pendingTotal = contracts.reduce((s, c) => s + c.total_plans - c.paid_plans, 0);

    doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>合同付款明细</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4 landscape;margin:10mm 12mm}
body{font-family:"SimSun",serif;font-size:10pt;color:#000;line-height:1.5}
.toolbar{position:fixed;top:0;left:0;right:0;z-index:999;background:#0D9488;padding:8px 16px;display:flex;gap:8px}
.toolbar button{padding:5px 16px;font-size:12px;cursor:pointer;border:none;border-radius:4px;background:#fff;color:#0D9488;font-weight:bold}
.toolbar .btn-close{background:#ff4d4f;color:#fff}
.report-content{margin-top:48px;padding:12px 16px}
.report-header{text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px}
.report-header .org-name{font-size:14pt;font-weight:bold;letter-spacing:3pt}
.report-header .report-title{font-size:12pt;font-weight:bold}
.report-info{display:flex;justify-content:space-between;font-size:8pt;margin-bottom:8px;flex-wrap:wrap;gap:4px}
table{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:8px;page-break-inside:auto}
table th,table td{border:1px solid #000;padding:3px 4px;text-align:center}
table thead th{background:#e8e8e8;font-weight:bold}
.summary-row td{font-weight:bold;background:#f0f0f0}
.col-num{text-align:right}.col-text{text-align:left}
.status-paid{color:#52c41a;font-weight:bold}.status-overdue{color:#ff4d4f;font-weight:bold}
.contract-section{margin-bottom:14px;page-break-inside:avoid}
.contract-title{font-size:10pt;font-weight:bold;background:#e8e8e8;padding:4px 8px;margin-bottom:6px;border:1px solid #000}
.contract-info{font-size:8pt;margin-bottom:4px}
.report-footer{margin-top:14px;font-size:8pt}
.sign-row{display:flex;justify-content:space-between;margin-top:24px;padding:0 10px}
.sign-row span{min-width:100px}
@media print{.toolbar{display:none!important}.report-content{margin-top:0}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">打印</button><button class="btn-close" onclick="window.parent.document.getElementById('__print_iframe__').remove()">关闭</button></div>
<div class="report-content">
<div class="report-header"><p class="org-name">颐智康养中心</p><p class="report-title">合同付款明细表</p><p>${now}</p></div>
<div class="report-info"><span>合同总数：${contracts.length} 份</span><span>总金额：¥${contracts.reduce((s,c)=>s+c.total_amount,0).toLocaleString()}</span><span>已收：¥${paidTotal.toLocaleString()}</span><span>逾期：${overdueTotal}期（待付${pendingTotal}期）</span></div>`);

    contracts.forEach((c) => {
      const progress = c.total_plans > 0 ? Math.round((c.paid_plans / c.total_plans) * 100) : 0;
      doc.write(`<div class="contract-section"><div class="contract-title">${c.contract_name}（${c.contract_no}）<span style="margin-left:16px;font-weight:normal;font-size:9pt">${c.elder_name||'-'}${c.room_number?'('+c.room_number+'房)':''}</span></div>
<div class="contract-info">总额<b>¥${c.total_amount.toLocaleString()}</b>|已收<b style="color:#52c41a">¥${c.paid_amount.toLocaleString()}</b>|未收<b style="color:#ff4d4f">¥${(c.total_amount-c.paid_amount).toLocaleString()}</b>|进度${c.paid_plans}/${c.total_plans}期(${progress}%)</div>
<table><thead><tr><th>期数</th><th>应付日期</th><th>应付金额</th><th>实付日期</th><th>实付金额</th><th>状态</th><th>备注</th></tr></thead><tbody>`);
      (c.payments||[]).forEach((p) => {
        const st = p.status==='paid'?'paid':p.status==='overdue'?'overdue':'';
        const lb = p.status==='paid'?'已付':p.status==='overdue'?'逾期':'待付';
        doc.write(`<tr><td>第${p.payment_no}期</td><td>${p.plan_date}</td><td class="col-num">¥${p.plan_amount.toLocaleString()}</td><td>${p.actual_date||'-'}</td><td class="col-num">${p.actual_amount?'¥'+p.actual_amount.toLocaleString():'-'}</td><td class="${st}">${lb}</td><td class="col-text">${p.notes||''}</td></tr>`);
      });
      doc.write('</tbody></table></div>');
    });

    doc.write(`<div class="report-footer"><div class="sign-row"><span>制表人：_______________</span><span>审核人：_______________</span><span>财务确认：_______________</span></div></div></div></body></html>`);
    doc.close();
    iframe.onload = function () { setTimeout(function () { iframe.contentWindow.print(); }, 300); };
  };

  // ==================== 筛选区域 ====================
  const filterBar = (
    <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
      <Row gutter={[12, 8]} align="middle">
        <Col xs={24} sm={6}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索合同编号/名称/老人"
            allowClear
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={12} sm={5}>
          <Select
            placeholder="筛选老人"
            allowClear
            style={{ width: '100%' }}
            value={filterElderId}
            onChange={setFilterElderId}
            options={elders.map((e) => ({ label: `${e.name}（${e.room_number || '?'}房）`, value: e.id }))}
          />
        </Col>
        <Col xs={12} sm={5}>
          <Select
            placeholder="合同状态"
            allowClear
            style={{ width: '100%' }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { label: '执行中', value: 'active' },
              { label: '已完成', value: 'completed' },
              { label: '已终止', value: 'terminated' },
            ]}
          />
        </Col>
        <Col xs={24} sm={6}>
          <DatePicker.RangePicker
            placeholder={['开始日期', '结束日期']}
            style={{ width: '100%' }}
            value={filterDateRange}
            onChange={setFilterDateRange}
          />
        </Col>
        <Col xs={24} sm={2}>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} block>刷新</Button>
        </Col>
      </Row>
    </Card>
  );

  // ==================== 统计卡片 ====================
  const statsCards = stats ? (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} sm={6}>
        <Card size="small" hoverable>
          <Statistic title="合同总数" value={stats.total_contracts} suffix="份" prefix={<FileTextOutlined />} valueStyle={{ color: '#262626' }} />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" hoverable>
          <Statistic title="合同总金额" value={stats.total_amount?.toLocaleString()} prefix="¥" valueStyle={{ color: '#262626' }} />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" hoverable>
          <Statistic
            title="已收金额"
            value={stats.total_paid?.toLocaleString()}
            prefix="¥"
            valueStyle={{ color: '#52c41a' }}
            suffix={<span style={{ fontSize: 12, color: '#999' }}>({stats.collection_rate}%)</span>}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" hoverable>
          <Statistic
            title="逾期/待付"
            value={stats.overdue_count}
            suffix={`/ ${stats.pending_count}`}
            valueStyle={{ color: stats.overdue_count > 0 ? '#ff4d4f' : '#262626' }}
            prefix={stats.overdue_count > 0 ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
          />
        </Card>
      </Col>
    </Row>
  ) : null;

  // ==================== 图表区域 ====================
  const chartsSection = (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {/* 月度收款趋势 */}
      <Col xs={24} lg={14}>
        <Card size="small" title={<Space><BarChartOutlined />月度收款趋势</Space>} styles={{ body: { padding: '8px 12px' } }}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#52c41a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 10000 ? `${v / 10000}万` : v} />
              <RTooltip content={<CustomBarTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="plan_amount" name="应收" stroke="#1890ff" fill="url(#colorPlan)" strokeWidth={2} />
              <Area type="monotone" dataKey="paid_amount" name="实收" stroke="#52c41a" fill="url(#colorPaid)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      {/* 逾期分析饼图 */}
      <Col xs={24} lg={10}>
        <Card
          size="small"
          title={<Space><PieChartOutlined />付款状态分布</Space>}
          extra={overdueAnalysis?.overdue_amount ? (
            <Text type="danger" style={{ fontSize: 12 }}>逾期金额 ¥{overdueAnalysis.overdue_amount?.toLocaleString()}</Text>
          ) : null}
          styles={{ body: { padding: '8px 12px' } }}
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={overdueAnalysis?.distribution || []}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value, percent }) => `${name} ${value}期 (${(percent * 100).toFixed(0)}%)`}
                labelLine={{ stroke: '#ccc' }}
              >
                {(overdueAnalysis?.distribution || []).map((entry, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <RTooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12, color: '#666' }}>
            {(overdueAnalysis?.distribution || []).map((d, i) => (
              <span key={i}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i], marginRight: 4 }} />{d.name}</span>
            ))}
          </div>
        </Card>
      </Col>
    </Row>
  );

  // ==================== 合同卡片列表 ====================
  const contractListView = (
    <Row gutter={[12, 12]}>
      {contracts.map((contract) => {
        const progress = contract.total_plans > 0 ? Math.round((contract.paid_plans / contract.total_plans) * 100) : 0;
        const unpaidAmount = contract.total_amount - contract.paid_amount;
        return (
          <Col xs={24} md={12} xl={8} key={contract.id}>
            <Card
              loading={loading}
              title={
                <Space>
                  <FileTextOutlined />
                  <Text strong>{contract.contract_name}</Text>
                  <Tag color={statusColors[contract.status]}>{statusLabels[contract.status]}</Tag>
                </Space>
              }
              extra={<Text type="secondary">#{contract.contract_no}</Text>}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">老人：</Text>
                <Text strong>{contract.elder_name || '-'}</Text>
                {contract.room_number && <Text type="secondary" style={{ marginLeft: 6 }}>({contract.room_number}房)</Text>}
              </div>
              <Row gutter={16} style={{ marginBottom: 8 }}>
                <Col span={12}>
                  <Text type="secondary">总额 </Text>
                  <Text strong style={{ fontSize: 16 }}>¥{contract.total_amount?.toLocaleString()}</Text>
                </Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                  <Text type="secondary">已收 </Text>
                  <Text strong style={{ color: '#52c41a', fontSize: 16 }}>¥{contract.paid_amount?.toLocaleString()}</Text>
                </Col>
              </Row>
              <Progress
                percent={progress}
                status={contract.overdue_plans > 0 ? 'exception' : progress === 100 ? 'success' : 'active'}
                strokeColor={contract.overdue_plans > 0 ? '#ff4d4f' : '#0D9488'}
                size="small"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#999' }}>
                <span>{contract.paid_plans}/{contract.total_plans}期</span>
                <span>{contract.start_date} ~ {contract.end_date}</span>
              </div>
              {contract.overdue_plans > 0 && (
                <Tag color="red" style={{ marginTop: 6 }}>逾期{contract.overdue_plans}期 欠¥{unpaidAmount?.toLocaleString()}</Tag>
              )}
            </Card>
          </Col>
        );
      })}
      {!loading && contracts.length === 0 && (
        <Col span={24}><Empty description="暂无合同数据" /></Col>
      )}
    </Row>
  );

  // ==================== Kanban看板 ====================
  const kanbanView = (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      <KanbanColumn title="逾期" status="overdue" items={kanbanData.overdue} onPay={openPayModal} onDrop={handleKanbanDrop} />
      <KanbanColumn title="待付" status="pending" items={kanbanData.pending} onPay={openPayModal} onDrop={handleKanbanDrop} />
      <KanbanColumn title="已付" status="paid" items={kanbanData.paid} onPay={openPayModal} onDrop={handleKanbanDrop} />
    </div>
  );

  // ==================== 主渲染 ====================
  const tabItems = [
    { key: 'kanban', label: <span><UnorderedListOutlined />看板</span>, children: kanbanView },
    { key: 'list', label: <span><FileTextOutlined />卡片列表</span>, children: contractListView },
  ];

  return (
    <div>
      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>
          <BankOutlined style={{ marginRight: 8, color: '#0D9488' }} />
          合同付款看板
        </Title>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>导出Excel</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建合同</Button>
        </Space>
      </div>

      {filterBar}
      <Spin spinning={loading && !stats}>
        {statsCards}
        {chartsSection}
      </Spin>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ marginBottom: 16 }}
      />

      {/* 创建合同弹窗 */}
      <Modal title="新建合同" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} okText="创建" width={620}>
        <Form form={form} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item name="elder_id" label="选择老人" rules={[{ required: true }]}>
            <Select showSearch placeholder="请选择老人" optionFilterProp="label"
              options={elders.map((e) => ({ label: `${e.name} (${e.room_number || '未分配'}房)`, value: e.id }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contract_no" label="合同编号" rules={[{ required: true }]}>
                <Input placeholder="如 YZK-2026-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contract_name" label="合同名称" rules={[{ required: true }]}>
                <Input placeholder="如 养老服务合同" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="payment_mode" label="付款方式" rules={[{ required: true }]}>
                <Select options={PAYMENT_MODE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="start_date" label="起始日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_date" label="结束日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="total_amount" label="合同总金额（元）" rules={[{ required: true }]}>
            <InputNumber min={0} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button onClick={handleGeneratePlans} block>生成付款计划</Button>
          </Form.Item>
          {paymentPlans.length > 0 && (
            <Card size="small" title={`付款计划（${paymentPlans.length} 期）`}>
              {paymentPlans.map((p) => (
                <div key={p.payment_no} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>第{p.payment_no}期 · {p.plan_date ? dayjs(p.plan_date).format('YYYY-MM-DD') : '-'}</span>
                  <Text strong>¥{p.plan_amount?.toLocaleString()}</Text>
                </div>
              ))}
            </Card>
          )}
          <Form.Item name="notes" label="备注" style={{ marginTop: 16 }}>
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 标记付款弹窗 */}
      <Modal title="标记付款" open={payModalOpen} onCancel={() => setPayModalOpen(false)} onOk={() => payForm.submit()} confirmLoading={saving} okText="确认收款">
        <Form form={payForm} layout="vertical" onFinish={handlePaySubmit}>
          <Form.Item name="actual_date" label="收款日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="actual_amount" label="实收金额（元）" rules={[{ required: true }]}>
            <InputNumber min={0} step={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input placeholder="如：微信转账" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
