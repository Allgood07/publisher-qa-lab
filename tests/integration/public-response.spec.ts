import { randomUUID } from 'node:crypto';
import { expect, test } from '../support/fixtures/index.ts';
import { expectContent } from '../support/assertions.ts';

test('Маркер черновика отсутствует в HTML гостя до публикации', async ({ publisherApi, withVisitor }) => {
  const marker = `draft-${randomUUID()}`;
  const v1 = { title: 'Выпуск', body: 'Утверждённый текст' };
  const v2 = { title: 'Обновление', body: marker };
  expect((await publisherApi.saveDraft(v1)).status()).toBe(303);
  expect((await publisherApi.publish()).status()).toBe(303);
  expect((await publisherApi.saveDraft(v2)).status()).toBe(303);
  await withVisitor(async visitor => {
    const response = await visitor.openPublic();
    expect(response?.status()).toBe(200);
    await expectContent(visitor, v1);
    expect(await response!.text()).not.toContain(marker);
  });
  expect((await publisherApi.publish()).status()).toBe(303);
  await withVisitor(async visitor => {
    const response = await visitor.openPublic();
    expect(response?.status()).toBe(200);
    await expectContent(visitor, v2);
    expect(await response!.text()).toContain(marker);
  });
});
