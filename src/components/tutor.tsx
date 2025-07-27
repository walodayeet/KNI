"use client";

import { useTranslations } from "next-intl";

// Images will be referenced directly as strings in src attributes
import { IoIosSchool } from "react-icons/io";
import { FaGoogleScholar } from "react-icons/fa6";
import { FcEngineering } from "react-icons/fc";
import { FaCheck } from "react-icons/fa";

import { renderDescriptionWithMultipleHighlights } from '@/utils/render-utils'

export default function Tutor() {
  const t = useTranslations("HomePage.tutor");

  const listItem = (children: any, ICON : any, iconColor="orange") => {
    return <li className="flex items-center">
        <div className="h-12 min-w-12 flex items-center justify-center">
            <ICON className={`text-${iconColor}-600`} size={24} />
        </div>
        <p className="text-xl text-gray-500">
            {children}
        </p>
    </li>
}

  return (
    <section className="min-h-screen bg-gray-50 snap-center pt-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: Images */}
          <div className="relative order-2 md:order-1 h-full w-full">
            {/* Main Image */}
            <img
              src="/images/tutor-grad.png"
              width={300}
              height={550}
              alt="Tutor Main"
              className="rounded-lg shadow-md"
              data-aos="fade-right"
              data-aos-delay="100"
            />
            {/* Secondary Image (Overlapping) */}
            <img
              src="/images/tutor-like.jpg"
              width={350}
              height={200}
              alt="Tutor Secondary"
              className="absolute bottom-0 right-0 shadow-md border-amber-50 border-5"
              data-aos="fade-right"
              data-aos-delay="200"
            />
            {/* Circular Badge */}
            <div
              className="absolute top-15 right-10 transform bg-white rounded-full p-4 shadow-md"
              data-aos="fade-up"
              data-aos-delay="300"
            >
              <img
                src="/images/VGU.png"
                width={100}
                height={100}
                alt="Education Award"
                className="rounded-full"
              />
            </div>
          </div>
          {/* Right: Text Content */}
          <div className="order-1 md:order-2">
            {/* Label */}
            <p
              className="text-sm uppercase text-red-600 font-semibold tracking-wider mb-2"
              data-aos="fade-left"
              data-aos-delay="100"
            >
              {t("label")}
            </p>
            {/* Heading */}
            <h2
              className="text-4xl md:text-5xl font-bold text-black mb-6"
              data-aos="fade-left"
              data-aos-delay="200"
            >
              {renderDescriptionWithMultipleHighlights(t("title"), ["đồng hành"], 'text-orange-500')}
            </h2>
            {/* Subheading */}
            <h3
              className="text-2xl font-semibold text-gray-800 mb-4"
              data-aos="fade-left"
              data-aos-delay="300"
            >
              {t("subheading")}
            </h3>
            {/* Description (List) */}
            <ul
              className="text-gray-600 mb-6 space-y-2"
              data-aos="fade-left"
              data-aos-delay="400"
            >
              {listItem(t("description.item1"), IoIosSchool)}
              {listItem(t("description.item2"), FaGoogleScholar)}
              {listItem(t("description.item3"), FcEngineering)}
              <li className="flex items-center">
                <div className="h-12 min-w-12 flex items-center justify-center">
                    <img
                        src="/images/TestASLogo.png"
                        width={25}
                        height={25}
                        alt="Tutor Signature"
                        className="rounded-full"
                    />
                </div>
                <p className="text-xl text-gray-500">
                    {renderDescriptionWithMultipleHighlights(t("description.item4"), ["125/130"], 'text-orange-500 font-bold')}
                </p>
            </li>
              {listItem(renderDescriptionWithMultipleHighlights(t("description.item5"), ["95%"], 'text-orange-500 font-bold'), FaCheck)}
              
            </ul>
            {/* Highlighted Quote */}
            <blockquote
              className="border-l-4 border-red-600 pl-4 text-gray-600 italic mb-6"
              data-aos="fade-left"
              data-aos-delay="500"
            >
              {t("quote")}
            </blockquote>
            {/* Signature */}
            <div
              className="flex items-center space-x-4"
              data-aos="fade-left"
              data-aos-delay="600"
            >
              <img
                src="/images/tutor-sig.jpg"
                width={50}
                height={50}
                alt="Tutor Signature"
                className="rounded-full"
              />
              <div>
                <p className="text-black font-semibold">{t("signature.name")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}