import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';

const published = { title: 'Весенний выпуск', body: 'В номере три материала.' };
const draft = { title: 'Летний выпуск', body: 'В номере пять материалов.' };

test('Отклонённая правка сохраняет прежний черновик и публикацию', async ({
  publisherApi, editor, withVisitor,
}) => {
  async function expectVersions(): Promise<void> {
    expect((await editor.open())?.status()).toBe(200);
    await expect(editor.title).toHaveValue(draft.title);
    await expect(editor.body).toHaveValue(draft.body);

    await withVisitor(async (visitor) => {
      expect((await visitor.openPublic())?.status()).toBe(200);
      await expectContent(visitor, published);
    });
  }

  await test.step('Через API публикуем V1 и сохраняем V2; сверяем исходное состояние', async () => {
    expect((await publisherApi.saveDraft(published)).status()).toBe(303);
    expect((await publisherApi.publish()).status()).toBe(303);
    expect((await publisherApi.saveDraft(draft)).status()).toBe(303);
    await expectVersions();
  });

  await test.step('Невалидная V3 отклоняется с HTTP 400', async () => {
    const form = { title: '   ', body: 'Эта правка не должна сохраниться.' };
    expect((await publisherApi.saveDraft(form)).status()).toBe(400);
  });

  await test.step('В редакторе осталась V2, новый посетитель видит V1', async () => {
    await expectVersions();
  });
});
