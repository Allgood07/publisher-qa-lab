import { expect } from '@playwright/test';
import type { ArticlePage } from './pages/article-page.ts';
import type { Publication } from './publication.ts';

export async function expectContent({ heading, paragraph }: ArticlePage, expected: Publication): Promise<void> {
  await expect(heading).toBeVisible();
  await expect(heading).toHaveJSProperty('textContent', expected.title);
  await expect(paragraph).toBeVisible();
  await expect(paragraph).toHaveJSProperty('textContent', expected.body);
}
