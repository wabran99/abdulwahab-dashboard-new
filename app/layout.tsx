import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Abdulwahab Executive Dashboard',
  description: 'Live executive dashboard connected to Google Sheets.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
