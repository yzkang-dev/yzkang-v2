/**
 * E2E 测试: 告警处理完整流程
 */
import { test, expect } from '@playwright/test';
import { login, waitForPageLoad } from './helpers';

test.describe('告警中心', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('text=告警中心');
    await waitForPageLoad(page);
  });

  test('告警列表正常加载', async ({ page }) => {
    await expect(page.locator('text=告警中心').first()).toBeVisible({ timeout: 10000 });
  });

  test('告警页面包含筛选条件', async ({ page }) => {
    // 检查是否有级别筛选
    const filterArea = page.locator('.ant-select, .ant-radio-group');
    await expect(filterArea.first()).toBeVisible({ timeout: 5000 });
  });

});
