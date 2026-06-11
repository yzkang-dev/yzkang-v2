颐智康养 - 养老机构数字化管理平台

版本：v0.1.0-mvp
技术栈：Python FastAPI + React + Ant Design + PostgreSQL


项目结构

颐智康养/
├── backend/          # 后端 API 服务
│   ├── main.py       # FastAPI 主入口
│   ├── config.py     # 全局配置
│   ├── models.py     # 数据库模型
│   ├── schemas.py    # 数据校验
│   ├── auth.py       # 用户认证
│   ├── routers/      # API 路由
│   │   ├── auth_router.py   # 登录/注册
│   │   ├── elders.py        # 老人管理
│   │   ├── care_records.py  # 护理记录
│   │   ├── bills.py         # 费用账单
│   │   └── dashboard.py     # 院长看板
│   └── requirements.txt
├── frontend-admin/   # 管理后台前端
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx        # 登录页
│       │   ├── Dashboard.jsx    # 院长看板
│       │   ├── ElderList.jsx    # 老人列表
│       │   ├── ElderDetail.jsx  # 老人详情
│       │   ├── CareRecords.jsx  # 护理记录
│       │   └── Bills.jsx        # 费用账单
│       └── components/
│           └── AppLayout.jsx    # 布局框架
├── miniapp/          # 微信小程序（待开发）
└── docs/             # 文档


快速启动

后端：
  cd backend
  pip install -r requirements.txt
  python main.py
  访问 http://localhost:8000/docs 查看 API 文档

前端：
  cd frontend-admin
  npm install
  npm run dev
  访问 http://localhost:3000


API 接口列表

认证：
  POST /api/auth/register    注册
  POST /api/auth/login       登录

老人管理：
  GET    /api/elders/           列表
  GET    /api/elders/{id}       详情
  POST   /api/elders/           登记入住
  PUT    /api/elders/{id}       更新信息
  POST   /api/elders/{id}/checkout  办理退住

护理记录：
  GET    /api/care-records/       列表
  POST   /api/care-records/       新增
  GET    /api/care-records/today  今日记录

费用账单：
  GET    /api/bills/            列表
  POST   /api/bills/            创建
  POST   /api/bills/{id}/pay   确认缴费
  GET    /api/bills/overdue     逾期账单

院长看板：
  GET    /api/dashboard/        数据总览

健康检查：
  GET    /api/health            服务状态
