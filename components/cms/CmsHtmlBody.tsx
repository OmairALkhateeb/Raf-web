const CMS_PROSE_CLASS = [
  'text-sm text-[#2D1F1F]/55 leading-relaxed',
  '[&_h1]:font-serif [&_h1]:text-2xl [&_h1]:text-[#2D1F1F] [&_h1]:mb-4',
  '[&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-[#2D1F1F] [&_h2]:mt-8 [&_h2]:mb-3',
  '[&_h3]:font-serif [&_h3]:text-lg [&_h3]:text-[#2D1F1F] [&_h3]:mt-6 [&_h3]:mb-2',
  '[&_h4]:font-serif [&_h4]:text-base [&_h4]:text-[#2D1F1F] [&_h4]:mt-5 [&_h4]:mb-2',
  '[&_p]:mb-4',
  '[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:mb-4 [&_ul]:space-y-2',
  '[&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:mb-4 [&_ol]:space-y-2',
  '[&_li]:leading-relaxed',
  '[&_a]:text-[#C9A84C] [&_a]:underline [&_a]:underline-offset-2',
  '[&_strong]:text-[#2D1F1F] [&_strong]:font-bold',
  '[&_b]:text-[#2D1F1F] [&_b]:font-bold',
  '[&_em]:italic',
  '[&_blockquote]:border-s-2 [&_blockquote]:border-[#C9A84C]/40 [&_blockquote]:ps-4 [&_blockquote]:italic [&_blockquote]:mb-4',
  '[&_hr]:my-8 [&_hr]:border-[#2D1F1F]/10',
].join(' ');

/**
 * Renders CMS HTML that has already been sanitized on the server.
 * Do not pass unsanitized RichEditor output here.
 */
export default function CmsHtmlBody({ html }: { html: string }) {
  return <div className={CMS_PROSE_CLASS} dangerouslySetInnerHTML={{ __html: html }} />;
}
