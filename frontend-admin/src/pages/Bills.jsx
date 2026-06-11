import React, { useState } from 'react';
import {
  Table, Typography, Tag, Select, Space, Button, Modal,
  Form, InputNumber, DatePicker, Input, message,
} from 'antd';
import { PlusOutlined, DollarOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';
import useApi from '../hooks/useApi';
import { useElders } from '../context/EldersContext';

const { Title } = Typography;
const { TextArea } = Input;

const statusColors = { paid: 'green', unpaid: 'orange', overdue: 'red' };
const statusLabels = { paid: '已缴费', unpaid: '未缴费', overdue: '已逾期' };

export default function Bills() {
  const [status, setStatus] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 全局缓存 — 不用再单独请求 /elders/
  const { elders, filterElders } = useElders();

  // 通用请求 Hook — 替代手动 loading/fetchData
  const { data, loading, refetch } = useApi(
    () => api.get('/bills/', { params: { status, page_size: 100 } }),
    { defaultData: [], deps: [status] }
  );

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({
      bill_month: dayjs().format('YYYY-MM'),
      total_amount: 3000,
      due_date: dayjs().add(15, 'day'),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        bill_month: values.bill_month || dayjs().format('YYYY-MM'),
        due_date: values.due_date.format('YYYY-MM-DD'),
      };
      await api.post('/bills/', payload);
      message.success('账单已创建');
      setModalOpen(false);
      refetch();
    } catch {
      // 错误提示已由 api.js 统一处理
    } finally {
      setSaving(false);
    }
  };

  const handlePay = (record) => {
    Modal.confirm({
      title: '确认缴费',
      content: `确认为账单 ${record.bill_month} 缴费 ¥${record.total_amount} 吗？`,
      okText: '确认缴费',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.post(`/bills/${record.id}/pay`);
          message.success('缴费成功');
          refetch();
        } catch {
          // 错误提示已由 api.js 统一处理
        }
      },
    });
  };

  // ===== 打印账单 =====
  const handlePrint = () => {
    const oldFrame = document.getElementById('__print_iframe__');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = '__print_iframe__';
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;background:#fff;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const now = dayjs().format('YYYY年MM月DD日');

    const paidCount = data.filter((d) => d.status === 'paid').length;
    const unpaidCount = data.filter((d) => d.status === 'unpaid').length;
    const overdueCount = data.filter((d) => d.status === 'overdue').length;
    const totalBilled = data.reduce((s, d) => s + d.total_amount, 0);
    const totalCollected = data.reduce((s, d) => s + d.paid_amount, 0);

    doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>费用账单 - 打印</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4 landscape;margin:10mm 12mm 10mm 12mm}
  body{font-family:"SimSun","宋体","Microsoft YaHei",serif;font-size:10pt;color:#000;line-height:1.5;background:#fff}
  .toolbar{position:fixed;top:0;left:0;right:0;z-index:999;background:#0D9488;padding:8px 16px;display:flex;gap:8px}
  .toolbar button{padding:5px 16px;font-size:12px;cursor:pointer;border:none;border-radius:4px;background:#fff;color:#0D9488;font-weight:bold}
  .toolbar .btn-close{background:#ff4d4f;color:#fff}
  .report-content{margin-top:48px;padding:12px 16px}
  .report-header{text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px}
  .report-header .org-name{font-size:14pt;font-weight:bold;letter-spacing:3pt;margin-bottom:4px}
  .report-header .report-title{font-size:12pt;font-weight:bold;margin-bottom:2px}
  .report-header .report-subtitle{font-size:9pt;color:#333}
  .report-info{display:flex;justify-content:space-between;font-size:8pt;margin-bottom:8px;padding:0 4px;flex-wrap:wrap;gap:4px}
  table{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:8px}
  table th,table td{border:1px solid #000;padding:4px 5px;text-align:center;vertical-align:middle}
  table thead th{background:#e8e8e8;font-weight:bold}
  .col-num{text-align:right}
  .col-text{text-align:left}
  .status-paid{color:#52c41a;font-weight:bold}
  .status-unpaid{color:#fa8c16;font-weight:bold}
  .status-overdue{color:#ff4d4f;font-weight:bold}
  .summary-row td{font-weight:bold;background:#f0f0f0}
  .report-footer{margin-top:14px;font-size:8pt}
  .sign-row{display:flex;justify-content:space-between;margin-top:24px;padding:0 10px}
  .sign-row span{min-width:100px}
  .page-number{text-align:center;font-size:7pt;color:#666;margin-top:6px}
  @media print{.toolbar{display:none!important}.report-content{margin-top:0;padding:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">打印</button><button class="btn-close" onclick="window.parent.document.getElementById('__print_iframe__').remove()">关闭</button></div>
<div class="report-content">
<div class="print-report">
<div class="report-header">
  <p class="org-name">颐智康养中心</p>
  <p class="report-title">费用账单明细表</p>
  <p class="report-subtitle">${now}</p>
</div>
<div class="report-info">
  <span>账单总数：${data.length} 笔</span>
  <span>已缴费：${paidCount} 笔</span>
  <span>未缴费：${unpaidCount} 笔</span>
  <span>逾期：${overdueCount} 笔</span>
  <span>应收总额：¥${totalBilled.toLocaleString()}</span>
  <span>已收总额：¥${totalCollected.toLocaleString()}</span>
</div>
<table><thead><tr>
  <th style="width:40px">序号</th>
  <th style="width:80px">老人ID</th>
  <th style="width:80px">账单月份</th>
  <th style="width:90px">金额</th>
  <th style="width:90px">已付</th>
  <th style="width:60px">状态</th>
  <th style="width:90px">截止日期</th>
  <th style="width:90px">缴费日期</th>
</tr></thead><tbody>`);

    data.forEach((row, i) => {
      const stCls = row.status === 'paid' ? 'status-paid' : (row.status === 'overdue' ? 'status-overdue' : 'status-unpaid');
      const stLabel = row.status === 'paid' ? '已缴费' : (row.status === 'overdue' ? '已逾期' : '未缴费');
      doc.write(`<tr>
        <td>${i + 1}</td>
        <td>${row.elder_id}</td>
        <td>${row.bill_month}</td>
        <td class="col-num">¥${row.total_amount.toLocaleString()}</td>
        <td class="col-num">${row.paid_amount ? '¥'+row.paid_amount.toLocaleString() : '-'}</td>
        <td class="${stCls}">${stLabel}</td>
        <td>${row.due_date}</td>
        <td>${row.paid_date || '-'}</td>
      </tr>`);
    });

    doc.write(`</tbody></table>
<div class="report-footer">
<div class="sign-row">
  <span>制表人：_______________</span>
  <span>审核人：_______________</span>
  <span>财务确认：_______________</span>
</div>
</div>
<div class="page-number">- 第 1 页 -</div>
</div></div></body></html>`);

    doc.close();

    iframe.onload = function() {
      setTimeout(function() { iframe.contentWindow.print(); }, 300);
    };
  };

  const columns = [
    { title: '老人ID', dataIndex: 'elder_id', key: 'elder', width: 80 },
    { title: '账单月份', dataIndex: 'bill_month', key: 'month', width: 100 },
    { title: '金额', dataIndex: 'total_amount', key: 'amount', width: 100,
      render: (v) => `¥${v}`,
    },
    { title: '已付', dataIndex: 'paid_amount', key: 'paid', width: 100,
      render: (v) => `¥${v}`,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    { title: '截止日期', dataIndex: 'due_date', key: 'due', width: 110 },
    { title: '缴费日期', dataIndex: 'paid_date', key: 'paid_date', width: 110,
      render: (v) => v || '-',
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_, r) => r.status !== 'paid' ? (
        <Button type="link" icon={<DollarOutlined />} onClick={() => handlePay(r)}>
          缴费
        </Button>
      ) : null,
    },
  ];

  return (
    <div>
      <Title level={3}>费用账单</Title>
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="筛选状态"
          allowClear
          style={{ width: 120 }}
          value={status}
          onChange={setStatus}
          options={[
            { label: '已缴费', value: 'paid' },
            { label: '未缴费', value: 'unpaid' },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          创建账单
        </Button>
        <Button icon={<PrinterOutlined />} onClick={handlePrint}>打印账单</Button>
      </Space>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 800 }}
      />

      <Modal
        title="创建账单"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="创建"
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
              options={filterElders({ status: 'checked_in' }).map((e) => ({
                label: `${e.name} (${e.room_number || '未分配'}房)`,
                value: e.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="bill_month" label="账单月份"
            rules={[{ required: true, message: '请输入账单月份' }]}
          >
            <Input placeholder="如 2026-05" />
          </Form.Item>
          <Form.Item
            name="total_amount" label="金额（元）"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber min={0} step={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="bill_items" label="费用明细">
            <TextArea rows={2} placeholder="如：床位费2000+护理费1000（选填）" />
          </Form.Item>
          <Form.Item
            name="due_date" label="截止日期"
            rules={[{ required: true, message: '请选择截止日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
