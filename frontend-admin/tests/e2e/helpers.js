/**
 * E2E 测试辅助函数
 */

const TEST_USER = {
  username: 'admin',
  password: 'Admin@123',
};

/**
 * 登录到管理后台
 * @param {import('@playwright/test').Page} page
 */
export async function login(page) {
  await page.goto('/login');
  await page.waitForSelector('input[id="username"]', { timeout: 10000 });

  await page.fill('input[id="username"]', TEST_USER.username);
  await page.fill('input[id="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');

  // 等待跳转到仪表盘
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

/**
 * 通过 localStorage 直接注入 token 登录 (更快)
 */
export async function quickLogin(page) {
  await page.goto('/');

  // 注入 Token
  await page.evaluate(() => {
    localStorage.setItem('token', 'LOCAL_TEST_TOKEN');
    localStorage.setItem('refresh_token', 'LOCAL_TEST_REFRESH_TOKEN');
    localStorage.setItem('user', JSON.stringify({
      username: 'admin',
      real_name: '管理员',
      role: 'superadmin',
      role_id: 1,
    }));
    localStorage.setItem('permissions', JSON.stringify(['*']));
  });

  await page.goto('/dashboard');
}

/**
 * 等待页面加载完成
 */
export async function waitForPageLoad(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  // 等待 antd Spin 消失
  await page.waitForTimeout(500);
}

/**
 * 导航到指定菜单
 * @param {import('@playwright/test').Page} page
 * @param {string} label - 菜单文字
 */
export async function navigateTo(page, label) {
  await page.click(`text=${label}`);
  await waitForPageLoad(page);
}
