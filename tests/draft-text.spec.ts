import { expect, test } from './fixtures.ts';
import { expectContent } from './content.ts';

const draft = {
  title: 'Весна & "Лето"',
  body: 'Заметка: <em>выпуск</em> &  новости.',
};

test('Валидный черновик сохраняется и отображается буквально', async ({ request, page }) => {
  await test.step('Сохраняем черновик через API', async () => {
    const response = await request.post('/draft', { form: draft, maxRedirects: 0 });
    expect(response.status()).toBe(303);
  });

  await test.step('Редактор возвращает точные значения полей', async () => {
    expect((await page.goto('/editor'))?.status()).toBe(200);
    await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(draft.title);
    await expect(page.getByLabel('Текст', { exact: true })).toHaveValue(draft.body);
  });

  await test.step('Предпросмотр показывает тег как текст и сохраняет двойной пробел', async () => {
    await page.getByRole('link', { name: 'Предпросмотр', exact: true }).click();
    await expect(page).toHaveURL('/preview');
    await expectContent(page, draft);

    const paragraph = page.getByRole('main').getByRole('article').getByRole('paragraph');
    await expect(paragraph.locator('em')).toHaveCount(0);
    await expect(paragraph).toHaveJSProperty('innerText', draft.body);
  });
});
