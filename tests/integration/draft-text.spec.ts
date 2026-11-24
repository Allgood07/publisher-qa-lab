import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';

const draft = {
  title: 'Весна & "Лето"',
  body: 'Заметка: <em>выпуск</em> &  новости.',
};

test('Валидный черновик сохраняется и отображается буквально', async ({ publisherApi, editor, articleView }) => {
  await test.step('Сохраняем черновик через API', async () => {
    const response = await publisherApi.saveDraft(draft);
    expect(response.status()).toBe(303);
  });

  await test.step('Редактор возвращает точные значения полей', async () => {
    expect((await editor.open())?.status()).toBe(200);
    await expect(editor.title).toHaveValue(draft.title);
    await expect(editor.body).toHaveValue(draft.body);
  });

  await test.step('Предпросмотр показывает тег как текст и сохраняет двойной пробел', async () => {
    await editor.openPreview();
    await expect(editor.page).toHaveURL('/preview');
    await expectContent(articleView, draft);
    await expect(articleView.paragraph.locator('em')).toHaveCount(0);
    await expect(articleView.paragraph).toHaveJSProperty('innerText', draft.body);
  });
});
