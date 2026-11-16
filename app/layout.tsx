import type { Metadata, Viewport } from 'next';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#0b0f1a',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'STEM Radar — Global STEM Discovery Hub',
  description:
    'A global STEM discovery hub tracking breakthroughs across space, aerospace, robotics, AI, electronics, scientific instruments, and research.',
  manifest: './manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'STEM Radar',
  },
  icons: {
    icon: [
      { url: './icon.svg', type: 'image/svg+xml' },
      { url: './pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: './pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: './apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'STEM Radar — Global STEM Discovery Hub',
    description:
      'A global STEM discovery hub tracking breakthroughs across space, aerospace, robotics, AI, electronics, scientific instruments, and research.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STEM Radar — Global STEM Discovery Hub',
    description:
      'A global STEM discovery hub tracking breakthroughs across space, aerospace, robotics, AI, electronics, scientific instruments, and research.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-[#f5f7fa] text-[#0f172a] dark:bg-[#0b0f1a] dark:text-[#f1f5f9] selection:bg-[#1b4dff]/20 dark:selection:bg-[#4d7cff]/30"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
