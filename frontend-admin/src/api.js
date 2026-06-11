import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
});

// ==================== Token 自动刷新 ====================

let isRefreshing = false;           // 是否正在刷新中
let failedQueue = [];               // 刷新期间挂起的请求队列

const processQueue = (error, token = null) => {
  // 刷新完成后处理队列中的所有请求
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

// 请求拦截：自动带 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 根据 HTTP 状态码返回用户可读的错误消息 */
function getErrorMessage(status, data, url) {
  switch (status) {
    case 400:
      return data?.detail || '请求参数有误';
    case 403:
      return data?.detail || '权限不足，无法执行此操作';
    case 404:
      return data?.detail || '请求的资源不存在';
    case 409:
      return data?.detail || '数据冲突，可能已存在重复记录';
    case 422: {
      // 优先展示第一个字段的具体错误
      if (data?.errors && data.errors.length > 0) {
        const e = data.errors[0];
        return `${e.field}: ${e.msg}`;
      }
      return data?.detail || '请求参数校验失败';
    }
    case 429:
      return '请求过于频繁，请稍后重试';
    case 500:
      return '服务器内部错误，请稍后重试';
    default:
      return data?.detail || `请求失败 (${status})`;
  }
}

// 响应拦截：401 自动刷新 + 统一错误提示
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // 无网络响应
    if (!err.response) {
      if (err.code === 'ECONNABORTED') {
        console.error('[API] 请求超时:', originalRequest?.url);
        message.warning('请求超时，请检查网络');
      } else {
        console.error('[API] 网络错误:', err.message);
        message.error('网络连接失败，请检查网络');
      }
      return Promise.reject(err);
    }

    const { status, data } = err.response;

    // ====== 401 自动刷新逻辑 ======
    if (status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
      // 如果正在刷新中，把请求挂到队列里等刷新完成
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          originalRequest.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        // 没有 refresh_token，直接踢到登录页
        isRefreshing = false;
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        message.warning('登录已过期，请重新登录');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      }

      try {
        // 拿 refresh_token 换新的 access_token
        const res = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/refresh`,
          { refresh_token: refreshToken }
        );
        const { access_token, refresh_token } = res.data;

        localStorage.setItem('token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        // 处理队列中等待的请求
        processQueue(null, access_token);

        // 重试原始请求
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        // 刷新也失败了 → 彻底登出
        processQueue(refreshErr, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        message.warning('登录已过期，请重新登录');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // ====== 统一错误提示（跳过 401，因为已经处理了） ======
    if (status !== 401) {
      const msg = getErrorMessage(status, data, originalRequest?.url);
      // 只在非静默请求时弹提示（避免干扰）
      if (originalRequest?.silent !== true) {
        message.error(msg);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
