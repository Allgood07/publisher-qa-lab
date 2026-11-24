import { expect, test } from '../support/fixtures/index.ts';

const draft = { title: 'Летний выпуск', body: 'В номере пять материалов.' };
const invalidCases = [
  { name: 'пустой заголовок', form: { ...draft, title: '' } },
  { name: 'заголовок из пробелов', form: { ...draft, title: '   ' } },
  { name: 'пустой текст', form: { ...draft, body: '' } },
  { name: 'текст из пробелов', form: { ...draft, body: '   ' } },
  { name: 'форму без поля title', form: { body: draft.body } },
  { name: 'форму без поля body', form: { title: draft.title } },
];

for (const { name, form } of invalidCases) {
  test(`POST /draft отклоняет ${name}`, async ({ publisherApi }) => {
    const response = await publisherApi.saveDraft(form);
    expect(response.status()).toBe(400);
  });
}
