import { expect, test } from '../support/fixtures/index.ts';

test('Без сохранённого черновика предпросмотр и публикация недоступны', async ({ publisherApi }) => {
  expect((await publisherApi.readPreview()).status(), 'GET /preview').toBe(404);
  expect((await publisherApi.publish()).status(), 'POST /publish').toBe(404);
  expect((await publisherApi.readPublic()).status(), 'Публичный URL после отказа').toBe(404);
});
