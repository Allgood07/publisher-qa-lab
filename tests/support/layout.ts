import type { Locator, Page } from '@playwright/test';

export function readDocumentWidths(page: Page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

export function readHorizontalTextBounds(element: Locator) {
  return element.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const text = range.getBoundingClientRect();
    const block = node.getBoundingClientRect();
    let visibleLeft = Math.max(0, block.left);
    let visibleRight = Math.min(document.documentElement.clientWidth, block.right);

    // A narrower clipping ancestor can hide text without widening the document.
    let ancestor: Element | null = node;
    for (; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).overflowX === 'visible' || !ancestor.getClientRects().length) continue;
      const left = ancestor.getBoundingClientRect().left + ancestor.clientLeft;
      visibleLeft = Math.max(visibleLeft, left);
      visibleRight = Math.min(visibleRight, left + ancestor.clientWidth);
    }
    return { textLeft: text.left, textRight: text.right, visibleLeft, visibleRight };
  });
}
