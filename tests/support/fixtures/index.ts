import { test as base } from '@playwright/test';
import { PublisherApi } from '../clients/publisher-api.ts';
import { ArticlePage } from '../pages/article-page.ts';
import { EditorPage } from '../pages/editor-page.ts';
import { withPilotServer } from './server.ts';

type Fixtures = {
  pilotUrl: string;
  publisherApi: PublisherApi;
  editor: EditorPage;
  articleView: ArticlePage;
  withVisitor: <T>(visit: (visitor: ArticlePage) => Promise<T>) => Promise<T>;
};

export const test = base.extend<Fixtures>({
  pilotUrl: async ({}, use) => withPilotServer(({ url }) => use(url)),
  baseURL: async ({ pilotUrl }, use) => use(pilotUrl),
  publisherApi: async ({ request }, use) => use(new PublisherApi(request)),
  editor: async ({ page }, use) => use(new EditorPage(page)),
  articleView: async ({ page }, use) => use(new ArticlePage(page)),
  withVisitor: async ({ browser, pilotUrl }, use) => {
    await use(async (visit) => {
      const context = await browser.newContext({
        baseURL: pilotUrl,
        storageState: { cookies: [], origins: [] },
      });
      try {
        return await visit(new ArticlePage(await context.newPage()));
      } finally {
        await context.close();
      }
    });
  },
});

export { expect } from '@playwright/test';
