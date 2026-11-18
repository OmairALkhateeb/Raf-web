'use client';

import Image from 'next/image';
import BannerOfferNote from '@/components/home/BannerOfferNote';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Banner } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { bannerHref } from '@/utils/bannerLink';
import BannerLink from '@/components/common/BannerLink';

interface BannerCardProps {
  banner: Banner;
  /** Aspect ratio for the card image area. */
  ratio?: string;
}

/**
 * A single marketing banner. Clickable only when it has a link.
 */
export default function BannerCard({ banner, ratio = '21/9' }: BannerCardProps) {
  const { language, isRTL } = useLanguage();
  const title = (language === 'ar' ? banner.titleAr : banner.title) ?? banner.title;
  const subtitle = (language === 'ar' ? banner.subtitleAr : banner.subtitle) ?? banner.subtitle;
  const button = (language === 'ar' ? banner.buttonTextAr : banner.buttonText) ?? banner.buttonText;
  const href = bannerHref(banner);
  // "24/7" → the height as a share of the width, for the spacer below.
  const [ratioW, ratioH] = ratio.split('/').map((part) => Number(part.trim()));
  const ratioPadding = ratioW > 0 && ratioH > 0 ? `${(ratioH / ratioW) * 100}%` : '42.857%';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
    >
      {/* The spacer and the text share one grid cell, so the card keeps its
          shape but is never shorter than its text (a wide ratio on a narrow
          phone used to cut the title and button off). */}
      <BannerLink
        href={href}
        external={banner.external}
        className="group relative grid overflow-hidden rounded-2xl"
        style={{ backgroundColor: banner.bgColor ?? '#2D1F1F' }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div aria-hidden className="col-start-1 row-start-1" style={{ paddingTop: ratioPadding }} />
        {/* Desktop / mobile art */}
        <Image
          src={banner.imageDesktop}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105 hidden sm:block"
        />
        <Image
          src={banner.imageMobile}
          alt={title}
          fill
          sizes="100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105 sm:hidden"
        />

        {/* Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t ${isRTL ? 'sm:bg-gradient-to-l' : 'sm:bg-gradient-to-r'} from-black/75 via-black/30 to-transparent`} />

        {/* Content */}
        <div className={`relative col-start-1 row-start-1 w-full flex flex-col justify-center p-6 sm:p-10 max-w-md ${isRTL ? 'text-right items-end ml-auto' : 'text-left items-start'}`}>
          <h3
            className="font-serif font-bold leading-tight mb-2"
            style={{ color: banner.textColor ?? '#F5F0E8', fontSize: 'clamp(1.4rem, 3vw, 2.2rem)' }}
          >
            {title}
          </h3>
          {subtitle ? (
            <p className="text-white/75 text-sm sm:text-base mb-5 line-clamp-2">{subtitle}</p>
          ) : null}
          <BannerOfferNote banner={banner} className="-mt-3 mb-5 text-white/70 text-xs sm:text-sm" />
          {href ? (
            <span className="inline-flex items-center gap-2 bg-[#C9A84C] text-[#2D1F1F] px-6 py-3 text-[11px] font-black tracking-[0.2em] uppercase rounded-md group-hover:bg-white transition-colors duration-300">
              {button}
              <ChevronRight size={14} className={`transition-transform duration-300 group-hover:translate-x-1 ${isRTL ? 'rotate-180' : ''}`} />
            </span>
          ) : null}
        </div>
      </BannerLink>
    </motion.div>
  );
}
