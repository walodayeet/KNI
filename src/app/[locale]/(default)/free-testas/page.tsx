import { useTranslations } from "next-intl";
// Images are now referenced directly as strings in src attributes
import { Metadata } from "next";

import Head from "next/head";
import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import BrevoForm from "@/components/brevo/form";

// Inside the component, before the return statement
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "KNI Education",
      url: "https://kni.vn",
      logo: "https://kni.vn/images/logo.png",
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: "+84-123-456-789",
          contactType: "customer service",
          areaServed: "VN",
          availableLanguage: ["English", "Vietnamese"],
        },
      ],
      sameAs: [
        "https://facebook.com/kni-education",
        "https://twitter.com/kni-education",
        "https://instagram.com/kni-education",
      ],
    },
    {
      "@type": "WebPage",
      url: "https://kni.vn/free-testas",
      name: "Free TestAS Practice & Consultation | KNI Education",
      description:
        "Get free TestAS practice tests and book a consultation with KNI Education. Prepare for TestAS, VGU, and study in Germany with expert guidance.",
      inLanguage: "en-US",
      publisher: {
        "@type": "Organization",
        name: "KNI Education",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Free TestAS Practice & Consultation | KNI Education",
    template: "%s | KNI Education",
  },
  description:
    "Get free TestAS practice tests and book a consultation with KNI Education. Prepare for TestAS, VGU, and study in Germany with expert guidance.",
  keywords: [
    "TestAS practice",
    "free TestAS test",
    "TestAS preparation",
    "study in Germany",
    "VGU consultation",
    "KNI Education",
    "free trial class",
  ],
  openGraph: {
    title: "Free TestAS Practice & Consultation | KNI Education",
    description:
      "Prepare for TestAS with free practice tests and expert consultation from KNI Education. Start your journey to study in Germany today!",
    url: "https://kni.vn/free-testas",
    siteName: "KNI Education",
    images: [
      {
        url: "https://kni.vn/images/og-image.jpg", // Replace with your actual image
        width: 1200,
        height: 630,
        alt: "KNI Education - Free TestAS Practice",
      },
    ],
    locale: "vn_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free TestAS Practice & Consultation | KNI Education",
    description:
      "Prepare for TestAS with free practice tests and expert consultation from KNI Education. Start your journey to study in Germany today!",
    images: ["https://kni.vn/images/twitter-image.jpg"], // Replace with your actual image
  },
};

export default function FreeTestAS({ params }: any) {
  const { locale } = use<any>(params);

  // Enable static rendering
  setRequestLocale(locale);

  const t = useTranslations("FreeTestAS");

  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>
      {/* Free TestAS Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 via-orange-50 to-red-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="order-1" data-aos="fade-right" data-aos-delay="100">
              <p className="inline-block mb-4 px-4 py-1 bg-orange-100 text-orange-600 text-sm font-semibold rounded-full uppercase tracking-wider">
                {t("label")}
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                {t("title")} <span className="text-orange-500">.</span>
              </h1>
              <p className="text-lg text-gray-600 mb-4 italic font-medium">
                &quot;{t("quote")}&quot;
              </p>
              <p className="text-lg text-gray-700 mb-4">
                {t("description.line1")}
              </p>
              <p className="text-lg text-gray-700 mb-8">
                {t("description.line2")}
              </p>
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <BrevoForm />
              </div>
            </div>

            {/* Right: Image */}
            <div className="order-2 flex justify-center md:justify-end" data-aos="fade-left" data-aos-delay="200">
              <div className="relative">
                <img
                  src="/images/documents.jpg"
                  width={500}
                  height={500}
                  alt="Free TestAS Practice Materials"
                  className="rounded-2xl shadow-2xl"
                />
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-2xl font-bold">FREE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
