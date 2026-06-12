import React from 'react';
import { Result, Button } from 'antd';
import { captureError } from '../utils/sentry';

/**
 * 全局错误边界
 *
 * 功能：
 *   1. 捕获 React 渲染错误，防止白屏
 *   2. 自动上报到 Sentry（如已配置）
 *   3. 展示用户友好的错误页面 + 重试按钮
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 上报到 Sentry
    captureError(error, {
      componentStack: errorInfo.componentStack,
      source: 'ErrorBoundary',
    });

    // 输出到控制台（开发环境）
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // 尝试重新加载当前页面
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
          <Result
            status="error"
            title="页面出现异常"
            subTitle="系统遇到了一个意外的错误，请尝试刷新页面。如果问题持续出现，请联系技术支持。"
            extra={[
              <Button type="primary" key="retry" onClick={this.handleReset}>
                刷新页面
              </Button>,
              <Button key="home" onClick={() => { window.location.href = '/'; }}>
                返回首页
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
