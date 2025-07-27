"use client";

import { useTranslations } from "next-intl";
import { RiNumber1, RiNumber2, RiNumber3, RiNumber4 } from "react-icons/ri";

export default function RoadMap() {
  const t = useTranslations("HomePage.roadmap");

  const steps = [
    {
      icon: RiNumber1, // Replace with your actual icon path
      title: t("steps.0.title"),
      description: t("steps.0.description"),
    },
    {
      icon: RiNumber2, // Replace with your actual icon path
      title: t("steps.1.title"),
      description: t("steps.1.description"),
    },
    {
      icon: RiNumber3, // Replace with your actual icon path
      title: t("steps.2.title"),
      description: t("steps.2.description"),
    },
    {
      icon: RiNumber4, // Replace with your actual icon path
      title: t("steps.3.title"),
      description: t("steps.3.description"),
    },
  ];

  return (
    <section className="min-h-[80vh] bg-white snap-center pt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 w-full">
        {/* Header Section */}
        <div className="text-center mb-12">
          <button
            className="uppercase text-sm text-black border border-black rounded-full px-4 py-2 mb-4"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            {t("label")}
          </button>
          <h2
            className="text-4xl md:text-5xl font-bold text-black mb-4"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            {t("title")}
          </h2>
          <p
            className="text-gray-600 text-center max-w-2xl mx-auto"
            data-aos="fade-up"
            data-aos-delay="300"
          >
            {t("description")}
          </p>
        </div>
        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md p-6 text-center relative flex flex-col justify-between items-center min-h-[200px]" // Added min-h and flex
              data-aos="fade-up"
              data-aos-delay={`${(index + 1) * 100}`}
            >
              <step.icon size={48} className="mx-auto mb-4 text-orange-500" />
              <div className="flex flex-col justify-start flex-grow"> {/* Adjusted for consistent alignment */}
                <h3 className="text-xl font-bold text-black mb-2 flex items-center justify-center" style={{height: "60px", width: "100%"}}>{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
