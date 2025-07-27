import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

type Props = {
  children: ReactNode;
};

export const metadata = {
  title: 'KNI Project',
  description: 'KNI Project with PostgreSQL Integration',
};

// Since we have a `not-found.tsx` page on the root, a layout file
// is required, even if it's just passing children through.
export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data: fonts.googleapis.com fonts.gstatic.com; connect-src 'self' https://sibforms.com; img-src 'self' data: https: blob: images.unsplash.com static.wixstatic.com; object-src 'none'; base-uri 'self'; form-action 'self';"
        />
      </head>
      <body className={`${inter.className}`}>
        {children}
      </body>
    </html>
  );
}