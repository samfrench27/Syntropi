import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Mock bank | Syntropi',
  description: 'The practice bank for Syntropi test payments. No real money moves.',
  // The page URL carries a payment token: never leak it in a Referer header.
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9ecfa' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0d24' },
  ],
};

/** Light or dark follows the system setting (and its changes). Runs before first paint. */
const modeScript = `
(function(){try{
  var q=matchMedia('(prefers-color-scheme: dark)');
  var set=function(){document.documentElement.dataset.mode=q.matches?'dark':'light';};
  set();
  q.addEventListener('change',set);
}catch(e){document.documentElement.dataset.mode='light';}})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: modeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
