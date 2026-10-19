import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/onest';
import './globals.css';
import './night-studio.css';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `${siteConfig.brand} — сайты в новом свете`,
  description: siteConfig.description,
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#030810', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
