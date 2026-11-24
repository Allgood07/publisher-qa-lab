import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';

const v1 = { title: 'Технический выпуск', body: 'Первая версия расписания.' };
const v2 = { title: 'Обновление расписания', body: 'Вторая версия расписания.' };

test('Повторная публикация заменяет V1 на сохранённую V2', async ({ publisherApi, editor, withVisitor }) => {
  await test.step('Публикуем V1 через API и сверяем публичные данные', async () => {
    expect((await publisherApi.saveDraft(v1)).status()).toBe(303);
    expect((await publisherApi.publish()).status()).toBe(303);
    await withVisitor(async (visitor) => {
      expect((await visitor.openPublic())?.status()).toBe(200);
      await expectContent(visitor, v1);
    });
  });

  await test.step('Автор сохраняет V2, но посетитель всё ещё видит V1', async () => {
    await editor.open();
    await editor.saveDraft(v2);
    await expect(editor.status).toHaveText('Черновик сохранён');
    await withVisitor(async (visitor) => {
      expect((await visitor.openPublic())?.status()).toBe(200);
      await expectContent(visitor, v1);
    });
  });

  await test.step('Автор повторно публикует сохранённый черновик', async () => {
    await editor.publish();
    await expect(editor.status).toHaveText('Опубликовано');
  });

  await test.step('В новом контексте посетителя опубликованы оба поля V2', async () => {
    await withVisitor(async (visitor) => {
      expect((await visitor.openPublic())?.status()).toBe(200);
      await expectContent(visitor, v2);
    });
  });
});
