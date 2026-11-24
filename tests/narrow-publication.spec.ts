import { expect, test } from './fixtures.ts';
import { expectContent } from './content.ts';

const width = 360;
const publication = {
  title: 'Архив выпуска: SpringEditionReleaseNotesReference2026112400000001',
  body: 'Идентификатор материала: PublisherQaLabSpringEditionMaterialReference2026112400000001. По нему можно сверить выпуск в архиве.',
};

test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });

test('Опубликованный текст помещается на экране шириной 360 px', async ({ request, page }) => {
  await test.step('Публикуем страницу с длинными фрагментами без пробелов', async () => {
    expect((await request.post('/draft', { form: publication, maxRedirects: 0 })).status()).toBe(303);
    expect((await request.post('/publish', { maxRedirects: 0 })).status()).toBe(303);
  });

  await test.step('Посетитель без входа видит точный текст без горизонтального переполнения', async () => {
    expect((await page.goto('/p/pilot-page'))?.status()).toBe(200);
    await expectContent(page, publication);
    const { clientWidth, scrollWidth } = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(clientWidth, 'Ширина области вёрстки').toBe(width);
    expect(scrollWidth, 'Ширина прокручиваемой страницы').toBeLessThanOrEqual(clientWidth);

    // Element visibility alone would not catch text clipped by overflow: hidden.
    const article = page.getByRole('main').getByRole('article');
    for (const [label, element] of [
      ['Заголовок', article.getByRole('heading', { level: 1 })],
      ['Абзац', article.getByRole('paragraph')],
    ] as const) {
      const { textLeft, textRight, visibleLeft, visibleRight } = await element.evaluate((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        const block = node.getBoundingClientRect();
        let visibleLeft = Math.max(0, block.left);
        let visibleRight = Math.min(document.documentElement.clientWidth, block.right);

        // A narrower clipping ancestor may hide text without widening the document.
        for (let ancestor: Element | null = node; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
          if (getComputedStyle(ancestor).overflowX === 'visible' || !ancestor.getClientRects().length) continue;
          const left = ancestor.getBoundingClientRect().left + ancestor.clientLeft;
          visibleLeft = Math.max(visibleLeft, left);
          visibleRight = Math.min(visibleRight, left + ancestor.clientWidth);
        }
        return { textLeft: text.left, textRight: text.right, visibleLeft, visibleRight };
      });
      // clientWidth is rounded, whereas text bounds have fractional coordinates.
      expect(textLeft, `${label}: левый край текста`).toBeGreaterThanOrEqual(visibleLeft - 1);
      expect(textRight, `${label}: правый край текста`).toBeLessThanOrEqual(visibleRight + 1);
    }
  });
});
