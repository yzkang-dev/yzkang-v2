#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成软著申请材料：
1. 源代码文档（前30页+后30页，每页50行）
2. 软件说明书（用户手册）
"""

import os
import sys
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent
# 输出目录
OUTPUT_DIR = PROJECT_ROOT / "docs" / "软著申请"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 需要排除的目录/文件
EXCLUDE_DIRS = {'node_modules', 'dist', '__pycache__', 'venv', '.git', 'docs'}
EXCLUDE_EXTS = {'.pyc', '.pyo', '.log'}

def get_source_files(project_root):
    """获取所有源代码文件"""
    source_files = []
    for root, dirs, files in os.walk(project_root):
        # 过滤排除目录
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            file_path = Path(root) / file
            # 只保留源代码文件
            if file_path.suffix in ['.py', '.jsx', '.js', '.css', '.html']:
                if file_path.suffix not in EXCLUDE_EXTS:
                    source_files.append(file_path)
    
    # 按文件路径排序，保证顺序稳定
    source_files.sort()
    return source_files

def count_lines(file_path):
    """统计文件行数"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return len(f.readlines())
    except:
        return 0

def read_file_content(file_path):
    """读取文件内容"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except:
        return ""

def generate_source_code_doc(source_files, output_path):
    """生成源代码文档（前30页+后30页，每页50行）"""
    # 收集所有代码行
    all_lines = []
    
    for file_path in source_files:
        rel_path = file_path.relative_to(PROJECT_ROOT)
        # 添加文件头注释
        header = f"# ========== {rel_path} =========="
        all_lines.append(header)
        
        content = read_file_content(file_path)
        lines = content.split('\n')
        all_lines.extend(lines)
    
    total_lines = len(all_lines)
    print(f"总代码行数: {total_lines}")
    
    # 软著要求：每页50行，前30页（1-1500行），后30页（最后1500行）
    page_size = 50
    lines_per_30_pages = 30 * page_size  # 1500行
    
    # 计算需要哪些行
    selected_lines = []
    
    if total_lines <= lines_per_30_pages * 2:
        # 代码不足3000行，提交全部代码
        print(f"代码不足3000行，提交全部代码（{total_lines}行）")
        selected_lines = all_lines
    else:
        # 代码超过3000行，取前1500行和后1500行
        print(f"代码超过3000行，取前1500行和后1500行")
        selected_lines.extend(all_lines[:lines_per_30_pages])  # 前30页
        selected_lines.extend(all_lines[-lines_per_30_pages:])  # 后30页
    
    print(f"选取行数: {len(selected_lines)}")
    
    # 使用 python-docx 生成 Word 文档
    try:
        from docx import Document
        from docx.shared import Pt, Inches
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        
        doc = Document()
        
        # 设置文档样式
        style = doc.styles['Normal']
        font = style.font
        font.name = '宋体'
        font.size = Pt(10.5)  # 小四号约等于10.5pt
        
        # 添加标题
        title = doc.add_heading('颐智康养SaaS系统 源代码', 0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # 分页处理
        current_page = 1
        page_lines = []
        
        for i, line in enumerate(selected_lines):
            page_lines.append(line)
            
            # 每50行一页
            if len(page_lines) >= page_size or i == len(selected_lines) - 1:
                # 添加页码
                p = doc.add_paragraph()
                p.add_run(f'第 {current_page} 页').bold = True
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                
                # 添加代码行
                for code_line in page_lines:
                    # 限制每行长度，避免溢出
                    if len(code_line) > 120:
                        code_line = code_line[:117] + '...'
                    doc.add_paragraph(code_line)
                
                # 分页（最后一页不分页）
                if i < len(selected_lines) - 1:
                    doc.add_page_break()
                
                current_page += 1
                page_lines = []
        
        # 保存文档
        doc.save(output_path)
        print(f"源代码文档已生成: {output_path}")
        return True
        
    except ImportError:
        # 如果没有 python-docx，生成纯文本
        print("未找到 python-docx，生成纯文本文件...")
        with open(output_path.with_suffix('.txt'), 'w', encoding='utf-8') as f:
            f.write(f"颐智康养SaaS系统 源代码\n")
            f.write(f"总页数: {len(selected_lines) // page_size + 1}\n\n")
            
            current_page = 1
            page_lines = []
            
            for i, line in enumerate(selected_lines):
                page_lines.append(line)
                
                if len(page_lines) >= page_size or i == len(selected_lines) - 1:
                    f.write(f"\n第 {current_page} 页\n")
                    f.write('-' * 80 + '\n')
                    for code_line in page_lines:
                        if len(code_line) > 120:
                            code_line = code_line[:117] + '...'
                        f.write(code_line + '\n')
                    f.write('-' * 80 + '\n')
                    current_page += 1
                    page_lines = []
        
        print(f"纯文本源代码文档已生成: {output_path.with_suffix('.txt')}")
        return True

def generate_user_manual(output_path):
    """生成软件说明书（用户手册）"""
    try:
        from docx import Document
        from docx.shared import Pt, Inches
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        
        doc = Document()
        
        # 设置文档样式
        style = doc.styles['Normal']
        font = style.font
        font.name = '宋体'
        font.size = Pt(12)
        
        # 标题
        title = doc.add_heading('颐智康养SaaS系统 用户手册', 0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # 版本信息
        doc.add_paragraph('版本：V2.0')
        doc.add_paragraph('日期：2026年6月')
        doc.add_paragraph('\n')
        
        # 目录结构（软件功能模块）
        sections = [
            ('1. 系统概述', [
                '颐智康养SaaS系统是一款面向养老机构、康复医院、日间照料中心及居家养老服务的数字化管理平台。',
                '系统采用模块化设计，可灵活适配不同规模的养老服务机构。',
                '技术架构：前端 React + Ant Design，后端 FastAPI + SQLite，支持小程序端。'
            ]),
            ('2. 功能模块', [
                '2.1 老人管理：老人信息录入、查询、详情查看、入住/退住管理',
                '2.2 护理记录：日常护理记录、护理计划、护理任务分配',
                '2.3 费用管理：账单生成、费用明细、账单审核、打印',
                '2.4 用药管理：药品信息、用药记录、用药提醒',
                '2.5 交接班管理：班次安排、交接记录、工作日志',
                '2.6 体征监测：体温、血压、血糖等体征数据记录与趋势分析',
                '2.7 告警管理：异常告警、告警处理、告警统计',
                '2.8 报表管理：各类统计报表、数据导出',
                '2.9 审批管理：各类申请审批流程',
                '2.10 合同付款：合同管理、付款进度跟踪、付款看板',
                '2.11 权限管理：角色权限、用户管理、模块访问控制'
            ]),
            ('3. 使用说明', [
                '3.1 登录系统：使用账号密码登录，支持权限控制',
                '3.2 老人管理：进入「老人列表」可查看所有老人，点击可查看详情',
                '3.3 护理记录：在老人详情页可添加护理记录，系统自动生成护理计划',
                '3.4 费用管理：系统自动生成月度账单，支持打印和导出',
                '3.5 告警处理：收到告警后，护理人员需及时处理并填写处理结果',
                '3.6 报表查看：支持按时间、类型筛选报表，支持导出Excel',
                '3.7 审批流程：提交申请后，由主管审批，支持审批意见',
                '3.8 合同付款：查看合同付款进度，跟踪付款状态'
            ]),
            ('4. 运行环境', [
                '服务器端：Windows/Linux，Python 3.8+，FastAPI',
                '客户端：现代浏览器（Chrome、Firefox、Edge等）',
                '移动端：微信小程序',
                '数据库：SQLite（可扩展至MySQL/PostgreSQL）'
            ])
        ]
        
        for section_title, contents in sections:
            doc.add_heading(section_title, level=1)
            for content in contents:
                doc.add_paragraph(content)
        
        # 保存文档
        doc.save(output_path)
        print(f"用户手册已生成: {output_path}")
        return True
        
    except ImportError:
        print("未找到 python-docx，无法生成用户手册 Word 文档")
        return False

def main():
    print("=" * 60)
    print("颐智康养SaaS系统 - 软著申请材料生成工具")
    print("=" * 60)
    
    # 1. 获取所有源代码文件
    print("\n[1/3] 扫描源代码文件...")
    source_files = get_source_files(PROJECT_ROOT)
    print(f"找到 {len(source_files)} 个源代码文件")
    
    # 2. 生成源代码文档
    print("\n[2/3] 生成源代码文档...")
    source_code_path = OUTPUT_DIR / "颐智康养SaaS系统_源代码.docx"
    success1 = generate_source_code_doc(source_files, source_code_path)
    
    # 3. 生成用户手册
    print("\n[3/3] 生成用户手册...")
    manual_path = OUTPUT_DIR / "颐智康养SaaS系统_用户手册.docx"
    success2 = generate_user_manual(manual_path)
    
    print("\n" + "=" * 60)
    if success1 and success2:
        print("✅ 软著申请材料生成完成！")
        print(f"📁 输出目录: {OUTPUT_DIR}")
    else:
        print("⚠️ 部分文件生成失败，请检查依赖")
    print("=" * 60)

if __name__ == '__main__':
    main()
