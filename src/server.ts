import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

const host = '127.0.0.1';
const publicPath = '/p/pilot-page';
type Content = Readonly<{ title: string; body: string }>;
let draft: Content | undefined;
let published: Content | undefined;

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function html(response: ServerResponse, status: number, content: string): void {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Publisher QA Lab</title></head><body><main>${content}</main></body></html>`);
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(303, { Location: location }).end();
}

function editor(notice: string | null): string {
  const status = notice === 'saved' ? '<p role="status">Черновик сохранён</p>'
    : notice === 'published' && published ? '<p role="status">Опубликовано</p>' : '';
  return `<h1>Редактор</h1>
${status}
<form action="/draft" method="post">
  <p><label for="title">Заголовок</label> <input id="title" name="title" required value="${escapeHtml(draft?.title ?? '').replaceAll('"', '&quot;')}"></p>
  <p><label for="body">Текст</label> <textarea id="body" name="body" required>
${escapeHtml(draft?.body ?? '')}</textarea></p>
  <button>Сохранить черновик</button>
</form>
${draft ? `<p><a href="/preview">Предпросмотр</a></p>
<form action="/publish" method="post"><button>Опубликовать</button></form>` : ''}
${published ? `<p><a href="${publicPath}">Открыть публичную страницу</a></p>` : ''}`;
}

function renderContent(content: Content): string {
  return `<article style="overflow-wrap: anywhere"><h1>${escapeHtml(content.title)}</h1><p style="white-space: pre-wrap">${escapeHtml(content.body)}</p></article>`;
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 16_384) {
      request.resume();
      return undefined;
    }
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url ?? '/', `http://${host}`);
  if (request.method === 'GET') {
    if (url.pathname === '/editor') return html(response, 200, editor(url.searchParams.get('notice')));
    if (url.pathname === '/preview' && draft) {
      return html(response, 200, `<p>Предпросмотр</p>${renderContent(draft)}<p><a href="/editor">Вернуться в редактор</a></p>`);
    }
    if (url.pathname === publicPath && published) return html(response, 200, renderContent(published));
  }
  if (request.method === 'POST' && url.pathname === '/draft') {
    const form = await readForm(request);
    if (!form) return html(response, 413, '<h1>Слишком большой запрос</h1>');
    const title = form.get('title');
    const body = form.get('body');
    if (!title?.trim() || !body?.trim()) return html(response, 400, '<h1>Заполните заголовок и текст</h1>');
    draft = { title, body };
    return redirect(response, '/editor?notice=saved');
  }
  if (request.method === 'POST' && url.pathname === '/publish' && draft) {
    published = { ...draft };
    return redirect(response, '/editor?notice=published');
  }
  html(response, 404, '<h1>Страница не найдена</h1>');
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    console.error(error);
    if (response.headersSent) response.destroy();
    else html(response, 500, '<h1>Ошибка сервера</h1>');
  });
});

// The fixture owns this process; do not linger if its IPC channel disappears.
process.once('disconnect', () => server.close());
server.listen(0, host, () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server port');
  process.send?.(address.port);
  if (!process.send) console.log(`Editor: http://${host}:${address.port}/editor`);
});
