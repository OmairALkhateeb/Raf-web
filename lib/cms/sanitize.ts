import 'server-only';

import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'blockquote',
];

function isHttpUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function isMailtoUrl(href: string): boolean {
  return /^mailto:/i.test(href);
}

function isInAppPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

/**
 * Strict allowlist for Filament RichEditor HTML.
 *
 * Scripts, event handlers, iframes, styles, and non-http(s)/mailto URLs are
 * stripped. External http(s) links open in a new tab with a safe rel.
 */
export function sanitizeCmsHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
    },
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tagName, attribs): sanitizeHtml.Tag => {
        const href = attribs.href ?? '';

        if (isHttpUrl(href)) {
          return {
            tagName: 'a',
            attribs: {
              href,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          };
        }

        if (isMailtoUrl(href) || isInAppPath(href)) {
          return {
            tagName: 'a',
            attribs: { href },
          };
        }

        return { tagName: 'a', attribs: {} };
      },
    },
  });
}
