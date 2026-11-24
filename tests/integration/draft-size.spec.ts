import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';
import { draftWithEncodedSize } from '../support/data/draft-with-encoded-size.ts';

const limit = 16_384;

test('Форма ровно 16 384 байта сохраняется без обрезания', async ({ publisherApi, editor }) => {
  const { content, encoded } = draftWithEncodedSize(limit);
  expect(Buffer.byteLength(encoded)).toBe(limit);
  expect((await publisherApi.saveEncodedDraft(encoded)).status()).toBe(303);
  expect((await editor.open())?.status()).toBe(200);
  await expect(editor.title).toHaveValue(content.title);
  await expect(editor.body).toHaveValue(content.body);
});

test('Форма на байт больше лимита отклоняется и не меняет версии', async ({ publisherApi, editor, withVisitor }) => {
  const published = { title: 'Опубликованный выпуск', body: 'Этот материал уже доступен.' };
  const draft = { title: 'Сохранённый черновик', body: 'Этот материал ещё не опубликован.' };
  const { encoded } = draftWithEncodedSize(limit + 1);

  async function expectVersions() {
    expect((await editor.open())?.status()).toBe(200);
    await expect(editor.title).toHaveValue(draft.title);
    await expect(editor.body).toHaveValue(draft.body);
    await withVisitor(async (visitor) => {
      expect((await visitor.openPublic())?.status()).toBe(200);
      await expectContent(visitor, published);
    });
  }

  await test.step('Публикуем V1, сохраняем отличающийся черновик V2 и сверяем обе версии', async () => {
    expect((await publisherApi.saveDraft(published)).status()).toBe(303);
    expect((await publisherApi.publish()).status()).toBe(303);
    expect((await publisherApi.saveDraft(draft)).status()).toBe(303);
    await expectVersions();
  });

  await test.step('Превышение на один байт даёт HTTP 413', async () => {
    expect(Buffer.byteLength(encoded)).toBe(limit + 1);
    expect((await publisherApi.saveEncodedDraft(encoded)).status()).toBe(413);
  });

  await test.step('Редактор сохранил V2, а посетитель видит V1', expectVersions);
});
