import { expect, test } from '../support/fixtures/index.ts';

const v1 = { title: 'Заголовок V1', body: 'Текст V1' };
const v2 = { title: 'Заголовок V2', body: 'Текст V2' };
const stale = { title: 'Заголовок из старой вкладки', body: 'Текст из старой вкладки' };
const revisionHeader = 'x-draft-revision';

test('Устаревшая запись возвращает 409 и не меняет черновик, ревизию и публикацию', async ({ publisherApi }) => {
  const initial = await publisherApi.readEditor();
  expect(initial.status()).toBe(200);
  expect(initial.headers()[revisionHeader]).toBe('0');
  expect((await publisherApi.saveDraft(v1)).status()).toBe(303); // Клиент без ревизии.
  expect((await publisherApi.publish()).status()).toBe(303);

  const [a, b] = await Promise.all([publisherApi.readEditor(), publisherApi.readEditor()]);
  for (const response of [a, b]) expect(response.status()).toBe(200);
  const baseA = a.headers()[revisionHeader];
  const baseB = b.headers()[revisionHeader];
  expect(baseA).toBe('1');
  expect(baseB).toBe(baseA);

  const saved = await publisherApi.saveDraft({ ...v2, baseRevision: baseA });
  expect(saved.status()).toBe(303);
  expect(saved.headers().location).toBe('/editor?notice=saved');
  expect((await publisherApi.saveDraft({ ...stale, baseRevision: baseB })).status()).toBe(409);

  const editor = await publisherApi.readEditor();
  expect(editor.status()).toBe(200);
  expect(editor.headers()[revisionHeader]).toBe('2');
  const preview = await publisherApi.readPreview();
  const publicPage = await publisherApi.readPublic();
  for (const [response, expected] of [[preview, v2], [publicPage, v1]] as const) {
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<h1>${expected.title}</h1>`);
    expect(html).toMatch(new RegExp(`<p(?:\\s[^>]*)?>${expected.body}</p>`));
    expect(html).not.toContain(stale.title);
    expect(html).not.toContain(stale.body);
    if (response === publicPage) {
      expect(html).not.toContain(v2.title);
      expect(html).not.toContain(v2.body);
    }
  }
});

test('Пустая, некорректная или дублированная ревизия не отключает защиту', async ({ publisherApi }) => {
  const requests = ['baseRevision=', 'baseRevision=01', 'baseRevision=no', 'baseRevision=0&baseRevision=0'];
  for (const revision of requests) {
    const result = await publisherApi.saveEncodedDraft(`title=Title&body=Body&${revision}`);
    expect(result.status(), revision).toBe(400);
  }
  expect((await publisherApi.readEditor()).headers()[revisionHeader]).toBe('0');
  expect((await publisherApi.readPreview()).status()).toBe(404);
});
