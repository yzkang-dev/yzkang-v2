import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 通用 API 数据请求 Hook
 * 
 * 封装了 loading / error / data / refetch 四件套，17个页面不再各自重复写 fetchData
 * 
 * @param {Function} apiCall  - 返回 Promise 的异步函数（通常是 api.get() 调用）
 * @param {Object}   options
 * @param {Array}    options.deps      - 依赖数组，变化时自动重新请求（默认 []）
 * @param {boolean}  options.immediate - 是否挂载时立即执行（默认 true）
 * @param {any}      options.defaultData - data 的初始值（默认 null）
 * @param {Function} options.transform   - 响应数据转换函数（默认恒等）
 * @param {Function} options.onError  - 自定义错误回调
 * @returns {{ data, loading, error, refetch, setData }}
 * 
 * @example
 *   const { data: elders, loading } = useApi(
 *     () => api.get('/elders/', { params: { status: 'checked_in' } }),
 *     { defaultData: [] }
 *   );
 */
export default function useApi(apiCall, options = {}) {
  const {
    deps = [],
    immediate = true,
    defaultData = null,
    transform,
    onError,
  } = options;

  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  // 用 ref 来避免闭包陷阱
  const apiCallRef = useRef(apiCall);
  apiCallRef.current = apiCall;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiCallRef.current();
      const raw = res.data ?? res;
      setData(transform ? transform(raw) : raw);
    } catch (err) {
      setError(err);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [fetchData, immediate]);

  return { data, loading, error, refetch: fetchData, setData };
}
