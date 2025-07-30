import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import ClientLayout from './index'
import AOSInitializer from '@/components/AOSInitializer'
import { AuthProvider } from '@/context/AuthContext';
import Head from 'next/head';
import {setRequestLocale} from 'next-intl/server';
import '../../css/style.css' 
import Script from 'next/script';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};
 
export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function DefaultLayout({
  children,
  params
}: Props) {
  // Ensure that the incoming `locale` is valid
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Load messages for the locale
  let messages;
  try {
    messages = (await import(`../../../../messages/${locale}.json`)).default;
  } catch (error) {
    notFound();
  }

  return (
    <>
      <Head>
        <title>KNI - TestAS</title>
        <meta name="description" content="A brief description of your page" />
        <meta name="keywords" content="Next.js, SEO, optimization, TestAS, Test for Academic Studies, KNI, Khanh Nhat Institute" />
      </Head>
      <link
          rel="icon"
          href="/icon.png"
          type="image/png"
          sizes="32"
        />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthProvider>
          <ClientLayout params={params}>
            <AOSInitializer />{children}
          </ClientLayout>
        </AuthProvider>
      </NextIntlClientProvider>
      <Script strategy="afterInteractive" src="https://www.googletagmanager.com/gtag/js?id=G-22N9GX8CS1"></Script>
      <Script>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
        
          gtag('config', 'G-22N9GX8CS1');
        `}
      </Script>
    </>
  );
}