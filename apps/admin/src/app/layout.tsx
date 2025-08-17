import { Providers } from '@/components/providers/Providers';
import { adminConfig } from '@/config/app.config';
import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: adminConfig.app.name,
    template: `%s | ${adminConfig.app.name}`,
  },
  description: adminConfig.app.description,
  keywords: ['admin', 'dashboard', 'task management', 'monitoring', 'analytics'],
  authors: [{ name: 'TaskManagement Team' }],
  creator: 'TaskManagement Team',
  publisher: 'TaskManagement',
  robots: {
    index: false, // Admin dashboard should not be indexed
    follow: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: adminConfig.app.url,
    title: adminConfig.app.name,
    description: adminConfig.app.description,
    siteName: adminConfig.app.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: adminConfig.app.name,
    description: adminConfig.app.description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}