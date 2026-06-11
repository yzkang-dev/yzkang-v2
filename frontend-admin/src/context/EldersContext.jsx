import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../api';

const EldersContext = createContext(null);

/** 缓存有效期：5分钟 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 老人列表全局缓存
 * 
 * 解决 7 个页面各自请求 /elders/ 的重复请求问题。
 * 首次加载后缓存 5 分钟，超时自动刷新。
 */
export function EldersProvider({ children }) {
  const [elders, setElders] = useState([]);           // 全量老人列表
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef(0);

  const fetchElders = useCallback(async (force = false) => {
    const now = Date.now();
    // 缓存未过期且不强制刷新，跳过
    if (!force && elders.length > 0 && now - lastFetchRef.current < CACHE_TTL) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/elders/', { params: { page_size: 500 } });
      setElders(res.data);
      lastFetchRef.current = now;
    } catch {
      // 静默失败，不影响使用
    } finally {
      setLoading(false);
    }
  }, [elders.length]);

  useEffect(() => {
    fetchElders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 拿到某个老人 */
  const getElder = useCallback((id) => {
    return elders.find((e) => e.id === id) || null;
  }, [elders]);

  /** 筛选老人（按状态、关键词） */
  const filterElders = useCallback(({ status, keyword } = {}) => {
    let list = [...elders];
    if (status) list = list.filter((e) => e.status === status);
    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter((e) =>
        e.name?.toLowerCase().includes(kw) ||
        e.room_number?.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [elders]);

  return (
    <EldersContext.Provider value={{
      elders, loading, fetchElders, getElder, filterElders,
    }}>
      {children}
    </EldersContext.Provider>
  );
}

export function useElders() {
  const ctx = useContext(EldersContext);
  if (!ctx) throw new Error('useElders 必须在 EldersProvider 内部使用');
  return ctx;
}
