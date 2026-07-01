import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'FinJourney — Level Up Your Financial Life',
  description:
    'Build better money habits through daily budgeting, visible progress, and long-term financial challenges designed to keep you consistent.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* Global background and text colors stay here so they apply to all pages */}
      <body className="bg-abyssal-slate text-pearl-text font-sans min-h-screen flex flex-col">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}