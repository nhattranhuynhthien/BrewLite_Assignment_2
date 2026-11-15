import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Pwa } from '../components/Pwa';
import { Shell } from '../components/Shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrewLite — Pha mới mỗi ngày',
  description: 'Chọn đồ uống, tùy biến size/topping, đặt và nhận tại quầy.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Pwa />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
