import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });
  const [permissions, setPermissions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('permissions') || '[]');
    } catch {
      return [];
    }
  });

  // 登录后调用，保存用户信息
  const setAuth = (data) => {
    setUser({
      username: data.username,
      real_name: data.real_name,
      role: data.role,
      role_id: data.role_id,
    });
    setPermissions(data.permissions || []);
    localStorage.setItem('user', JSON.stringify({
      username: data.username,
      real_name: data.real_name,
      role: data.role,
      role_id: data.role_id,
    }));
    localStorage.setItem('permissions', JSON.stringify(data.permissions || []));
  };

  // 刷新当前用户信息（含权限）
  const refreshMe = async () => {
    try {
      const res = await api.get('/auth/me');
      setAuth(res.data);
    } catch {
      // ignore
    }
  };

  // 检查是否有某权限
  const hasPermission = (code) => {
    return permissions.includes('*') || permissions.includes(code);
  };

  // 检查是否有任一权限
  const hasAnyPermission = (codes) => {
    if (permissions.includes('*')) return true;
    return codes.some((c) => permissions.includes(c));
  };

  useEffect(() => {
    // 页面刷新时，如果已登录，刷新权限
    if (localStorage.getItem('token')) {
      refreshMe();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, permissions, hasPermission, hasAnyPermission, setAuth, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
