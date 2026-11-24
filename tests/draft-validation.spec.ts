import { expect, test } from './fixtures.ts';
import { expectContent } from './content.ts';

const published = { title: 'Весенний выпуск', body: 'В номере три материала.' };
const draft = { title: 'Летний выпуск', body: 'В номере пять материалов.' };
const invalidCases = [
  { name: 'пустой заголовок', form: { ...draft, title: '' } },
  { name: 'заголовок из пробелов', form: { ...draft, title: '   ' } },
  { name: 'пустой текст', form: { ...draft, body: '' } },
  { name: 'текст из пробелов', form: { ...draft, body: '   ' } },
];

for (const { name, form } of invalidCases) {
  test(`POST /draft отклоняет ${name}`, async ({ request }) => {
    const response = await request.post('/draft', { form, maxRedirects: 0 });
    expect(response.status()).toBe(400);
  });
}

test('Отклонённая правка сохраняет прежний черновик и публикацию', async ({
  request, page: editor, browser, pilotUrl,
}) => {
  async function expectVersions(): Promise<void> {
    expect((await editor.goto('/editor'))?.status()).toBe(200);
    await expect(editor.getByLabel('Заголовок', { exact: true })).toHaveValue(draft.title);
    await expect(editor.getByLabel('Текст', { exact: true })).toHaveValue(draft.body);

    const guest = await browser.newContext({ baseURL: pilotUrl });
    try {
      const page = await guest.newPage();
      expect((await page.goto('/p/pilot-page'))?.status()).toBe(200);
      await expectContent(page, published);
    } finally {
      await guest.close();
    }
  }

  await test.step('Через API публикуем V1 и сохраняем V2; сверяем исходное состояние', async () => {
    expect((await request.post('/draft', { form: published, maxRedirects: 0 })).status()).toBe(303);
    expect((await request.post('/publish', { maxRedirects: 0 })).status()).toBe(303);
    expect((await request.post('/draft', { form: draft, maxRedirects: 0 })).status()).toBe(303);
    await expectVersions();
  });

  await test.step('Невалидная V3 отклоняется с HTTP 400', async () => {
    const form = { title: '   ', body: 'Эта правка не должна сохраниться.' };
    expect((await request.post('/draft', { form, maxRedirects: 0 })).status()).toBe(400);
  });

  await test.step('В редакторе осталась V2, новый посетитель видит V1', async () => {
    await expectVersions();
  });
});
