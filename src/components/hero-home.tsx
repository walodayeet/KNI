import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
// Images are now referenced directly as strings in src attributes
import KNILogo from "./ui/logo";

export default function HeroHome() {
  const t = useTranslations("HomePage");

  return (
    <section className="relative min-h-screen flex items-center bg-white">
      {/* <div className="absolute inset-0 bg-gray-50"></div> */}
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="text-center md:text-left">
              {/* Heading */}
              <h1
                className="text-5xl md:text-6xl font-bold text-gray-900 mb-4"
                data-aos="fade-in"
                data-aos-delay="100"
              >
                {t("heroTitle").split(". ").map((part, index) => (
                  <span key={index}>
                    {part}
                    {index === 0 && <br className="max-lg:hidden" />}
                    {index === 0 && " "}
                  </span>
                ))}
              </h1>
              {/* Subtitle */}
              <p
                className="text-lg text-gray-700 mb-8"
                data-aos="fade-in"
                data-aos-delay="200"
              >
                {t("heroSubtitle")}
              </p>
              {/* Buttons */}
              <div
                className="flex justify-center md:justify-start space-x-4"
                data-aos="fade-in"
                data-aos-delay="300"
              >
                <Link
                  href="/consultation"
                  className="btn bg-orange-500 text-white px-12 py-3 rounded-full shadow-5xl shadow-orange-500/50 hover:bg-orange-600 transition font-bold"
                >
                  {t("enrollNow")} <span className="ml-2">→</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="btn border border-blue-900 text-blue-900 px-6 py-3 rounded-full shadow-md hover:bg-blue-50 transition font-bold"
                >
                  Dashboard <span className="ml-2">📊</span>
                </Link>
              </div>
              {/* Stats Cards */}
              <div
                className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 max-w-3xl mx-auto md:mx-0"
                data-aos="fade-in"
                data-aos-delay="400"
              >
                <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center justify-between min-h-[120px]">
                  <p className="text-sm text-gray-500 text-center flex items-center"
                    style={{flexGrow: 1}}
                  >{t("stats.mentorsAvailable")}</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">15+</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center justify-between min-h-[120px]">
                  <p className="text-sm text-gray-500 text-center flex items-center" style={{flexGrow: 1}}>{t("stats.yearsExperience")}</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">2+</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center justify-between min-h-[120px]">
                  <p className="text-sm text-gray-500 text-center flex items-center" style={{flexGrow: 1}}>{t("stats.studentsTrained")}</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-2">100+</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center justify-between min-h-[120px] ">
                  <p className="text-sm text-gray-500 text-center flex items-center" style={{flexGrow: 1}}>{t("stats.startupsLaunched")}</p>
                  <p className="text-2xl font-semibold text-orange-500 mt-2">95%</p>
                </div>
              </div>
            </div>
            {/* Hero Image */}
            <div
              className="hidden md:block"
              data-aos="fade-in"
              data-aos-delay="500"
            >
              <KNILogo/>
              <img
                src="/images/BG.png"
                width={500}
                height={400}
                alt="Entrepreneurship workshop at KNI"
                className="rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}