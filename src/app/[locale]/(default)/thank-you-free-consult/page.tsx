import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function ThankYouPage({ params }: any) {
  const { locale } = use<any>(params);

  // Enable static rendering
  setRequestLocale(locale);

  const t = useTranslations("ThankYouFreeConsult");

  return (
    <div className=" bg-white flex items-center justify-center pt-24 pb-6">
      <div className="max-w-6xl p-8 w-full text-center">
        {/* Main Content */}
        <h1 className="text-4xl font-bold text-orange-600 mb-4">
          {t("title")} <span className="text-orange-600">!</span>
        </h1>
        <h3 className="text-gray-600 text-3xl mb-2">{t("subtitle_1")}</h3>
        <h3 className="text-gray-600 mb-2">{t("subtitle_2")}</h3>
      </div>
    </div>
  );
}
