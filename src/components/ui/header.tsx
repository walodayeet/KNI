import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
// Images are now referenced directly as strings in src attributes

export default function Header() {
  const t = useTranslations("HomePage");
  const locale = useLocale();
  const pathname = usePathname(); // Use usePathname to get the current path
  const [isOpen, setIsOpen] = useState(false);



  // Function to construct the new URL with the new locale
  const getLocalizedPath = (newLocale: string) => {
    // Add safety checks for undefined values
    if (!pathname || !locale || !newLocale) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('getLocalizedPath: undefined values detected', { pathname, locale, newLocale });
      }
      return `/${newLocale || 'vn'}`;
    }
    
    const pathSegments = pathname.split("/").filter(segment => segment);
    const pathWithoutLocale = pathSegments.length > 0 && pathSegments[0] === locale
      ? `/${pathSegments.slice(1).join("/")}`
      : pathname;
    return `/${newLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
  };

  // Function to determine if a link is active
  const isActiveLink = (href: string) => {
    // Add safety checks for undefined values
    if (!pathname || !locale || !href) {
      return false;
    }
    
    // Strip the locale from the pathname
    const pathSegments = pathname.split("/").filter(segment => segment);
    const pathWithoutLocale = pathSegments.length > 0 && pathSegments[0] === locale
      ? `/${pathSegments.slice(1).join("/")}`
      : pathname;

    // Handle the root path ("/")
    if (href === "/") {
      return pathWithoutLocale === "/" || pathWithoutLocale === `/${locale}`;
    }

    // Compare the href with the path without locale
    return pathWithoutLocale === href;
  };
  const navClassName = (ref : string) => {
    return `${isActiveLink(ref) ? "text-orange-500" : "text-gray-900"
    } hover:text-orange-500 transition-colors`
  }

  return (
    <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <img
                src="/images/logo.avif"
                width={48}
                height={48}
                alt="KNI Logo"
                className="hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>

          {/* Hamburger Menu for Mobile */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-900 focus:outline-none"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav
            className={`${
              isOpen ? "block" : "hidden"
            } md:flex md:items-center md:space-x-6 absolute md:static top-16 left-0 right-0 bg-white md:bg-transparent p-4 md:p-0 shadow-md md:shadow-none`}
          >
            <div className="flex flex-col md:flex-row md:space-x-6 space-y-4 md:space-y-0">
              <Link
                href="/"
                className={navClassName('/')}
              >
                {t("home")}
              </Link>
              <Link
                href="/consultation"
                className={navClassName('/consultation')}
              >
                {t("consultation")}
              </Link>
              <Link
                href="/free-testas"
                className={navClassName(`/free-testas`)}
              >
                {t("freeTest")}
              </Link>
              <Link
                href="/contact"
                className={navClassName(`/contact`)}
              >
                {t("contact")}
              </Link>
              <Link
                href="/dashboard"
                className={navClassName(`/dashboard`)}
              >
                {t("dashboard")}
              </Link>
              {/* Language Toggle */}
              <div className="flex items-center space-x-2">
                <Link
                  href={getLocalizedPath("vn")}
                  prefetch={false}
                  className={`${
                    locale === "vn" ? "text-orange-500" : "text-gray-900"
                  } hover:text-orange-500 transition-colors`}
                  aria-label="Switch to Vietnamese"
                >
                  VN
                </Link>
                <span className="text-gray-400">|</span>
                <Link
                  href={getLocalizedPath("en")}
                  prefetch={false}
                  className={`${
                    locale === "en" ? "text-orange-500" : "text-gray-900"
                  } hover:text-orange-500 transition-colors`}
                  aria-label="Switch to English"
                >
                  EN
                </Link>
              </div>
            </div>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Link
              href="/consultation"
              className="bg-orange-500 text-white px-5 py-2 rounded-full shadow-md hover:bg-orange-600 transition-colors"
            >
              {t("signup")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}