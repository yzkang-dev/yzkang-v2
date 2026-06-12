import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Checkbox, message, Popconfirm, Tag, Space, Card, Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import useApi from '../hooks/useApi';

export default function RoleManagement() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();

  const { data: roles, loading, refetch } = useApi(
    () => api.get('/admin/roles'),
    { defaultData: [], deps: [] }
  );

  const { data: permissions } = useApi(
    () => api.get('/admin/permissions'),
    { defaultData: {}, deps: [], transform: (raw) => {
      const grouped = {};
      raw.forEach((p) => {
        if (!grouped[p.module]) grouped[p.module] = [];
        grouped[p.module].push(p);
      });
      return grouped;
    }}
  );

  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRole(record);
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      description: record.description,
      permission_ids: record.permissions.map((p) => p.id),
    });
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    try {
      if (editingRole) {
        await api.put(`/admin/roles/${editingRole.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/admin/roles', values);
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
      await api.delete(`/admin/roles/${id}`);
      message.success('删除成功');
      refetch();
    } catch {
      // 错误提示由 api.js 统一处理
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '角色名称', dataIndex: 'name' },
    { title: '角色代码', dataIndex: 'code' },
    { title: '描述', dataIndex: 'description' },
    {
      title: '类型',
      dataIndex: 'is_system',
      render: (v) => (v ? <Tag color="blue">系统内置</Tag> : <Tag>自定义</Tag>),
    },
    {
      title: '权限数',
      key: 'permCount',
      render: (_, record) => record.permissions?.length || 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} disabled={record.is_system}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => onDelete(record.id)} disabled={record.is_system}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={record.is_system}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>角色管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增角色</Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={roles} loading={loading} pagination={{ pageSize: 10 }} />

      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
            <Input placeholder="如：财务主管" />
          </Form.Item>
          <Form.Item name="code" label="角色代码" rules={[{ required: true }]}>
            <Input placeholder="如：finance_manager" disabled={!!editingRole} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="角色描述" rows={2} />
          </Form.Item>

          <Divider orientation="left">权限分配</Divider>
          <Form.Item name="permission_ids" initialValue={[]}>
            <Checkbox.Group style={{ width: '100%' }}>
              {Object.entries(permissions).map(([module, perms]) => (
                <Card key={module} size="small" title={module} style={{ marginBottom: 12 }}>
                  <Space wrap>
                    {perms.map((p) => (
                      <Checkbox key={p.id} value={p.id}>
                        {p.name}
                      </Checkbox>
                    ))}
                  </Space>
                </Card>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
