import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from '@/i18n/navigation'

export default function ThankYouPage({ params }: any) {
  const { locale } = use<any>(params);

  // Enable static rendering
  setRequestLocale(locale);

  const t = useTranslations("ThankYou");

  return (
    <div className=" bg-white flex items-center justify-center pt-24 pb-6">
      <div className="max-w-6xl p-8 w-full text-center">
        {/* Checkmark Icon */}
        {/* <div className="flex justify-center mb-6">
          <svg
            className="w-12 h-12 text-orange-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div> */}

        {/* Main Content */}
        <h1 className="text-4xl font-bold text-orange-600 mb-4">
          {t("title")} <span className="text-orange-600">!</span>
        </h1>
        <p className="text-gray-600 mb-2">{t("subtitle")}</p>
        <p className="text-gray-600 mb-4 font-bold">{t("checkSpam")}</p>
        <h2 className="text-2xl font-semibold text-orange-600 mb-4">
          {t("freeVideoTitle")}
        </h2>
        <p className="text-gray-600 mb-6">{t("freeVideoDescription")}</p>
        <p className="text-gray-600 mb-6">{t("contactPrompt")}</p>

        {/* Register Now Button */}
        <Link
          href="/consultation"
          className="inline-block bg-orange-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-orange-600 transition-colors"
        >
          {t("registerNow")}
        </Link>

        {/* Social Media Links */}
        {/* <div className="flex justify-center space-x-4 mt-6">
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-blue-600"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-pink-600"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.326 3.608 1.301.975.975 1.24 2.242 1.301 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.326 2.633-1.301 3.608-.975.975-2.242 1.24-3.608 1.301-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.326-3.608-1.301-.975-.975-1.24-2.242-1.301-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.326-2.633 1.301-3.608.975-.975 2.242-1.24 3.608-1.301 1.266-.058 1.646-.07 4.85-.07zm0-2.163C8.735 0 8.332.013 7.052.072 5.766.132 4.326.41 3.042 1.694 1.757 2.979 1.48 4.419 1.42 5.705.013 8.332 0 8.735 0 12s.013 3.668.072 4.948c.06 1.286.338 2.726 1.622 4.011 1.285 1.285 2.725 1.563 4.011 1.622 1.28.059 1.683.072 4.948.072s3.668-.013 4.948-.072c1.286-.06 2.726-.338 4.011-1.622 1.285-1.285 1.563-2.725 1.622-4.011.059-1.28.072-1.683.072-4.948s-.013-3.668-.072-4.948c-.06-1.286-.338-2.726-1.622-4.011-1.285-1.285-2.725-1.563-4.011-1.622C15.668.013 15.265 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z" />
            </svg>
          </a>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-red-600"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M23.498 6.186a2.977 2.977 0 00-2.094-2.094C19.92 3.5 12 3.5 12 3.5s-7.92 0-9.404.592A2.977 2.977 0 00.502 6.186 31.09 31.09 0 000 12a31.09 31.09 0 00.502 5.814 2.977 2.977 0 002.094 2.094C4.08 20.5 12 20.5 12 20.5s7.92 0 9.404-.592a2.977 2.977 0 002.094-2.094A31.09 31.09 0 0024 12a31.09 31.09 0 00-.502-5.814zM9.6 15.6V8.4l6.4 3.6-6.4 3.6z" />
            </svg>
          </a>
        </div> */}
      </div>
    </div>
  );
}
