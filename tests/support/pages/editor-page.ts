import type { Page } from '@playwright/test';
import type { Publication } from '../publication.ts';

export class EditorPage {
  constructor(readonly page: Page) {}

  get title() { return this.page.getByLabel('Заголовок', { exact: true }); }
  get body() { return this.page.getByLabel('Текст', { exact: true }); }
  get status() { return this.page.getByRole('status'); }
  get publicLink() { return this.page.getByRole('link', { name: 'Открыть публичную страницу', exact: true }); }

  open() { return this.page.goto('/editor'); }

  async saveDraft({ title, body }: Publication) {
    await this.title.fill(title);
    await this.body.fill(body);
    await this.page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
  }

  openPreview() {
    return this.page.getByRole('link', { name: 'Предпросмотр', exact: true }).click();
  }

  publish() {
    return this.page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  }
}
