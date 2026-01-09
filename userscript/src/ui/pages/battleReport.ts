/**
 * Battle Report page enhancements
 * - Anonymize coordinates in battle reports
 */

import { t } from '../../locales';

/**
 * Initialize battle report page enhancements
 */
export function initBattleReportPage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('page') !== 'raport') {
    return;
  }

  console.log('[HG Hub] Battle report page detected');

  // Wait for page to load, then add button
  setTimeout(() => {
    addAnonymizeButton();
  }, 100);
}

/**
 * Add anonymize button to the battle report page
 */
function addAnonymizeButton(): void {
  // Find the content area
  const content = document.getElementById('content') || document.body;

  // Create button
  const btn = document.createElement('button');
  btn.id = 'hg-hub-anonymize-btn';
  btn.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 9999;
    background: #2a4a6a;
    border: 1px solid #4a8aba;
    color: #8cf;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 12px;
    border-radius: 3px;
  `;
  btn.textContent = t('battleReport.anonymize');
  btn.title = t('battleReport.anonymizeTitle');

  btn.addEventListener('click', () => {
    anonymizeCoordinates();
    // Remove button after anonymization
    btn.remove();
    console.log('[HG Hub] Coordinates anonymized, button removed');
  });

  content.appendChild(btn);
}

/**
 * Anonymize all coordinates in the battle report
 * Replaces patterns like [1:211:3] with [X:XXX:X]
 */
function anonymizeCoordinates(): void {
  // Regex to match coordinate patterns: [G:SSS:P] where G=1-9, SSS=1-999, P=1-15
  const coordPattern = /\[(\d{1,2}):(\d{1,3}):(\d{1,2})\]/g;

  // Get the main content area
  const content = document.getElementById('content') || document.body;

  // Find all text nodes and elements that might contain coordinates
  const walker = document.createTreeWalker(
    content,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (coordPattern.test(node.textContent || '')) {
      textNodes.push(node);
    }
    // Reset regex lastIndex
    coordPattern.lastIndex = 0;
  }

  // Replace coordinates in text nodes
  for (const textNode of textNodes) {
    if (textNode.textContent) {
      textNode.textContent = textNode.textContent.replace(coordPattern, '[X:XXX:X]');
    }
  }

  // Also check for coordinates in links (href attributes)
  const links = content.querySelectorAll('a[href*="galaxy"]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && coordPattern.test(href)) {
      // Remove the link functionality but keep the text
      const span = document.createElement('span');
      span.textContent = link.textContent?.replace(coordPattern, '[X:XXX:X]') || '';
      span.style.color = '#8cf';
      link.parentNode?.replaceChild(span, link);
    }
    coordPattern.lastIndex = 0;
  });

  // Check title attribute of elements
  const elementsWithTitle = content.querySelectorAll('[title]');
  elementsWithTitle.forEach(el => {
    const title = el.getAttribute('title');
    if (title && coordPattern.test(title)) {
      el.setAttribute('title', title.replace(coordPattern, '[X:XXX:X]'));
    }
    coordPattern.lastIndex = 0;
  });

  console.log('[HG Hub] Coordinates anonymized');
}
