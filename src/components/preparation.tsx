"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { FaCheckCircle, FaQuestionCircle } from "react-icons/fa";
import { AiTwotoneQuestionCircle } from "react-icons/ai";
import { renderDescriptionWithMultipleHighlights } from '@/utils/render-utils';

const images = [
  "/images/self-study.jpg",
  "/images/gather-online.jpg",
  "/images/academy-study.jpg",
];

const blurImages = [
  "/images/self-study_blur.jpg",
  "/images/gather-online_blur.jpg",
  "/images/academy-study_blur.jpg",
];

export default function Preparation() {
  const t = useTranslations("HomePage.preparation");
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // IntersectionObserver to detect which text section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = sectionRefs.current.indexOf(
              entry.target as HTMLDivElement
            );
            setActiveSection(index);
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of the section is in view
        rootMargin: "0px 0px -20% 0px", // Adjust to fine-tune the trigger point
      }
    );

    sectionRefs.current.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => {
      sectionRefs.current.forEach((section) => {
        if (section) observer.unobserve(section);
      });
    };
  }, []);

    const listItem = (children: any, ICON = FaCheckCircle, iconColor="orange") => {
        return <li className="flex items-center mb-8">
            <div className="h-16 min-w-16 flex items-center justify-center">
                <ICON className={`text-${iconColor}-600`} size={24} />
            </div>
            <p className="text-xl text-gray-300">
                {children}
            </p>
        </li>
    }

  return (
    <section
      className="min-h-[300vh] bg-gray-900 text-white snap-start pt-96 md:pt-24"
      data-aos="fade-up"
      data-aos-delay="100"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 w-full">
        {/* Header Section */}
        <div className="text-center mb-16">
          <p className="text-sm uppercase text-orange-500 font-semibold tracking-wider mb-2">
            {t("label")}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            {t("title")}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left: Image */}
          <div className="order-2 md:order-1 sticky top-20">
            <Image
                key={0}
                src={images[0]}
                width={500}
                height={400}
                alt={t(`sections.0.title`)}
                className={`rounded-lg shadow-md ${activeSection == 0 ? "fade-in-slide-up" : "opacity-0"}`}
                priority
                placeholder="blur"
                blurDataURL={blurImages[0]}
            />
            <Image
                key={1}
                src={images[1]}
                width={500}
                height={300}
                alt={t(`sections.1.title`)}
                className={`rounded-lg shadow-md ${activeSection == 1 ? "fade-in-slide-up" : "opacity-0"}`}
                priority
                placeholder="blur"
                blurDataURL={blurImages[1]}
            />
            <Image
                key={2}
                src={images[2]}
                width={500}
                height={400}
                alt={t(`sections.2.title`)}
                className={`rounded-lg shadow-md ${activeSection == 2 ? "fade-in-slide-up" : "opacity-0"}`}
                priority
                placeholder="blur"
                blurDataURL={blurImages[2]}
            />
          </div>
          {/* Right: Text Sections */}
          <div className="order-1 md:order-2">
            {/* Text Sections */}
            <div className="space-y-32">
              {/* Section 1: Self-Study */}
              <div
                ref={(el: any) => (sectionRefs.current[0] = el)}
                className="min-h-[80vh] flex flex-col justify-center snap-center"
              >
                <h3 className="text-5xl font-semibold mb-12">
                  {t("sections.0.title")}
                </h3>
                <ul>
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.0.description_1"), ["IELTS 7.5", "tiếng Đức C1", "German C1 level"], "text-orange-600 font-bold"))}
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.0.description_2"), ["tiếng Anh", "Đức", "English", "German"], "text-orange-600 font-bold"))}
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.0.description_3"), ["tiếng Anh", "Đức", "English", "German"], "text-orange-600 font-bold"))}
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.0.description_4"), ["IELTS 7.5", "tiếng Đức C1", "German C1 level"], "text-orange-600 font-bold"))}
                </ul>

              </div>
              {/* Section 2: Online Resources */}
              <div
                ref={(el: any) => (sectionRefs.current[1] = el)}
                className="min-h-[80vh] flex flex-col justify-center snap-center"
              >
                <h3 className="text-5xl font-semibold mb-12">
                  {t("sections.1.title")}
                </h3>
                <ul>
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.1.description_1"), ["Preparation for TestAS"], "text-orange-600 font-bold"), FaQuestionCircle)}
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.1.description_2"), ["tiếng Anh", "Đức", "English", "German"], "text-orange-600 font-bold"), FaQuestionCircle)}
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.1.description_3"), ["tiếng Anh", "Đức", "English", "German"], "text-orange-600 font-bold"), FaQuestionCircle)}
                </ul>
              </div>
              {/* Section 3: Study Abroad Center */}
              <div
                ref={(el: any) => (sectionRefs.current[2] = el)}
                className="min-h-[95vh] flex flex-col justify-center snap-center"
              >
                <h3 className="text-5xl font-semibold mb-12">
                  {t("sections.2.title")}
                </h3>
                <ul>
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.2.description_1"), ["Preparation for TestAS"], "text-orange-600 font-bold"), FaQuestionCircle)}
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.2.description_2"), ["tiếng Anh", "Đức", "English", "German"], "text-orange-600 font-bold"), FaQuestionCircle)}
                    {listItem(renderDescriptionWithMultipleHighlights(t("sections.2.description_3"), ["tiếng Anh", "Đức", "English", "German"], "text-orange-600 font-bold"), FaCheckCircle, "green")}
                </ul>
                {/* Buttons */}
                <div className="flex space-x-4 mt-8 justify-end">
                  {/* <a
                    href="#case-study"
                    className="px-6 py-3 border border-white text-white rounded-full hover:bg-white hover:text-gray-900 transition"
                  >
                    {t("buttons.caseStudy")}
                  </a> */}
                  {/* <a
                    href="#book-a-call"
                    className="px-6 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition"
                  >
                    {t("buttons.bookACall")}
                  </a> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
