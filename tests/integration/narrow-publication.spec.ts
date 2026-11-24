import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';
import { readDocumentWidths, readHorizontalTextBounds } from '../support/layout.ts';

const width = 360;
const publication = {
  title: 'Архив выпуска: SpringEditionReleaseNotesReference2026112400000001',
  body: 'Идентификатор материала: PublisherQaLabSpringEditionMaterialReference2026112400000001. По нему можно сверить выпуск в архиве.',
};

test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });

test('Опубликованный текст помещается на экране шириной 360 px', async ({ publisherApi, articleView }) => {
  await test.step('Публикуем страницу с длинными фрагментами без пробелов', async () => {
    expect((await publisherApi.saveDraft(publication)).status()).toBe(303);
    expect((await publisherApi.publish()).status()).toBe(303);
  });

  await test.step('Посетитель без входа видит точный текст без горизонтального переполнения', async () => {
    expect((await articleView.openPublic())?.status()).toBe(200);
    await expectContent(articleView, publication);
    const { clientWidth, scrollWidth } = await readDocumentWidths(articleView.page);
    expect(clientWidth, 'Ширина области вёрстки').toBe(width);
    expect(scrollWidth, 'Ширина прокручиваемой страницы').toBeLessThanOrEqual(clientWidth);

    // Element visibility alone would not catch text clipped by overflow: hidden.
    for (const [label, element] of [
      ['Заголовок', articleView.heading],
      ['Абзац', articleView.paragraph],
    ] as const) {
      const { textLeft, textRight, visibleLeft, visibleRight } = await readHorizontalTextBounds(element);
      // clientWidth is rounded, whereas text bounds have fractional coordinates.
      expect(textLeft, `${label}: левый край текста`).toBeGreaterThanOrEqual(visibleLeft - 1);
      expect(textRight, `${label}: правый край текста`).toBeLessThanOrEqual(visibleRight + 1);
    }
  });
});
