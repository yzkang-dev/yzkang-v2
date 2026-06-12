/**
 * Sentry 错误追踪 — 前端初始化
 *
 * 使用方式：
 *   设置环境变量 VITE_SENTRY_DSN 即可自动启用
 *   未设置 DSN 时静默降级，不影响应用运行
 *
 * 功能：
 *   1. 未捕获异常自动上报
 *   2. React 组件错误追踪
 *   3. 性能监控 (Web Vitals)
 *   4. Release 版本追踪
 */

const DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development';
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.VITE_APP_VERSION || '0.5.0';

let Sentry = null;

export async function initSentry() {
  if (!DSN) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] 未配置 DSN，跳过初始化');
    }
    return;
  }

  try {
    // 动态加载 Sentry (仅在生产环境)
    Sentry = await import('@sentry/react');

    Sentry.init({
      dsn: DSN,
      environment: ENVIRONMENT,
      release: RELEASE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,      // 脱敏隐私数据
          blockAllMedia: true,    // 不上传图片/视频
        }),
      ],
      tracesSampleRate: 0.1,          // 10% 性能追踪采样
      replaysSessionSampleRate: 0.01, // 1% Session Replay
      replaysOnErrorSampleRate: 0.5,  // 50% 错误回放
      beforeSend(event) {
        // 过滤非生产环境的通用错误
        if (import.meta.env.DEV) return null;
        // 过滤网络错误中的敏感路径
        if (event.request && event.request.url) {
          const url = event.request.url;
          if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
            return null; // 认证失败不需上报
          }
        }
        return event;
      },
    });
    console.info(`[Sentry] 已启用 (env=${ENVIRONMENT}, release=${RELEASE})`);
  } catch (e) {
    console.warn('[Sentry] 初始化失败:', e.message);
  }
}

/** 手动上报错误 */
export function captureError(error, context = {}) {
  if (Sentry) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error('[Error]', error, context);
  }
}

/** 手动上报消息 */
export function captureMessage(message, level = 'info') {
  if (Sentry) {
    Sentry.captureMessage(message, level);
  }
}

/** 设置用户上下文 (登录后调用) */
export function setUser(user) {
  if (Sentry && user) {
    Sentry.setUser({ id: user.id, username: user.username, role: user.role });
  }
}

/** 清除用户上下文 (登出时调用) */
export function clearUser() {
  if (Sentry) {
    Sentry.setUser(null);
  }
}

export { Sentry };
