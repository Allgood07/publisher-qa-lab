import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';
import { EditorPage } from '../support/pages/editor-page.ts';

const v1 = { title: 'Опубликованный заголовок', body: 'Опубликованный текст' };
const v2 = { title: 'Новый заголовок из первой вкладки', body: 'Новый текст из первой вкладки' };
const staleEdit = { title: 'Замечание «уточнить» & "сверить"', body: '\nПравка автора <на проверку>\nВторая строка' };
const merged = { title: v2.title, body: `${v2.body}\n${staleEdit.body}` };

test('Устаревшая вкладка сохраняет ввод, а автор переносит правку в свежий черновик', async ({ context, editor: first, publisherApi, withVisitor }) => {
  expect((await publisherApi.saveDraft(v1)).status()).toBe(303);
  expect((await publisherApi.publish()).status()).toBe(303);
  const second = new EditorPage(await context.newPage());
  await first.open();
  await second.open();
  await expect(second.title).toHaveValue(v1.title);
  await expect(second.body).toHaveValue(v1.body);

  await first.saveDraft(v2);
  await expect(first.status).toHaveText('Черновик сохранён');
  await second.saveDraft(staleEdit);
  await expect(second.page.getByRole('alert')).toContainText('Черновик изменился. Ваша правка не сохранена.');
  await expect(second.status).toHaveCount(0);
  await expect(second.title).toHaveValue(staleEdit.title);
  await expect(second.body).toHaveValue(staleEdit.body);
  await expect(second.page.getByRole('button', { name: 'Сохранить черновик', exact: true })).toHaveCount(0);
  await expect(second.page.getByRole('button', { name: 'Опубликовать', exact: true })).toHaveCount(0);

  await withVisitor(async (visitor) => {
    expect((await visitor.openPublic())?.status()).toBe(200);
    await expectContent(visitor, v1);
    const main = visitor.page.getByRole('main');
    await expect(main).not.toContainText(v2.title);
    await expect(main).not.toContainText(v2.body);
  });

  const [freshPage] = await Promise.all([
    context.waitForEvent('page'),
    second.page.getByRole('link', { name: 'Открыть свежий черновик в новой вкладке', exact: true }).click(),
  ]);
  const fresh = new EditorPage(freshPage);
  await expect(fresh.title).toHaveValue(v2.title);
  await expect(fresh.body).toHaveValue(v2.body);
  await expect(second.body).toHaveValue(staleEdit.body);
  await fresh.saveDraft(merged);
  await expect(fresh.status).toHaveText('Черновик сохранён');
  await fresh.publish();
  await expect(fresh.status).toHaveText('Опубликовано');
  await withVisitor(async (visitor) => {
    expect((await visitor.openPublic())?.status()).toBe(200);
    await expectContent(visitor, merged);
  });
});
