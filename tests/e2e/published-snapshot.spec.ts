import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';

const v1 = { title: 'Весенний выпуск', body: 'В номере три материала.' };
const v2 = { title: 'Обновлённый выпуск', body: 'В номере пять материалов.' };

test('Новый черновик не меняет опубликованную страницу', async ({ editor, articleView, withVisitor }) => {
  const expectPublicV1 = () => withVisitor(async (visitor) => {
    expect((await visitor.openPublic())?.status()).toBe(200);
    await expectContent(visitor, v1);
  });

  await test.step('Автор публикует V1, посетитель видит V1', async () => {
    await editor.open();
    await editor.saveDraft(v1);
    await expect(editor.status).toHaveText('Черновик сохранён');
    await editor.publish();
    await expect(editor.status).toHaveText('Опубликовано');
    await expectPublicV1();
  });
  await test.step('Автор сохраняет V2 без публикации, V2 переживает перезагрузку', async () => {
    await editor.saveDraft(v2);
    await expect(editor.status).toHaveText('Черновик сохранён');
    expect((await editor.page.reload())?.status()).toBe(200);
    await expect(editor.title).toHaveValue(v2.title);
    await expect(editor.body).toHaveValue(v2.body);
  });
  await test.step('После сохранения V2 новый посетитель по-прежнему видит V1', expectPublicV1);
  await test.step('Предпросмотр показывает черновик V2, но не меняет публичную V1', async () => {
    await editor.openPreview();
    await expect(editor.page).toHaveURL('/preview');
    await expect(articleView.previewMarker('main')).toBeVisible();
    await expectContent(articleView, v2);
    await expectPublicV1();
  });
});
