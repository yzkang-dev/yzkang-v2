import React from 'react';
import dayjs from 'dayjs';

/**
 * 打印级报表组件
 * 用于在浏览器中预览和打印A4纸规格的专业报表
 * 
 * 用法：
 *   <PrintableReport
 *     title="入住率统计报表"
 *     subtitle="2025年5月"
 *     orgName="颐智康养中心"
 *     columns={[{key:'name', title:'名称'}]}
 *     dataSource={[{name:'张三'}]}
 *     summary={{ label:'合计', data: {...} }}
 *     footerNote="注：本报表数据来源于系统自动统计"
 *   />
 */

// ========== 样式常量 ==========
const PRINT_STYLES = `
  @page {
    size: A4;
    margin: 12mm 15mm 15mm 15mm;
  }

  .print-report {
    font-family: "SimSun", "宋体", serif;
    font-size: 11pt;
    color: #000;
    line-height: 1.6;
    background: #fff;
    max-width: 100%;
  }

  /* 报表标题区 */
  .print-report .report-header {
    text-align: center;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }

  .print-report .report-header .org-name {
    font-size: 16pt;
    font-weight: bold;
    letter-spacing: 4pt;
    margin: 0 0 6px 0;
  }

  .print-report .report-header .report-title {
    font-size: 14pt;
    font-weight: bold;
    margin: 0 0 4px 0;
  }

  .print-report .report-header .report-subtitle {
    font-size: 10pt;
    color: #333;
    margin: 0;
  }

  /* 信息栏 */
  .print-report .report-info {
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
    margin-bottom: 10px;
    padding: 0 4px;
  }

  .print-report .report-info span {
    display: inline-block;
  }

  /* 表格 */
  .print-report table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-bottom: 10px;
  }

  .print-report table th,
  .print-report table td {
    border: 1px solid #000;
    padding: 4px 5px;
    text-align: center;
    vertical-align: middle;
  }

  .print-report table thead th {
    background: #e8e8e8;
    font-weight: bold;
    font-size: 9pt;
  }

  .print-report table tbody tr:nth-child(even) {
    background: #fafafa;
  }

  /* 汇总行 */
  .print-report table tfoot td {
    font-weight: bold;
    background: #f0f0f0;
  }

  /* 金额列右对齐 */
  .print-report .col-number {
    text-align: right;
    font-family: "SimHei", "黑体", sans-serif;
  }

  .print-report .col-text {
    text-align: left;
  }

  /* 底部 */
  .print-report .report-footer {
    margin-top: 20px;
    font-size: 9pt;
  }

  .print-report .report-footer .sign-row {
    display: flex;
    justify-content: space-between;
    margin-top: 30px;
    padding: 0 10px;
  }

  .print-report .report-footer .sign-row span {
    display: inline-block;
    min-width: 120px;
  }

  .print-report .report-footer .footer-note {
    margin-top: 16px;
    color: #555;
    font-size: 8pt;
  }

  .print-report .page-number {
    text-align: center;
    font-size: 8pt;
    color: #666;
    margin-top: 8px;
  }

  /* ===== 打印专用样式 ===== */
  @media print {
    body * {
      visibility: hidden;
    }
    .print-report,
    .print-report * {
      visibility: visible;
    }
    .print-report {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 0;
      margin: 0;
    }
    .print-report .no-print {
      display: none !important;
    }
    /* 强制黑白打印 */
    .print-report table thead th {
      background: #ddd !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-report table tfoot td {
      background: #eee !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }

  /* 屏幕预览时模拟纸张效果 */
  @media screen {
    .print-report-wrapper {
      background: #f0f2f5;
      padding: 20px;
      display: flex;
      justify-content: center;
    }
    .print-report {
      width: 210mm;
      min-height: 297mm;
      padding: 12mm 15mm;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      background: #fff;
      margin: 0 auto;
    }
  }
`;

export default function PrintableReport({
  title = '报表',
  subtitle = '',
  orgName = '颐智康养中心',
  reportNo = '',
  columns = [],
  dataSource = [],
  summary = null,
  footerNote = '',
  showSignArea = true,
  extraHeaderInfo = null,
}) {
  // 列宽估算
  const getColStyle = (col) => {
    const style = {};
    if (col.width) style.width = col.width;
    if (col.align === 'right') return { ...style };
    return style;
  };

  const getCellClass = (col) => {
    if (col.align === 'right') return 'col-number';
    if (col.align === 'left') return 'col-text';
    return '';
  };

  const formatCell = (col, value) => {
    if (value === null || value === undefined) return '-';
    if (col.render) return col.render(value);
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  };

  const currentDate = dayjs().format('YYYY年MM月DD日');

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div className="print-report-wrapper">
        <div className="print-report" id="printable-report-content">
          {/* ===== 表头 ===== */}
          <div className="report-header">
            <p className="org-name">{orgName}</p>
            <p className="report-title">{title}</p>
            {subtitle && <p className="report-subtitle">{subtitle}</p>}
          </div>

          {/* ===== 信息栏 ===== */}
          <div className="report-info">
            <span>报表编号：{reportNo || '-'}</span>
            <span>制表日期：{currentDate}</span>
            <span>单位：{orgName}</span>
            {extraHeaderInfo && <span>{extraHeaderInfo}</span>}
          </div>

          {/* ===== 数据表格 ===== */}
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>序号</th>
                {columns.map((col, i) => (
                  <th key={col.key || i} style={getColStyle(col)}>
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataSource.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 30, color: '#999' }}>
                    暂无数据
                  </td>
                </tr>
              ) : (
                dataSource.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td>{idx + 1}</td>
                    {columns.map((col, ci) => (
                      <td key={col.key || ci} className={getCellClass(col)}>
                        {formatCell(col, row[col.key], row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {summary && (
              <tfoot>
                <tr>
                  <td>{summary.label || '合计'}</td>
                  {columns.map((col, ci) => (
                    <td key={col.key || ci} className={getCellClass(col)}>
                      {summary.data[col.key] !== undefined
                        ? formatCell(col, summary.data[col.key])
                        : summary.data[col.key] === undefined && ci === 0
                          ? ''
                          : '-'}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>

          {/* ===== 底部签字区 ===== */}
          {showSignArea && (
            <div className="report-footer">
              <div className="sign-row">
                <span>制表人：_______________</span>
                <span>审核人：_______________</span>
                <span>批准人：_______________</span>
              </div>
              {footerNote && <p className="footer-note">{footerNote}</p>}
            </div>
          )}

          {/* ===== 页码 ===== */}
          <div className="page-number">- 第 1 页 -</div>
        </div>
      </div>
    </>
  );
}
