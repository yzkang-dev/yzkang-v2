// preload.js - 安全的上下文桥接脚本
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 检查后端健康状态
  backendHealth: () => ipcRenderer.invoke('backend-health'),
  // 获取应用版本
  getVersion: () => ipcRenderer.invoke('app-version'),
  // 重启后端
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  // 判断是否为桌面端
  isDesktop: true,
  // 平台信息
  platform: process.platform,
});
