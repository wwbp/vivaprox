import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'R4 Zoom Concierge',
  description: 'Minimal bot join/leave concierge for Zoom integration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
