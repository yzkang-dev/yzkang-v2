import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Switch, message, Popconfirm, Tag, Space,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import api from '../api';
import useApi from '../hooks/useApi';

// 密码强度校验规则
const passwordRules = [
  { required: true, message: '请输入密码' },
  { min: 8, message: '密码长度至少8位' },
  { pattern: /[A-Z]/, message: '密码必须包含大写字母' },
  { pattern: /[a-z]/, message: '密码必须包含小写字母' },
  { pattern: /\d/, message: '密码必须包含数字' },
  { pattern: /[!@#$%^&*(),.?":{}|<>~`[\]\\/;'=_+\-]/, message: '密码必须包含特殊字符' },
];

export default function UserManagement() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState(null);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const { data: users, loading, refetch } = useApi(
    () => api.get('/admin/users/'),
    { defaultData: [], deps: [] }
  );

  const { data: roles } = useApi(
    () => api.get('/admin/roles'),
    { defaultData: [], deps: [] }
  );

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      real_name: record.real_name,
      phone: record.phone,
      role_id: record.role_id,
      is_active: record.is_active,
    });
    setModalOpen(true);
  };

  const handleResetPwd = (record) => {
    setPwdTarget(record);
    pwdForm.resetFields();
    setPwdModalOpen(true);
  };

  const onSubmit = async (values) => {
    try {
      if (editingUser) {
        await api.put(`/admin/users/${editingUser.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/admin/users/', { ...values, password: values.password || '123456' });
        message.success('创建成功');
      }
      setModalOpen(false);
      refetch();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      message.success('删除成功');
      refetch();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const onPwdSubmit = async (values) => {
    try {
      await api.put(`/admin/users/${pwdTarget.id}`, { password: values.password });
      message.success('密码重置成功');
      setPwdModalOpen(false);
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'real_name' },
    { title: '手机号', dataIndex: 'phone' },
    {
      title: '角色',
      dataIndex: 'role_name',
      render: (v) => v || <Tag color="default">未分配</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (v) => (v ? <Tag color="success">正常</Tag> : <Tag color="error">禁用</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" icon={<KeyOutlined />} onClick={() => handleResetPwd(record)}>重置密码</Button>
          <Popconfirm title="确认删除？" onConfirm={() => onDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>用户管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增用户</Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={users} loading={loading} pagination={{ pageSize: 10 }} />

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          {!editingUser && (
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="用户名" />
            </Form.Item>
          )}
          <Form.Item name="real_name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="手机号" />
          </Form.Item>
          <Form.Item name="role_id" label="角色">
            <Select placeholder="选择角色" allowClear>
              {roles.map((r) => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="初始密码" rules={passwordRules}>
              <Input.Password placeholder="至少8位，含大小写字母、数字、特殊字符" />
            </Form.Item>
          )}
          <Form.Item name="is_active" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="正常" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 - ${pwdTarget?.real_name || ''}`}
        open={pwdModalOpen}
        onOk={() => pwdForm.submit()}
        onCancel={() => setPwdModalOpen(false)}
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical" onFinish={onPwdSubmit}>
          <Form.Item name="password" label="新密码" rules={passwordRules}>
            <Input.Password placeholder="至少8位，含大小写字母、数字、特殊字符" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
