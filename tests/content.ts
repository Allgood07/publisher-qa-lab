import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function expectContent(page: Page, expected: { title: string; body: string }): Promise<void> {
  const article = page.getByRole('main').getByRole('article');
  const heading = article.getByRole('heading', { level: 1 });
  const paragraph = article.getByRole('paragraph');
  await expect(heading).toBeVisible();
  await expect(heading).toHaveJSProperty('textContent', expected.title);
  await expect(paragraph).toBeVisible();
  await expect(paragraph).toHaveJSProperty('textContent', expected.body);
}
