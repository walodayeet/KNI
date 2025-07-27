import { useTranslations } from "next-intl";
// Images are now referenced directly as strings in src attributes
import {setRequestLocale} from 'next-intl/server';
import { use } from "react";
import ConsultationForm from "@/components/brevo/consultation-form";

export default function Consultation({ params }: any) {
  const {locale} = use<any>(params);
 
  // Enable static rendering
  setRequestLocale(locale);

  const t = useTranslations("Consultation");

  return (
    <section className="py-16 bg-gradient-to-br from-gray-50 via-orange-50 to-red-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="order-1" data-aos="fade-right" data-aos-delay="100">
            <p className="inline-block mb-4 px-4 py-1 bg-orange-100 text-orange-600 text-sm font-semibold rounded-full uppercase tracking-wider">
              {t("label")}
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {t("title")} {t("free")}<span className="text-orange-500">.</span>
            </h1>
            <p className="text-lg text-gray-700 mb-8">
              {t("description.line1")} {t("description.line2")} {t("description.line3")}
            </p>
            {/* <p
              className="text-gray-600 mb-4"
              data-aos="fade-right"
              data-aos-delay="400"
            >

            </p> */}
            {/* <p
              className="text-gray-600 mb-4"
              data-aos="fade-right"
              data-aos-delay="500"
            >
              
            </p> */}
            <div className="bg-orange-50 p-6 rounded-xl border-l-4 border-orange-500 mb-8">
              <p className="text-orange-700 font-bold text-lg">
                {t("description.line4")}
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
              <ConsultationForm/>
            </div>
          </div>

          {/* Right: Image */}
          <div className="order-2 flex justify-center md:justify-end" data-aos="fade-left" data-aos-delay="200">
            <div className="relative">
              <img
                src="/images/consultant.jpg"
                width={450}
                height={450}
                alt="Professional TestAS Consultation"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -top-4 -left-4 w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-sm font-bold">1-on-1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}