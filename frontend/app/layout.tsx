import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '../components/Sidebar';
import AuthGuard from '../components/AuthGuard';

export const metadata: Metadata = {
  title: 'InDeTrack - Project Tracking System',
  description: 'Premium internal tool for tracking project progress',
  icons: {
    icon: '/Favicon.png',
    shortcut: '/Favicon.png',
    apple: '/Favicon.png',
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
      </body>
    </html>
  );
}
