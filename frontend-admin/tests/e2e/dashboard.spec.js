/**
 * E2E 测试: 仪表盘 (院长看板)
 */
import { test, expect } from '@playwright/test';
import { login, waitForPageLoad } from './helpers';

test.describe('院长看板', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('仪表盘显示统计数据卡片', async ({ page }) => {
    await waitForPageLoad(page);

    // 检查统计卡片标题
    await expect(page.locator('text=在住老人').first()).toBeVisible({ timeout: 10000 });
  });

  test('侧边栏菜单完整显示', async ({ page }) => {
    await waitForPageLoad(page);

    // 验证核心菜单项
    await expect(page.locator('text=院长看板')).toBeVisible();
    await expect(page.locator('text=老人管理')).toBeVisible();
    await expect(page.locator('text=照护记录')).toBeVisible();
    await expect(page.locator('text=告警中心')).toBeVisible();
    await expect(page.locator('text=系统设置')).toBeVisible();
  });

  test('点击侧边栏菜单可导航到对应页面', async ({ page }) => {
    await waitForPageLoad(page);

    // 点击老人管理
    await page.click('text=老人管理');
    await expect(page).toHaveURL(/.*elders/);
    await expect(page.locator('text=老人管理')).toBeVisible();

    // 点击照护记录
    await page.click('text=照护记录');
    await expect(page).toHaveURL(/.*care-records/);
  });

});
