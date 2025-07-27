import { useTranslations } from "next-intl";
import { FaCheckCircle, FaExclamationTriangle, FaFileAlt, FaUsers, FaBolt, FaArrowUp } from "react-icons/fa";

export default function WhatIsTestAS() {
  const t = useTranslations("HomePage");

  return (
    <section className="py-16 bg-gray-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
        {/* Label */}
        <div
          className="inline-block mb-4 px-4 py-1 bg-gray-200 text-gray-700 text-sm font-semibold rounded-full"
          data-aos="fade-down"
        >
          {t("whatIsTestAS.label")}
        </div>
        {/* Heading */}
        <h2
          className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          data-aos="fade-down"
          data-aos-delay="100"
        >
          {t("whatIsTestAS.title")}
        </h2>
        {/* Subtitle */}
        <p
          className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto"
          data-aos="fade-down"
          data-aos-delay="200"
        >
          {t("whatIsTestAS.subtitle")}
        </p>
        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div
            className="bg-white p-6 rounded-lg shadow-sm"
            data-aos="fade-up"
            data-aos-delay="300"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <FaCheckCircle className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("whatIsTestAS.features.crucial.title")}
            </h3>
            <p className="text-gray-600">
              {t("whatIsTestAS.features.crucial.description")}
            </p>
          </div>
          {/* Card 2 */}
          <div
            className="bg-white p-6 rounded-lg shadow-sm"
            data-aos="fade-up"
            data-aos-delay="400"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <FaExclamationTriangle className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("whatIsTestAS.features.difficulty.title")}
            </h3>
            <p className="text-gray-600">
              {t("whatIsTestAS.features.difficulty.description")}
            </p>
          </div>
          {/* Card 3 */}
          <div
            className="bg-white p-6 rounded-lg shadow-sm"
            data-aos="fade-up"
            data-aos-delay="500"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <FaFileAlt className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("whatIsTestAS.features.sample.title")}
            </h3>
            <p className="text-gray-600">
              {t("whatIsTestAS.features.sample.description")}
            </p>
          </div>
          {/* Card 4 */}
          <div
            className="bg-white p-6 rounded-lg shadow-sm"
            data-aos="fade-up"
            data-aos-delay="600"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <FaUsers className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("whatIsTestAS.features.trusted.title")}
            </h3>
            <p className="text-gray-600">
              {t("whatIsTestAS.features.trusted.description")}
            </p>
          </div>
          {/* Card 5 */}
          <div
            className="bg-white p-6 rounded-lg shadow-sm"
            data-aos="fade-up"
            data-aos-delay="700"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <FaBolt className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("whatIsTestAS.features.preparation.title")}
            </h3>
            <p className="text-gray-600">
              {t("whatIsTestAS.features.preparation.description")}
            </p>
          </div>
          {/* Card 6 */}
          <div
            className="bg-white p-6 rounded-lg shadow-sm"
            data-aos="fade-up"
            data-aos-delay="800"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <FaArrowUp className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("whatIsTestAS.features.competition.title")}
            </h3>
            <p className="text-gray-600">
              {t("whatIsTestAS.features.competition.description")}
            </p>
          </div>
        </div>
        {/* Footer Tags */}
        <div
          className="flex justify-center space-x-6 mt-12 text-sm text-gray-600"
          data-aos="fade-up"
          data-aos-delay="900"
        >
          <span className="flex items-center">
            <FaUsers className="w-4 h-4 mr-2" />
            {t("whatIsTestAS.tags.expertGuidance")}
          </span>
          <span className="border-l border-dashed border-gray-400 h-4"></span>
          <span className="flex items-center">
            <FaExclamationTriangle className="w-4 h-4 mr-2" />
            {t("whatIsTestAS.tags.provenResults")}
          </span>
          <span className="border-l border-dashed border-gray-400 h-4"></span>
          <span className="flex items-center">
            <FaCheckCircle className="w-4 h-4 mr-2" />
            {t("whatIsTestAS.tags.studentSuccess")}
          </span>
        </div>
      </div>
    </section>
  );
}