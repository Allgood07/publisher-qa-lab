import { expect, test } from './fixtures.ts';
import { expectContent } from './content.ts';

const heading = 'Весенний выпуск';
const copy = 'Материалы номера уже готовы.';
const publicPath = '/p/pilot-page';

test('Публикация черновика видна посетителю', async ({ page: author, browser, pilotUrl }) => {
  const visitorContext = await browser.newContext({ baseURL: pilotUrl });
  try {
    const visitor = await visitorContext.newPage();
    const title = author.getByLabel('Заголовок', { exact: true });
    const body = author.getByLabel('Текст', { exact: true });
    await test.step('Чистый старт: редактор пуст, публичная страница не найдена', async () => {
      await author.goto('/editor');
      expect((await visitor.goto(publicPath))?.status()).toBe(404);
      await expect(title).toHaveValue('');
      await expect(body).toHaveValue('');
    });
    await test.step('Автор сохраняет черновик, данные остаются после перезагрузки', async () => {
      await title.fill(heading);
      await body.fill(copy);
      await author.getByRole('button', { name: 'Сохранить черновик' }).click();
      await expect(author.getByRole('status')).toHaveText('Черновик сохранён');
      expect((await author.reload())?.status()).toBe(200);
      await expect(title).toHaveValue(heading);
      await expect(body).toHaveValue(copy);
      if (process.env.PILOT_FORCE_FAILURE === '1') {
        expect(true, 'PILOT_CONTROLLED_FAILURE: сервер ответил, черновик сохранён').toBe(false);
      }
    });
    await test.step('Предпросмотр верен, посетитель по-прежнему получает 404', async () => {
      await author.getByRole('link', { name: 'Предпросмотр', exact: true }).click();
      await expect(author).toHaveURL('/preview');
      await expect(author.getByRole('main').getByText('Предпросмотр', { exact: true })).toBeVisible();
      await expectContent(author, { title: heading, body: copy });
      expect((await visitor.goto(publicPath))?.status()).toBe(404);
    });
    await test.step('Автор публикует, посетитель видит правильное содержимое', async () => {
      await author.getByRole('link', { name: 'Вернуться в редактор' }).click();
      await author.getByRole('button', { name: 'Опубликовать', exact: true }).click();
      await expect(author.getByRole('status')).toHaveText('Опубликовано');
      await expect(author.getByRole('link', { name: 'Открыть публичную страницу' })).toHaveAttribute('href', publicPath);
      expect((await visitor.goto(publicPath))?.status()).toBe(200);
      await expectContent(visitor, { title: heading, body: copy });
      await expect(visitor.getByText('Предпросмотр', { exact: true })).toHaveCount(0);
    });
  } finally {
    await visitorContext.close();
  }
});
