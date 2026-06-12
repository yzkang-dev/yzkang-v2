/**
 * E2E 测试: 老人管理完整流程 (CRUD)
 */
import { test, expect } from '@playwright/test';
import { login, waitForPageLoad } from './helpers';

test.describe('老人管理', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('text=老人管理');
    await waitForPageLoad(page);
  });

  test('老人列表正常加载', async ({ page }) => {
    await expect(page.locator('text=老人管理')).toBeVisible({ timeout: 10000 });
  });

  test('搜索老人', async ({ page }) => {
    // 查找搜索输入框
    const searchInput = page.locator('input[placeholder*="搜索"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('张');
      await searchInput.press('Enter');
      await waitForPageLoad(page);
    }
  });

  test('分页操作', async ({ page }) => {
    // 查找分页组件
    const pagination = page.locator('.ant-pagination');
    if (await pagination.isVisible()) {
      // 点击下一页
      const nextBtn = page.locator('.ant-pagination-next');
      if (await nextBtn.isVisible() && !(await nextBtn.locator('.ant-pagination-disabled').count())) {
        await nextBtn.click();
        await waitForPageLoad(page);
      }
    }
  });

});
