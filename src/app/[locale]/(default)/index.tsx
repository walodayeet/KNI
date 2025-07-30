"use client";

import { useEffect } from "react";

import AOS from "aos";
import "aos/dist/aos.css";

import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default function ClientLayout({
  children,
  // @ts-ignore
  params
}: Props) {
  useEffect(() => {
    AOS.init({
      once: true,
      disable: "phone",
      duration: 700,
      easing: "ease-out-cubic",
    });
  });

  return (
    <div className="flex min-h-screen flex-col overflow-hidden supports-[overflow:clip]:overflow-clip">
        <Header />
        <main className="grow">{children}</main>
        <Footer border={true} />
    </div>
  );
}