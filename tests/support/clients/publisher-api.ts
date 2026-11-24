import type { APIRequestContext } from '@playwright/test';
import { publicPath } from '../publication.ts';
import type { Publication } from '../publication.ts';

export class PublisherApi {
  constructor(private readonly request: APIRequestContext) {}

  saveDraft(form: Partial<Publication>) {
    return this.request.post('/draft', { form: { ...form }, maxRedirects: 0 });
  }

  saveEncodedDraft(data: string) {
    return this.request.post('/draft', {
      data,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
    });
  }

  publish() {
    return this.request.post('/publish', { maxRedirects: 0 });
  }

  readPreview() {
    return this.request.get('/preview', { maxRedirects: 0 });
  }

  readPublic() {
    return this.request.get(publicPath, { maxRedirects: 0 });
  }
}
