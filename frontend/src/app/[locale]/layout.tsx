import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { ApiStatusBanner } from '@/components/ApiStatusBanner';
import { Nav } from '@/components/Nav';
import { Providers } from '@/components/Providers';
import { HelpFab } from '@/components/HelpFab';
import { PLATFORM } from '@/lib/site-brand';
import { routing } from '@/i18n/routing';
import '../globals.css';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: 'common' });
  const tl = await getTranslations({ locale, namespace: 'landing' });

  return {
    title: {
      default: t('appName'),
      template: `%s — ${PLATFORM.name}`,
    },
    description: `${tl('heroOutcome')}. ${tl('heroSupport')}`,
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      shortcut: '/favicon.svg',
      apple: '/apple-touch-icon.png',
    },
  };
}

const themeInitScript = `(function(){try{var s=localStorage.getItem('autotube-theme');var t=s||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default async function LocaleRootLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <html lang={locale} className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={GeistSans.className}>
        <a href="#main-content" className="skip-link">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <div className="app-shell">
              <Nav />
              <div className="app-main">
                <ApiStatusBanner />
                <main id="main-content" className="container" tabIndex={-1}>
                  {children}
                </main>
              </div>
            </div>
            <HelpFab />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
