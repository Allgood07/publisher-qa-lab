import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';
import { publicPath } from '../support/publication.ts';

const draft = { title: 'Весенний выпуск', body: 'Материалы номера уже готовы.' };

test('Публикация черновика видна посетителю', async ({ editor, articleView, withVisitor }) => {
  await withVisitor(async (visitor) => {
    await test.step('Чистый старт: редактор пуст, публичная страница не найдена', async () => {
      await editor.open();
      expect((await visitor.openPublic())?.status()).toBe(404);
      await expect(editor.title).toHaveValue('');
      await expect(editor.body).toHaveValue('');
    });
    await test.step('Автор сохраняет черновик, данные остаются после перезагрузки', async () => {
      await editor.saveDraft(draft);
      await expect(editor.status).toHaveText('Черновик сохранён');
      expect((await editor.page.reload())?.status()).toBe(200);
      await expect(editor.title).toHaveValue(draft.title);
      await expect(editor.body).toHaveValue(draft.body);
      if (process.env.PILOT_FORCE_FAILURE === '1') {
        expect(true, 'PILOT_CONTROLLED_FAILURE: сервер ответил, черновик сохранён').toBe(false);
      }
    });
    await test.step('Предпросмотр верен, посетитель по-прежнему получает 404', async () => {
      await editor.openPreview();
      await expect(editor.page).toHaveURL('/preview');
      await expect(articleView.previewMarker('main')).toBeVisible();
      await expectContent(articleView, draft);
      expect((await visitor.openPublic())?.status()).toBe(404);
    });
    await test.step('Автор публикует, посетитель видит правильное содержимое', async () => {
      await articleView.backToEditor();
      await editor.publish();
      await expect(editor.status).toHaveText('Опубликовано');
      await expect(editor.publicLink).toHaveAttribute('href', publicPath);
      expect((await visitor.openPublic())?.status()).toBe(200);
      await expectContent(visitor, draft);
      await expect(visitor.previewMarker('page')).toHaveCount(0);
    });
  });
});
