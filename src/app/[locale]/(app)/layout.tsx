import { NextIntlClientProvider } from 'next-intl';
import { AuthProvider } from '@/context/AuthContext';
import { routing } from '@/i18n/routing';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import AppLayoutClient from './app-layout-client';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function AppLayout({ children, params }: Props) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <NextIntlClientProvider locale={locale}>
      <AuthProvider>
        <AppLayoutClient>
          {children}
        </AppLayoutClient>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}