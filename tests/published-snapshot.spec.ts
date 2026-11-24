import { expect, test } from './fixtures.ts';
import { expectContent } from './content.ts';

const v1 = { title: 'Весенний выпуск', body: 'В номере три материала.' };
const v2 = { title: 'Обновлённый выпуск', body: 'В номере пять материалов.' };
const publicPath = '/p/pilot-page';

test('Новый черновик не меняет опубликованную страницу', async ({ page: author, browser, pilotUrl }) => {
  const title = author.getByLabel('Заголовок', { exact: true });
  const body = author.getByLabel('Текст', { exact: true });

  async function saveDraft(version: typeof v1): Promise<void> {
    await title.fill(version.title);
    await body.fill(version.body);
    await author.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
    await expect(author.getByRole('status')).toHaveText('Черновик сохранён');
  }

  async function expectPublicV1(): Promise<void> {
    // A fresh visitor cannot see the author’s browser state or a cached V1 response.
    const context = await browser.newContext({ baseURL: pilotUrl });
    try {
      const visitor = await context.newPage();
      expect((await visitor.goto(publicPath))?.status()).toBe(200);
      await expectContent(visitor, v1);
    } finally {
      await context.close();
    }
  }

  await test.step('Автор публикует V1, посетитель видит V1', async () => {
    await author.goto('/editor');
    await saveDraft(v1);
    await author.getByRole('button', { name: 'Опубликовать', exact: true }).click();
    await expect(author.getByRole('status')).toHaveText('Опубликовано');
    await expectPublicV1();
  });
  await test.step('Автор сохраняет V2 без публикации, V2 переживает перезагрузку', async () => {
    await saveDraft(v2);
    expect((await author.reload())?.status()).toBe(200);
    await expect(title).toHaveValue(v2.title);
    await expect(body).toHaveValue(v2.body);
  });
  await test.step('Новый посетитель по-прежнему видит опубликованную V1', async () => {
    await expectPublicV1();
  });
});
