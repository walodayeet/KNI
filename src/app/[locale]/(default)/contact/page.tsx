import { useTranslations } from "next-intl";
import { FaPhone } from "react-icons/fa";

import { AiFillTikTok } from "react-icons/ai";
import { FaSquareFacebook } from "react-icons/fa6";
import { FaSquareInstagram } from "react-icons/fa6";
import {setRequestLocale} from 'next-intl/server';
import { FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";
import { use } from "react";

export default function Contact({params} : any) {
  const {locale} = use<any>(params);
 
  // Enable static rendering
  setRequestLocale(locale);
  
  const t = useTranslations("Contact");

  const contactItems = [
    // {
    //   icon: <FaBuilding className="text-white text-2xl" />,
    //   label: t("items.0.label"),
    //   value: t("items.0.value"),
    //   isHighlighted: true,
    // },
    {
      icon: <FaPhone className="text-orange-600 text-2xl" />,
      label: t("items.1.label"),
      value: t("items.1.value"),
      isHighlighted: false,
    },
    {
      icon: <FaEnvelope className="text-orange-600 text-2xl" />,
      label: t("items.2.label"),
      value: t("items.2.value"),
      isHighlighted: false,
    },
    {
      icon: <FaMapMarkerAlt className="text-orange-600 text-2xl" />,
      label: t("items.3.label"),
      value: t("items.3.value"),
      isHighlighted: false,
    },
  ];

  return (
    <section id="contact" className="min-h-[50vh] bg-white snap-center pt-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 w-full">
        <h2
          className="text-4xl md:text-5xl font-bold text-black text-center mb-12"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          {t("title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {contactItems.map((item, index) => (
            <div
              key={index}
              className={`border border-gray-200 p-6 text-center ${
                item.isHighlighted ? "bg-red-600 text-white" : "bg-white"
              }`}
              data-aos="fade-up"
              data-aos-delay={`${(index + 1) * 100}`}
            >
              <div className="flex justify-center mb-4">{item.icon}</div>
              <p
                className={`text-sm uppercase mb-2 ${
                  item.isHighlighted ? "text-white" : "text-gray-600"
                }`}
              >
                {item.label}
              </p>
              <p
                className={`${
                  item.isHighlighted ? "text-white" : "text-black"
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
          <div
            key={"social"}
            className="bg-white border border-gray-200 p-6 text-center flex flex-col justify-center "
            data-aos="fade-up"
            data-aos-delay={`${(3 + 1) * 100}`}
          >
            <div className="flex items-center">
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://www.tiktok.com/@khanhnhat.institute"
                className="mx-auto mb-4 text-black-500 hover:scale-110 transition-all cursor-pointer"
                style={{ transitionDuration: "200ms" }}
              >
                <AiFillTikTok size={48} />
              </a>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://www.facebook.com/testascandidates"
                className="mx-auto mb-4 text-blue-500 hover:scale-110 transition-all cursor-pointer"
                style={{ transitionDuration: "200ms" }}
              >
                <FaSquareFacebook size={48} />
              </a>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://www.instagram.com/khanhnhatinstitute/"
                className="mx-auto mb-4 text-red-500 hover:scale-110 transition-all cursor-pointer"
                style={{ transitionDuration: "200ms" }}
              >
                <FaSquareInstagram size={48} />
              </a>
            </div>
            <p>{t("SocialMedia")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
