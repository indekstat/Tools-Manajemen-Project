import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '../components/Sidebar';
import AuthGuard from '../components/AuthGuard';
import Toast from '../components/Toast';
import ConfirmHost from '../components/ConfirmHost';

import { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ea580c',
};

export const metadata: Metadata = {
  title: 'InDeTrack - Project Tracking System',
  description: 'Premium internal tool for tracking project progress',
  icons: {
    icon: '/Favicon.png',
    shortcut: '/Favicon.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'InDeTrack',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <AuthGuard>
          <div className="app-container">
            <Sidebar />
            <div className="main-content">
              {children}
            </div>
          </div>
        </AuthGuard>
        <Toast />
        <ConfirmHost />
      </body>
    </html>
  );
}
