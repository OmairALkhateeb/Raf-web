import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  href: string | null;
  external?: boolean;
  className?: string;
  style?: CSSProperties;
  dir?: 'rtl' | 'ltr';
  children: ReactNode;
};

/**
 * A banner's link: `next/link` for store paths, a new tab for other sites,
 * or a plain block when the banner has no link.
 */
export default function BannerLink({ href, external, className, style, dir, children }: Props) {
  if (!href) {
    return (
      <div className={className} style={style} dir={dir}>
        {children}
      </div>
    );
  }
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        dir={dir}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style} dir={dir}>
      {children}
    </Link>
  );
}
