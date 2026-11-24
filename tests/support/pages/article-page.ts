import type { Page } from '@playwright/test';
import { publicPath } from '../publication.ts';

/** The preview and public views render the same article in different page chrome. */
export class ArticlePage {
  constructor(readonly page: Page) {}

  private get main() { return this.page.getByRole('main'); }
  private get article() { return this.main.getByRole('article'); }
  get heading() { return this.article.getByRole('heading', { level: 1 }); }
  get paragraph() { return this.article.getByRole('paragraph'); }

  previewMarker(scope: 'main' | 'page') {
    const root = scope === 'main' ? this.main : this.page;
    return root.getByText('Предпросмотр', { exact: true });
  }

  openPublic() { return this.page.goto(publicPath); }

  backToEditor() {
    return this.page.getByRole('link', { name: 'Вернуться в редактор', exact: true }).click();
  }
}
