import type { MetadataRoute } from 'next';

// Manifest PWA: membuat aplikasi bisa di-install ke layar utama (Android Chrome: "Instal aplikasi").
// Syarat browser: manifest ini valid + situs dibuka lewat HTTPS. Tidak memakai service worker (tanpa cache offline),
// supaya data project selalu diambil langsung dari server.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'InDeTrack - Project Tracking System',
    short_name: 'InDeTrack',
    description: 'Tool internal untuk memantau progres project',
    lang: 'id',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ea580c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
