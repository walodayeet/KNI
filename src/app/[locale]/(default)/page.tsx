import Hero from "@/components/hero-home";
import LargeTestimonial from "@/components/large-testimonial";
import Cta from "@/components/cta";
import WhatIsTestAS from "@/components/whatistestas";
import Preparation from "@/components/preparation";
import Tutor from "@/components/tutor";
import RoadMap from "@/components/roadmap";
import CustomerReviews from "@/components/reviews";
import { Metadata } from "next";
import { setRequestLocale } from 'next-intl/server';
import {routing} from '@/i18n/routing';

export const metadata: Metadata = {
  title: {
    default: "KNI Education - TestAS Preparation & Study Abroad Guidance",
    template: "%s | KNI Education",
  },
  description:
    "Prepare for TestAS and study abroad with KNI Education. Expert guidance, free practice tests, and consultation for VGU and German universities.",
  keywords: [
    "TestAS preparation",
    "study in Germany",
    "VGU preparation",
    "KNI Education",
    "free TestAS practice",
    "study abroad consultation",
  ],
  openGraph: {
    title: "KNI Education - TestAS Preparation & Study Abroad Guidance",
    description:
      "Prepare for TestAS and study abroad with KNI Education. Expert guidance, free practice tests, and consultation for VGU and German universities.",
    url: "https://kni.vn",
    siteName: "KNI Education",
    images: [
      {
        url: "https://kni.vn/images/og-image-home.jpg",
        width: 1200,
        height: 630,
        alt: "KNI Education - TestAS Preparation",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KNI Education - TestAS Preparation & Study Abroad Guidance",
    description:
      "Prepare for TestAS and study abroad with KNI Education. Expert guidance, free practice tests, and consultation for VGU and German universities.",
    images: ["https://kni.vn/images/twitter-image-home.jpg"],
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function Home({params} : any) {
  const {locale} = await params;
 
  // Enable static rendering
  setRequestLocale(locale);
  
  return (
    <>
      <Hero />
      <WhatIsTestAS/>
      {/* <BusinessCategories /> */}
      <Preparation/>
      <Tutor/>
      <RoadMap />
      {/* <FeaturesPlanet /> */}
      <CustomerReviews/>
      <LargeTestimonial />
      <Cta />
    </>
  );
}
