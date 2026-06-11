import React, { useState, useEffect, useRef } from 'react';
import { Card, Select, DatePicker, Button, Table, Tag, Space, message, Spin, Row, Col, Statistic, Radio, Tabs, Descriptions } from 'antd';
import { PrinterOutlined, DownloadOutlined, ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import PrintableReport from '../components/PrintableReport';

const { RangePicker } = DatePicker;

// 报表类型定义
const REPORT_TYPES = [
  { key: 'occupancy', label: '入住率报表', icon: '🏠' },
  { key: 'revenue', label: '费用营收报表', icon: '💰' },
  { key: 'care-workload', label: '护理工作量报表', icon: '💊' },
  { key: 'medication-compliance', label: '用药执行报表', icon: '💉' },
  { key: 'health-summary', label: '健康体征报表', icon: '❤️' },
  { key: 'alert-summary', label: '告警统计报表', icon: '🔔' },
  { key: 'shift-summary', label: '交接班报表', icon: '📋' },
];

// 指标中文映射
const INDICATOR_LABELS = {
  blood_pressure_systolic: '收缩压',
  blood_pressure_diastolic: '舒张压',
  heart_rate: '心率',
  blood_sugar: '血糖',
  temperature: '体温',
  oxygen_saturation: '血氧',
};

const SEVERITY_COLORS = { warning: 'orange', critical: 'red' };
const SEVERITY_LABELS = { warning: '警告', critical: '严重' };

export default function Reports() {
  const [reportType, setReportType] = useState('occupancy');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [year, setYear] = useState(dayjs().year());
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [elderId, setElderId] = useState(null);
  const [shiftType, setShiftType] = useState(null);
  const [elders, setElders] = useState([]);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printData, setPrintData] = useState(null);
  const printRef = useRef(null);

  // 加载老人列表（用于筛选）
  useEffect(() => {
    api.get('/elders/', { params: { page_size: 500 } }).then(res => {
      setElders(res.data?.data || []);
    }).catch(() => {});
  }, []);

  // 切换报表类型时重置数据
  const handleTypeChange = (key) => {
    setReportType(key);
    setData(null);
  };

  // 获取报表数据
  const fetchReport = async () => {
    setLoading(true);
    try {
      let params = {};
      let url = `/reports/${reportType}`;

      switch (reportType) {
        case 'occupancy':
        case 'revenue':
          params = { year, month: month || undefined };
          break;
        case 'care-workload':
        case 'medication-compliance':
        case 'shift-summary':
          params = {
            start_date: dateRange[0].format('YYYY-MM-DD'),
            end_date: dateRange[1].format('YYYY-MM-DD'),
            shift_type: shiftType || undefined,
          };
          break;
        case 'health-summary':
          params = {
            start_date: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
            end_date: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
            elder_id: elderId || undefined,
          };
          break;
        case 'alert-summary':
          params = {
            start_date: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
            end_date: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
          };
          break;
      }

      const res = await api.get(url, { params });
      setData(res.data);
    } catch (err) {
      // 错误提示由 api.js 统一处理
    } finally {
      setLoading(false);
    }
  };

  // 构建打印数据
  const buildPrintConfig = () => {
    if (!data?.data) return null;

    const reportMeta = REPORT_TYPES.find(r => r.key === reportType);
    let title = reportMeta?.label || '报表';
    let subtitle = '';
    let columns = [];
    let rows = [];
    let summaryData = null;
    let footerNote = '';
    let extraInfo = '';

    switch (reportType) {
      case 'occupancy': {
        subtitle = `${year}年${month ? month + '月' : '全年'}统计`;
        columns = [
          { key: 'label', title: '月份', width: 100 },
          { key: 'begin_count', title: '月初在住', align: 'right' },
          { key: 'new_checkins', title: '新入住', align: 'right' },
          { key: 'checkouts', title: '退住', align: 'right' },
          { key: 'end_count', title: '月末在住', align: 'right' },
          { key: 'total_beds', title: '总床位', align: 'right' },
          { key: 'occupancy_rate', title: '入住率(%)', align: 'right', render: v => v + '%' },
        ];
        rows = data.data || [];
        const totals = rows.reduce((acc, r) => ({
          begin_count: (acc.begin_count || 0) + (r.begin_count || 0),
          new_checkins: (acc.new_checkins || 0) + (r.new_checkins || 0),
          checkouts: (acc.checkouts || 0) + (r.checkouts || 0),
          end_count: (acc.end_count || 0) + (r.end_count || 0),
          total_beds: (acc.total_beds || 0) + (r.total_beds || 0),
        }), {});
        const avgOccRate = rows.length > 0
          ? (rows.reduce((s, r) => s + (r.occupancy_rate || 0), 0) / rows.length).toFixed(1)
          : 0;
        summaryData = { label: '合计/平均', data: { ...totals, occupancy_rate: avgOccRate + '%', label: '合计/平均' } };
        footerNote = `统计周期：${year}年度。入住率 = 月末在住人数 ÷ 总床位数 × 100%。`;
        break;
      }

      case 'revenue': {
        subtitle = `${year}年${month ? month + '月' : '全年'}统计`;
        columns = [
          { key: 'label', title: '月份', width: 100 },
          { key: 'total_bills', title: '账单数', align: 'right' },
          { key: 'total_amount', title: '应收金额(元)', align: 'right' },
          { key: 'paid_amount', title: '实收金额(元)', align: 'right' },
          { key: 'unpaid_amount', title: '欠费金额(元)', align: 'right' },
          { key: 'unpaid_count', title: '欠费笔数', align: 'right' },
          { key: 'overdue_count', title: '逾期笔数', align: 'right' },
          { key: 'collection_rate', title: '收费率(%)', align: 'right', render: v => v + '%' },
        ];
        rows = data.data || [];
        const rtotals = rows.reduce((acc, r) => ({
          total_bills: (acc.total_bills || 0) + (r.total_bills || 0),
          total_amount: (acc.total_amount || 0) + (r.total_amount || 0),
          paid_amount: (acc.paid_amount || 0) + (r.paid_amount || 0),
          unpaid_amount: (acc.unpaid_amount || 0) + (r.unpaid_amount || 0),
          unpaid_count: (acc.unpaid_count || 0) + (r.unpaid_count || 0),
          overdue_count: (acc.overdue_count || 0) + (r.overdue_count || 0),
        }), {});
        const avgCollection = rows.length > 0
          ? (rows.reduce((s, r) => s + (r.collection_rate || 0), 0) / rows.length).toFixed(1)
          : 0;
        summaryData = { label: '合计/平均', data: { ...rtotals, collection_rate: avgCollection + '%', label: '合计/平均' } };
        footerNote = `统计周期：${year}年度。收费率 = 实收金额 ÷ 应收金额 × 100%。`;
        break;
      }

      case 'care-workload': {
        subtitle = `${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}`;
        columns = [
          { key: 'nurse_name', title: '护理员', width: 100 },
          { key: 'total_count', title: '总护理次数', align: 'right' },
          { key: 'abnormal_count', title: '异常次数', align: 'right' },
          { key: 'detail_text', title: '分类明细' },
        ];
        rows = (data.data || []).map(n => ({
          ...n,
          detail_text: n.details ? n.details.map(d => `${d.care_type}:${d.count}次${d.abnormal_count > 0 ? '(异常' + d.abnormal_count + ')' : ''}`).join('；') : '',
        }));
        const ctotals = rows.reduce((acc, r) => ({
          total_count: (acc.total_count || 0) + (r.total_count || 0),
          abnormal_count: (acc.abnormal_count || 0) + (r.abnormal_count || 0),
        }), {});
        summaryData = { label: '合计', data: { ...ctotals, detail_text: '', nurse_name: '合计' } };
        footerNote = `统计周期：${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}。`;
        break;
      }

      case 'medication-compliance': {
        subtitle = `${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}`;
        const md = data.data;
        columns = [
          { key: 'elder_name', title: '老人姓名', width: 100 },
          { key: 'taken', title: '已服药(次)', align: 'right' },
          { key: 'missed', title: '漏服(次)', align: 'right' },
          { key: 'compliance', title: '依从率(%)', align: 'right', render: v => v + '%' },
        ];
        rows = (md.by_elder || []).map(e => ({
          ...e,
          compliance: e.taken + e.missed > 0 ? Math.round(e.taken / (e.taken + e.missed) * 100) : 0,
        }));
        const mtaken = rows.reduce((s, r) => s + (r.taken || 0), 0);
        const mmissed = rows.reduce((s, r) => s + (r.missed || 0), 0);
        const mcompliance = mtaken + mmissed > 0 ? Math.round(mtaken / (mtaken + mmissed) * 100) : 0;
        summaryData = { label: '合计/平均', data: { taken: mtaken, missed: mmissed, compliance: mcompliance + '%', elder_name: '合计' } };
        footerNote = `统计周期：${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}。依从率 = 已服次数 ÷ (已服 + 漏服) × 100%。`;
        break;
      }

      case 'health-summary': {
        subtitle = dateRange ? `${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}` : '全部数据';
        columns = [
          { key: 'elder_name', title: '老人', width: 80 },
          { key: 'room_number', title: '房号', width: 60 },
          { key: 'record_count', title: '记录数', align: 'right' },
          { key: 'abnormal_count', title: '异常', align: 'right' },
          { key: 'avg_systolic', title: '平均收缩压', align: 'right' },
          { key: 'avg_diastolic', title: '平均舒张压', align: 'right' },
          { key: 'avg_heart_rate', title: '平均心率', align: 'right' },
          { key: 'avg_blood_sugar', title: '平均血糖', align: 'right' },
          { key: 'avg_temperature', title: '平均体温', align: 'right' },
          { key: 'avg_oxygen', title: '平均血氧', align: 'right' },
        ];
        rows = data.data || [];
        footerNote = dateRange
          ? `统计周期：${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}。`
          : '统计周期：全部历史数据。';
        break;
      }

      case 'alert-summary': {
        subtitle = dateRange ? `${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}` : '全部数据';
        const ad = data.data;
        columns = [
          { key: 'elder_name', title: '老人姓名', width: 100 },
          { key: 'total', title: '告警总数', align: 'right' },
          { key: 'unresolved', title: '未处理', align: 'right' },
        ];
        rows = ad.by_elder || [];
        const atotal = rows.reduce((s, r) => s + (r.total || 0), 0);
        const aunresolved = rows.reduce((s, r) => s + (r.unresolved || 0), 0);
        summaryData = { label: '合计', data: { total: atotal, unresolved: aunresolved, elder_name: '合计' } };
        extraInfo = `告警总数：${ad.summary?.total || 0} | 未处理：${ad.summary?.unresolved || 0} | 警告：${ad.summary?.warning || 0} | 严重：${ad.summary?.critical || 0}`;
        footerNote = dateRange
          ? `统计周期：${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}。`
          : '统计周期：全部历史数据。';
        break;
      }

      case 'shift-summary': {
        subtitle = `${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}`;
        columns = [
          { key: 'shift_date', title: '日期', width: 100 },
          { key: 'shift_type_label', title: '班次', width: 60 },
          { key: 'from_nurse', title: '交班人', width: 80 },
          { key: 'to_nurse', title: '接班人', width: 80 },
          { key: 'summary', title: '交班概要' },
          { key: 'special_notes', title: '注意事项', render: v => v || '-' },
        ];
        rows = (data.data || []).map(r => ({
          ...r,
          shift_type_label: r.shift_type === 'morning' ? '早班' : r.shift_type === 'night' ? '晚班' : r.shift_type,
        }));
        footerNote = `统计周期：${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}。`;
        break;
      }

      default:
        return null;
    }

    return {
      title,
      subtitle,
      columns,
      rows,
      summaryData,
      footerNote,
      extraInfo,
    };
  };

  // 打印 — 使用隐藏 iframe，避免浏览器弹窗拦截
  const handlePrint = () => {
    const config = buildPrintConfig();
    if (!config) {
      message.warning('请先查询报表数据');
      return;
    }

    const payload = {
      title: config.title,
      subtitle: config.subtitle,
      orgName: '颐智康养中心',
      reportNo: `YZ-${reportType.toUpperCase()}-${dayjs().format('YYYYMMDD')}`,
      columns: config.columns,
      dataSource: config.rows.map((r, i) => ({ ...r, id: r.id || `row_${i}` })),
      summary: config.summaryData,
      footerNote: config.footerNote,
      showSignArea: true,
      extraHeaderInfo: config.extraInfo,
    };

    // 移除旧 iframe
    const oldFrame = document.getElementById('__print_iframe__');
    if (oldFrame) oldFrame.remove();

    // 创建隐藏 iframe
    const iframe = document.createElement('iframe');
    iframe.id = '__print_iframe__';
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;background:#fff;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const currentDate = dayjs().format('YYYY年MM月DD日');

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${payload.title} - 打印</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 12mm 15mm 15mm 15mm; }
          body {
            font-family: "SimSun", "宋体", "Microsoft YaHei", serif;
            font-size: 11pt;
            color: #000;
            line-height: 1.6;
            background: #fff;
          }

          .print-report { max-width: 100%; }

          .report-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .report-header .org-name {
            font-size: 16pt; font-weight: bold; letter-spacing: 4pt; margin: 0 0 6px 0;
          }
          .report-header .report-title {
            font-size: 14pt; font-weight: bold; margin: 0 0 4px 0;
          }
          .report-header .report-subtitle {
            font-size: 10pt; color: #333; margin: 0;
          }

          .report-info {
            display: flex; justify-content: space-between; font-size: 9pt;
            margin-bottom: 10px; padding: 0 4px; flex-wrap: wrap; gap: 4px;
          }

          table {
            width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 10px;
          }
          table th, table td {
            border: 1px solid #000; padding: 4px 5px; text-align: center; vertical-align: middle;
          }
          table thead th { background: #e8e8e8; font-weight: bold; }
          table tfoot td { font-weight: bold; background: #f0f0f0; }
          .col-number { text-align: right; }
          .col-text { text-align: left; }

          .report-footer { margin-top: 20px; font-size: 9pt; }
          .report-footer .sign-row {
            display: flex; justify-content: space-between; margin-top: 30px; padding: 0 10px;
          }
          .report-footer .sign-row span { min-width: 120px; }
          .report-footer .footer-note { margin-top: 16px; color: #555; font-size: 8pt; }
          .page-number { text-align: center; font-size: 8pt; color: #666; margin-top: 8px; }

          .toolbar {
            position: fixed; top: 0; left: 0; right: 0; z-index: 999;
            background: #1890ff; padding: 10px 20px; display: flex; gap: 10px;
          }
          .toolbar button {
            padding: 6px 18px; font-size: 13px; cursor: pointer; border: none;
            border-radius: 4px; background: #fff; color: #1890ff; font-weight: bold;
          }
          .toolbar button:hover { background: #e6f7ff; }
          .toolbar .btn-danger { background: #ff4d4f; color: #fff; }
          .toolbar .btn-danger:hover { background: #ff7875; }
          .report-content { margin-top: 56px; padding: 20px; }

          @media print {
            .toolbar { display: none !important; }
            .report-content { margin-top: 0; padding: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button onclick="window.print()">打印</button>
          <button class="btn-danger" onclick="window.parent.document.getElementById('__print_iframe__').remove()">关闭</button>
        </div>
        <div class="report-content" id="report-root"></div>
      </body>
      </html>
    `);
    doc.close();

    // 渲染报表
    const render = () => {
      const root = doc.getElementById('report-root');
      const cols = payload.columns || [];
      const rows = payload.dataSource || [];
      const summary = payload.summary;

      let html = '<div class="print-report">';

      // 表头
      html += '<div class="report-header">';
      html += '<p class="org-name">' + (payload.orgName || '颐智康养中心') + '</p>';
      html += '<p class="report-title">' + (payload.title || '报表') + '</p>';
      if (payload.subtitle) html += '<p class="report-subtitle">' + payload.subtitle + '</p>';
      html += '</div>';

      // 信息栏
      html += '<div class="report-info">';
      html += '<span>报表编号：' + (payload.reportNo || '-') + '</span>';
      html += '<span>制表日期：' + currentDate + '</span>';
      html += '<span>单位：' + (payload.orgName || '颐智康养中心') + '</span>';
      if (payload.extraHeaderInfo) html += '<span>' + payload.extraHeaderInfo + '</span>';
      html += '</div>';

      // 表格
      html += '<table><thead><tr><th style="width:40px">序号</th>';
      cols.forEach(function(c) {
        var w = c.width ? ' style="width:' + c.width + 'px"' : '';
        html += '<th' + w + '>' + (c.title || '') + '</th>';
      });
      html += '</tr></thead><tbody>';

      if (rows.length === 0) {
        html += '<tr><td colspan="' + (cols.length + 1) + '" style="padding:30px;color:#999;">暂无数据</td></tr>';
      } else {
        rows.forEach(function(row, i) {
          html += '<tr><td>' + (i + 1) + '</td>';
          cols.forEach(function(c) {
            var val = row[c.key];
            if (c.render && typeof c.render === 'function') {
              val = c.render(val, row);
            } else if (val === null || val === undefined) {
              val = '-';
            } else if (typeof val === 'number') {
              val = val.toLocaleString();
            } else {
              val = String(val);
            }
            var cls = c.align === 'right' ? 'col-number' : (c.align === 'left' ? 'col-text' : '');
            html += '<td class="' + cls + '">' + val + '</td>';
          });
          html += '</tr>';
        });
      }
      html += '</tbody>';

      // 汇总行
      if (summary) {
        html += '<tfoot><tr><td>' + (summary.label || '合计') + '</td>';
        cols.forEach(function(c, ci) {
          var val = summary.data[c.key];
          if (c.render && typeof c.render === 'function') {
            val = c.render(val, summary.data);
          } else if (val === undefined || val === null) {
            val = ci === 0 ? '' : '-';
          } else if (typeof val === 'number') {
            val = val.toLocaleString();
          } else {
            val = String(val);
          }
          var cls = c.align === 'right' ? 'col-number' : '';
          html += '<td class="' + cls + '">' + val + '</td>';
        });
        html += '</tr></tfoot>';
      }

      html += '</table>';

      // 签字区
      if (payload.showSignArea !== false) {
        html += '<div class="report-footer">';
        html += '<div class="sign-row">';
        html += '<span>制表人：_______________</span>';
        html += '<span>审核人：_______________</span>';
        html += '<span>批准人：_______________</span>';
        html += '</div>';
        if (payload.footerNote) {
          html += '<p class="footer-note">' + payload.footerNote + '</p>';
        }
        html += '</div>';
      }

      html += '<div class="page-number">- 第 1 页 -</div>';
      html += '</div>';

      root.innerHTML = html;
    };

    // iframe 加载完再渲染
    iframe.onload = function() {
      render();
      // 自动弹出打印
      setTimeout(function() { iframe.contentWindow.print(); }, 300);
    };
  };

  // 导出Excel — 复用 buildPrintConfig，包含标题头、信息栏、表格、汇总、签字区
  const exportExcel = () => {
    const config = buildPrintConfig();
    if (!config) {
      message.warning('请先查询报表数据');
      return;
    }

    const sheetName = config.title;
    const totalCols = config.columns.length + 1; // +1 是序号列
    const aoa = []; // 二维数组

    // 行1：机构名称（大标题，居中合并）
    aoa.push(['颐智康养中心']);
    // 行2：报表名称
    aoa.push([config.title]);
    // 行3：副标题
    aoa.push([config.subtitle]);
    // 行4：空行
    aoa.push([]);

    // 行5：信息栏
    const infoLine = [];
    infoLine.push(`报表编号：YZ-${reportType.toUpperCase()}-${dayjs().format('YYYYMMDD')}`);
    infoLine.push(`制表日期：${dayjs().format('YYYY年MM月DD日')}`);
    infoLine.push(`单位：颐智康养中心`);
    if (config.extraInfo) infoLine.push(config.extraInfo);
    aoa.push(infoLine);
    // 行6：空行
    aoa.push([]);

    // 行7：表头
    aoa.push(['序号', ...config.columns.map(c => c.title)]);

    // 数据行
    config.rows.forEach((row, idx) => {
      const dataRow = [idx + 1];
      config.columns.forEach(col => {
        let val = row[col.key];
        if (col.render && typeof col.render === 'function') {
          val = col.render(val, row);
        } else if (val === null || val === undefined) {
          val = '-';
        } else if (typeof val === 'number') {
          val = val;
        } else {
          val = String(val);
        }
        dataRow.push(val);
      });
      aoa.push(dataRow);
    });

    // 汇总行
    if (config.summaryData) {
      const summaryRow = [config.summaryData.label || '合计'];
      config.columns.forEach((col, ci) => {
        let val = config.summaryData.data[col.key];
        if (col.render && typeof col.render === 'function') {
          val = col.render(val, config.summaryData.data);
        } else if (val === undefined || val === null) {
          val = ci === 0 ? '' : '-';
        } else if (typeof val === 'number') {
          val = val;
        } else {
          val = String(val);
        }
        summaryRow.push(val);
      });
      aoa.push(summaryRow);
    }

    // 空行
    aoa.push([]);
    aoa.push([]);

    // 签字区
    aoa.push(['制表人：_______________', '', '审核人：_______________', '', '批准人：_______________']);
    // 附注
    if (config.footerNote) {
      aoa.push([config.footerNote]);
    }

    // 生成 Sheet
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 }, // 序号
      ...config.columns.map(c => ({ wch: c.width ? Math.max(c.width / 7, 8) : 14 })),
    ];

    // 合并标题行（跨所有列）
    const mergeEndCol = XLSX.utils.encode_col(totalCols - 1);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }, // 机构名称
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } }, // 报表名称
      { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } }, // 副标题
    ];

    // 写入文件
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const filename = `${sheetName}_${dayjs().format('YYYYMMDD')}.xlsx`;
    XLSX.writeFile(wb, filename);
    message.success(`已导出：${filename}`);
  };

  // ==================== 渲染各报表表格（屏幕预览用） ====================

  const renderOccupancyTable = () => {
    const columns = [
      { title: '月份', dataIndex: 'label', key: 'label', width: 100 },
      { title: '月初在住', dataIndex: 'begin_count', key: 'begin_count', width: 90 },
      { title: '新入住', dataIndex: 'new_checkins', key: 'new_checkins', width: 80 },
      { title: '退住', dataIndex: 'checkouts', key: 'checkouts', width: 80 },
      { title: '月末在住', dataIndex: 'end_count', key: 'end_count', width: 90 },
      { title: '总床位', dataIndex: 'total_beds', key: 'total_beds', width: 80 },
      {
        title: '入住率', dataIndex: 'occupancy_rate', key: 'occupancy_rate', width: 90,
        render: (v) => <Tag color={v >= 80 ? 'green' : v >= 60 ? 'orange' : 'red'}>{v}%</Tag>,
      },
    ];
    return <Table rowKey="label" columns={columns} dataSource={data?.data || []} pagination={false} size="small" bordered />;
  };

  const renderRevenueTable = () => {
    const columns = [
      { title: '月份', dataIndex: 'label', key: 'label', width: 100 },
      { title: '账单数', dataIndex: 'total_bills', key: 'total_bills', width: 80 },
      { title: '应收(元)', dataIndex: 'total_amount', key: 'total_amount', width: 110, render: v => v.toLocaleString() },
      { title: '实收(元)', dataIndex: 'paid_amount', key: 'paid_amount', width: 110, render: v => v.toLocaleString() },
      { title: '欠费(元)', dataIndex: 'unpaid_amount', key: 'unpaid_amount', width: 110, render: v => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{v.toLocaleString()}</span> },
      { title: '欠费笔数', dataIndex: 'unpaid_count', key: 'unpaid_count', width: 80 },
      { title: '逾期笔数', dataIndex: 'overdue_count', key: 'overdue_count', width: 80 },
      { title: '收费率', dataIndex: 'collection_rate', key: 'collection_rate', width: 80, render: v => <Tag color={v >= 95 ? 'green' : 'orange'}>{v}%</Tag> },
    ];
    return <Table rowKey="label" columns={columns} dataSource={data?.data || []} pagination={false} size="small" bordered />;
  };

  const renderCareWorkloadTable = () => {
    if (!data?.data) return null;
    const columns = [
      { title: '护理员', dataIndex: 'nurse_name', key: 'nurse_name', width: 100 },
      { title: '总护理次数', dataIndex: 'total_count', key: 'total_count', width: 100, sorter: (a, b) => a.total_count - b.total_count },
      { title: '异常次数', dataIndex: 'abnormal_count', key: 'abnormal_count', width: 90, render: v => v > 0 ? <Tag color="red">{v}</Tag> : <Tag>{v}</Tag> },
      {
        title: '分类明细', key: 'details', render: (_, r) => (
          <Space size={[4, 4]} wrap>
            {r.details.map(d => (
              <Tag key={d.care_type}>{d.care_type}: {d.count}次{d.abnormal_count > 0 ? `(异常${d.abnormal_count})` : ''}</Tag>
            ))}
          </Space>
        ),
      },
    ];
    return <Table rowKey="nurse_id" columns={columns} dataSource={data.data} pagination={false} size="small" bordered />;
  };

  const renderMedicationTable = () => {
    if (!data?.data) return null;
    const { summary, by_elder } = data.data;
    return (
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Statistic title="总服药记录" value={summary.total} /></Col>
          <Col span={6}><Statistic title="已服用" value={summary.taken} valueStyle={{ color: '#52c41a' }} /></Col>
          <Col span={6}><Statistic title="漏服" value={summary.missed} valueStyle={{ color: '#ff4d4f' }} /></Col>
          <Col span={6}><Statistic title="依从率" value={summary.compliance_rate} suffix="%" valueStyle={{ color: summary.compliance_rate >= 90 ? '#52c41a' : '#ff4d4f' }} /></Col>
        </Row>
        <Table
          rowKey="elder_id"
          columns={[
            { title: '老人', dataIndex: 'elder_name', key: 'elder_name' },
            { title: '已服', dataIndex: 'taken', key: 'taken' },
            { title: '漏服', dataIndex: 'missed', key: 'missed', render: v => v > 0 ? <Tag color="red">{v}</Tag> : <Tag>{v}</Tag> },
            { title: '依从率', key: 'rate', render: (_, r) => {
              const rate = r.taken + r.missed > 0 ? Math.round(r.taken / (r.taken + r.missed) * 100) : 0;
              return <Tag color={rate >= 90 ? 'green' : 'red'}>{rate}%</Tag>;
            }},
          ]}
          dataSource={by_elder}
          pagination={false}
          size="small"
          bordered
        />
      </>
    );
  };

  const renderHealthTable = () => {
    if (!data?.data) return null;
    const columns = [
      { title: '老人', dataIndex: 'elder_name', key: 'elder_name', width: 80, fixed: 'left' },
      { title: '房号', dataIndex: 'room_number', key: 'room_number', width: 70 },
      { title: '记录数', dataIndex: 'record_count', key: 'record_count', width: 70 },
      { title: '异常', dataIndex: 'abnormal_count', key: 'abnormal_count', width: 60, render: v => v > 0 ? <Tag color="red">{v}</Tag> : <Tag>{v}</Tag> },
      { title: '平均收缩压', dataIndex: 'avg_systolic', key: 'avg_systolic', width: 100 },
      { title: '平均舒张压', dataIndex: 'avg_diastolic', key: 'avg_diastolic', width: 100 },
      { title: '平均心率', dataIndex: 'avg_heart_rate', key: 'avg_heart_rate', width: 80 },
      { title: '平均血糖', dataIndex: 'avg_blood_sugar', key: 'avg_blood_sugar', width: 80 },
      { title: '平均体温', dataIndex: 'avg_temperature', key: 'avg_temperature', width: 80 },
      { title: '平均血氧', dataIndex: 'avg_oxygen', key: 'avg_oxygen', width: 80 },
    ];
    return <Table rowKey="elder_id" columns={columns} dataSource={data.data} pagination={false} size="small" bordered scroll={{ x: 1000 }} />;
  };

  const renderAlertSummary = () => {
    if (!data?.data) return null;
    const { summary, by_indicator, by_elder } = data.data;
    return (
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Statistic title="告警总数" value={summary.total} /></Col>
          <Col span={6}><Statistic title="未处理" value={summary.unresolved} valueStyle={{ color: summary.unresolved > 0 ? '#ff4d4f' : '#52c41a' }} /></Col>
          <Col span={6}><Statistic title="警告" value={summary.warning} valueStyle={{ color: '#fa8c16' }} /></Col>
          <Col span={6}><Statistic title="严重" value={summary.critical} valueStyle={{ color: '#ff4d4f' }} /></Col>
        </Row>
        <Tabs items={[
          {
            key: 'indicator', label: '按指标类型',
            children: (
              <Table rowKey="indicator" size="small" bordered pagination={false}
                columns={[
                  { title: '指标', dataIndex: 'indicator', key: 'indicator', render: v => INDICATOR_LABELS[v] || v },
                  { title: '总数', dataIndex: 'total', key: 'total' },
                  { title: '警告', dataIndex: 'warning', key: 'warning', render: v => <Tag color="orange">{v}</Tag> },
                  { title: '严重', dataIndex: 'critical', key: 'critical', render: v => <Tag color="red">{v}</Tag> },
                  { title: '未处理', dataIndex: 'unresolved', key: 'unresolved', render: v => v > 0 ? <Tag color="red">{v}</Tag> : <Tag>{v}</Tag> },
                ]}
                dataSource={by_indicator}
              />
            ),
          },
          {
            key: 'elder', label: '按老人',
            children: (
              <Table rowKey="elder_id" size="small" bordered pagination={false}
                columns={[
                  { title: '老人', dataIndex: 'elder_name', key: 'elder_name' },
                  { title: '告警数', dataIndex: 'total', key: 'total' },
                  { title: '未处理', dataIndex: 'unresolved', key: 'unresolved', render: v => v > 0 ? <Tag color="red">{v}</Tag> : <Tag>{v}</Tag> },
                ]}
                dataSource={by_elder}
              />
            ),
          },
        ]} />
      </>
    );
  };

  const renderShiftTable = () => {
    if (!data?.data) return null;
    const columns = [
      { title: '日期', dataIndex: 'shift_date', key: 'shift_date', width: 110 },
      { title: '班次', dataIndex: 'shift_type', key: 'shift_type', width: 70, render: v => <Tag color={v === 'morning' ? 'blue' : 'purple'}>{v === 'morning' ? '早班' : '晚班'}</Tag> },
      { title: '交班人', dataIndex: 'from_nurse', key: 'from_nurse', width: 80 },
      { title: '接班人', dataIndex: 'to_nurse', key: 'to_nurse', width: 80 },
      { title: '交班概要', dataIndex: 'summary', key: 'summary', ellipsis: true },
      { title: '注意事项', dataIndex: 'special_notes', key: 'special_notes', ellipsis: true, render: v => v || '-' },
    ];
    return <Table rowKey="id" columns={columns} dataSource={data.data} pagination={{ pageSize: 20 }} size="small" bordered />;
  };

  // 根据报表类型渲染对应表格
  const renderTable = () => {
    switch (reportType) {
      case 'occupancy': return renderOccupancyTable();
      case 'revenue': return renderRevenueTable();
      case 'care-workload': return renderCareWorkloadTable();
      case 'medication-compliance': return renderMedicationTable();
      case 'health-summary': return renderHealthTable();
      case 'alert-summary': return renderAlertSummary();
      case 'shift-summary': return renderShiftTable();
      default: return null;
    }
  };

  // 是否需要日期范围筛选
  const needsDateRange = ['care-workload', 'medication-compliance', 'shift-summary'].includes(reportType);
  const needsOptionalDateRange = ['health-summary', 'alert-summary'].includes(reportType);
  const needsYearMonth = ['occupancy', 'revenue'].includes(reportType);
  const needsElder = ['health-summary'].includes(reportType);
  const needsShiftType = ['shift-summary'].includes(reportType);

  return (
    <div ref={printRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>报表中心</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchReport}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={exportExcel} type="primary" ghost>导出Excel</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint} type="primary">打印</Button>
        </Space>
      </div>

      {/* 筛选条件区 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <span style={{ fontWeight: 600 }}>报表类型：</span>
          <Select value={reportType} onChange={handleTypeChange} style={{ width: 180 }}>
            {REPORT_TYPES.map(r => (
              <Select.Option key={r.key} value={r.key}>{r.icon} {r.label}</Select.Option>
            ))}
          </Select>

          {needsYearMonth && (
            <>
              <Select value={year} onChange={setYear} style={{ width: 80 }}>
                {[2024, 2025, 2026, 2027, 2028].map(y => <Select.Option key={y} value={y}>{y}年</Select.Option>)}
              </Select>
              <Select value={month} onChange={setMonth} allowClear placeholder="全年" style={{ width: 80 }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <Select.Option key={m} value={m}>{m}月</Select.Option>
                ))}
              </Select>
            </>
          )}

          {(needsDateRange || needsOptionalDateRange) && (
            <RangePicker value={dateRange} onChange={setDateRange} format="YYYY-MM-DD" />
          )}

          {needsElder && (
            <Select value={elderId} onChange={setElderId} allowClear placeholder="选择老人" style={{ width: 150 }}>
              {elders.map(e => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
            </Select>
          )}

          {needsShiftType && (
            <Select value={shiftType} onChange={setShiftType} allowClear placeholder="班次" style={{ width: 100 }}>
              <Select.Option value="morning">早班</Select.Option>
              <Select.Option value="night">晚班</Select.Option>
            </Select>
          )}

          <Button type="primary" onClick={fetchReport} loading={loading}>查询</Button>
        </Space>
      </Card>

      {/* 数据表格区 */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载报表数据..." /></div>
        ) : data ? (
          renderTable()
        ) : (
          <div style={{ textAlign: 'center', padding: 80, color: '#8c8c8c' }}>
            <p style={{ fontSize: 48, margin: 0 }}>📊</p>
            <p style={{ marginTop: 16 }}>选择报表类型并点击"查询"按钮获取数据</p>
          </div>
        )}
      </Card>
    </div>
  );
}
