/**
 * E2E 测试: 登录流程
 */
import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('登录流程', () => {

  test('显示登录页面', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=颐智康养')).toBeVisible();
    await expect(page.locator('input[id="username"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('使用正确凭据登录后跳转到仪表盘', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=颐智康养')).toBeVisible();
  });

  test('使用错误密码显示错误提示', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'wrong_password');
    await page.click('button[type="submit"]');

    // antd message 错误提示
    await expect(page.locator('.ant-message-error')).toBeVisible({ timeout: 5000 });
  });

  test('未登录访问 dashboard 重定向到登录页', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });

  test('退出登录后回到登录页', async ({ page }) => {
    await login(page);

    // 点击退出登录
    await page.click('text=退出登录');
    await expect(page).toHaveURL(/.*login/);
  });

});
