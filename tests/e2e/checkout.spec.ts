import { expect, test } from '@playwright/test';

const API_URL = (process.env.E2E_API_URL || 'http://127.0.0.1:4000').replace(
  /\/+$/,
  '',
);

test.describe('BrewLite Customer & Staff Fulfillment E2E', () => {
  test('completes full journey: menu search -> customize -> persistent cart -> register/login -> WALLET SUCCESS -> staff status -> COMPLETED', async ({
    page,
    request,
  }) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@brewlite.local`;

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Cà phê sữa đá' }),
    ).toBeVisible();

    await page.getByPlaceholder('Cà phê, trà…').fill('ca phe sua');
    await expect(
      page.getByRole('heading', { name: 'Cà phê sữa đá' }),
    ).toBeVisible();

    await page
      .locator('article.product', { hasText: 'Cà phê sữa đá' })
      .getByRole('link', { name: 'Chọn món' })
      .click();

    await expect(page).toHaveURL(/\/products\//);
    await page.getByLabel(/M \(\+/).check();
    await page.getByLabel(/Trân châu trắng/).check();
    await expect(page.getByTestId('dynamic-price')).toContainText('41.000');

    await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
    await expect(page.getByText('Đã thêm vào giỏ hàng.')).toBeVisible();

    await page.getByRole('link', { name: 'Xem giỏ hàng' }).click();
    await expect(page).toHaveURL(/\/cart$/);

    // Verify localStorage["brewlite_cart"] survives hard reload
    await page.reload();
    await expect(page.getByText('Cà phê sữa đá')).toBeVisible();
    await expect(page.getByTestId('cart-subtotal')).toContainText('41.000');
    const persisted = await page.evaluate(() =>
      localStorage.getItem('brewlite_cart'),
    );
    expect(persisted).toContain('Cà phê sữa đá');

    await page.getByRole('link', { name: 'Đặt và thanh toán' }).click();
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)checkout/);

    await page
      .getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' })
      .click();
    await page.getByLabel('Họ tên').fill('Nguyễn E2E');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill('BrewLite123!');
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText(/Tạm tính 41\.000/)).toBeVisible();

    await page.getByLabel('Thanh toán mô phỏng').selectOption('WALLET');
    await page.getByLabel('Kết quả mô phỏng').selectOption('SUCCESS');
    await page
      .getByRole('button', { name: 'Xác nhận đặt và thanh toán' })
      .click();

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/i);
    await expect(page.getByText('Đã thanh toán')).toBeVisible();

    const clearedCart = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('brewlite_cart') || '[]'),
    );
    expect(clearedCart).toHaveLength(0);

    // Staff transitions PAID -> PREPARING -> READY -> COMPLETED via REST API and UI displays updated status
    const orderId = page.url().split('/').pop()!;
    const staffLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'staff@brewlite.local', password: 'BrewLiteStaff123!' },
    });
    expect(staffLogin.ok()).toBeTruthy();
    const { accessToken: staffToken } = (await staffLogin.json()) as {
      accessToken: string;
    };

    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      const res = await request.patch(`${API_URL}/orders/${orderId}/status`, {
        headers: { Authorization: `Bearer ${staffToken}` },
        data: { status },
      });
      expect(res.ok()).toBeTruthy();
    }

    await page.reload();
    await expect(page.getByText('Hoàn tất')).toBeVisible();
  });

  test('preserves cart and restores stock when mock payment is DECLINED (402)', async ({
    page,
  }) => {
    const email = `e2e-fail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@brewlite.local`;

    await page.goto('/');
    await page
      .locator('article.product', { hasText: 'Bạc xỉu' })
      .getByRole('link', { name: 'Chọn món' })
      .click();

    const stockLocator = page.locator('p.muted', { hasText: /^Còn \d+ ly$/ });
    const stockTextBefore = await stockLocator.textContent();
    const productUrl = page.url();

    await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
    await page.getByRole('link', { name: 'Xem giỏ hàng' }).click();
    await page.getByRole('link', { name: 'Đặt và thanh toán' }).click();

    await page
      .getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' })
      .click();
    await page.getByLabel('Họ tên').fill('Khách Thất Bại');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill('BrewLite123!');
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(page).toHaveURL(/\/checkout$/);
    await page.getByLabel('Thanh toán mô phỏng').selectOption('CARD');
    await page.getByLabel('Kết quả mô phỏng').selectOption('DECLINED');
    await page
      .getByRole('button', { name: 'Xác nhận đặt và thanh toán' })
      .click();

    await expect(page.locator('p.notice.error')).toContainText(
      'Thanh toán bị từ chối',
    );

    // Cart stays intact & product stock is atomically restored
    const preserved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('brewlite_cart') || '[]'),
    );
    expect(preserved).toHaveLength(1);

    await page.goto(productUrl);
    await expect(stockLocator).toHaveText(stockTextBefore!);
  });
});
