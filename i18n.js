import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "vn"];
export const defaultLocale = "vn";

export default getRequestConfig(async ({ locale }) => {
  const validLocale = locales.includes(locale) ? locale : defaultLocale;
  return {
    messages: (await import(`./messages/${validLocale}.json`)).default,
  };
});