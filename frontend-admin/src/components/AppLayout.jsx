import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  HeartOutlined,
  DollarOutlined,
  MedicineBoxOutlined,
  SwapOutlined,
  LineChartOutlined,
  AlertOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  FileProtectOutlined,
  SettingOutlined,
  UserOutlined,
  SafetyOutlined,
  LogoutOutlined,
  ProfileOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { clearUser } from '../utils/sentry';

const { Header, Sider, Content } = Layout;

// 菜单配置：key=路由, icon, label, required=需要的权限code
const allMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '院长看板', required: [] },
  { key: '/elders', icon: <TeamOutlined />, label: '老人管理', required: ['elder:view'] },
  { key: '/care-records', icon: <HeartOutlined />, label: '护理记录', required: ['care:view'] },
  { key: '/bills', icon: <DollarOutlined />, label: '费用账单', required: ['bill:view'] },
  { key: '/contracts', icon: <ProfileOutlined />, label: '合同付款', required: ['contract:view'] },
  { key: '/medications', icon: <MedicineBoxOutlined />, label: '用药管理', required: ['medication:view'] },
  { key: '/approvals', icon: <FileProtectOutlined />, label: '审批管理', required: ['approval:view'] },
  { key: '/shifts', icon: <SwapOutlined />, label: '交接班', required: ['shift:view'] },
  { key: '/vital-signs', icon: <LineChartOutlined />, label: '生命体征', required: ['vital:view'] },
  { key: '/alerts', icon: <AlertOutlined />, label: '告警中心', required: ['alert:view'] },
  { key: '/video-monitoring', icon: <VideoCameraOutlined />, label: '视频监控', required: ['monitor:view'] },
  { key: '/reports', icon: <FileTextOutlined />, label: '报表中心', required: ['report:view'] },
  // 系统设置子菜单
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
    children: [
      { key: '/users', icon: <UserOutlined />, label: '用户管理', required: ['system:user'] },
      { key: '/roles', icon: <SafetyOutlined />, label: '角色管理', required: ['system:role'] },
      { key: '/audit-logs', icon: <AuditOutlined />, label: '审计日志', required: ['system:user'] },
    ],
  },
];

function filterMenu(items, hasPermission) {
  return items
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter(
          (c) => !c.required?.length || c.required.some((code) => hasPermission(code))
        );
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }
      if (!item.required?.length) return item;
      if (item.required.some((code) => hasPermission(code))) return item;
      return null;
    })
    .filter(Boolean);
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission } = useAuth();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    clearUser();
    navigate('/login');
  };

  const menuItems = filterMenu(allMenuItems, hasPermission);

  // 计算当前选中项：先匹配完整路径，再匹配父级
  const selectedKey =
    menuItems
      .flatMap((i) => (i.children ? [i, ...i.children] : [i]))
      .map((i) => i.key)
      .find((k) => location.pathname.startsWith(k)) || '/dashboard';

  const openKeys = ['/settings'];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{ background: '#fff' }}
      >
        <div style={{ padding: '20px 16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>颐智康养</div>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{user?.real_name || '未登录'}</div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => {
            if (key === 'logout') return;
            navigate(key);
          }}
          style={{ borderRight: 0, marginTop: 8 }}
        />
        <div style={{ position: 'absolute', bottom: 20, width: '100%', padding: '0 16px' }}>
          <Menu
            mode="inline"
            items={[{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录' }]}
            onClick={handleLogout}
            style={{ borderRight: 0 }}
          />
        </div>
      </Sider>
      <Layout>
        <Content style={{ margin: 16, background: '#fff', borderRadius: 12, padding: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
