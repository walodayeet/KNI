"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

export default function CustomerReviews() {
  // List of review images (replace with your actual image paths)
  const reviews_1 = useMemo(() => {
    const r = [];
    for (let i = 1; i <= 14; i++) {
      r.push(`/images/reviews/${i}.avif`);
    }
    return r;
  }, []);
  const reviews_2 = useMemo(() => {
    const r = [];
    for (let i = 15; i <= 30; i++) {
      r.push(`/images/reviews/${i}.avif`);
    }
    return r;
  }, []);
  const reviews_3 = useMemo(() => {
    const r = [];
    for (let i = 30; i <= 44; i++) {
      r.push(`/images/reviews/${i}.avif`);
    }
    return r;
  }, []);

  const t = useTranslations("HomePage.customerReviews");

  // Duplicate the reviews array to create a seamless infinite scroll
  const duplicatedReviews_1 = useMemo(
    () => [...reviews_1, ...reviews_1, ...reviews_1],
    []
  );
  const duplicatedReviews_2 = useMemo(
    () => [...reviews_2, ...reviews_2, ...reviews_2],
    []
  );
  const duplicatedReviews_3 = useMemo(
    () => [...reviews_3, ...reviews_3, ...reviews_3],
    []
  );

  return (
    <section className="min-h-screen bg-gray-900 text-white snap-center py-16">
      <div className="min-w-screen px-4 sm:px-6 w-full">
        {/* Heading */}
        <h2
          className="text-4xl md:text-5xl font-bold text-center mb-12"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          {t("title")}
        </h2>
        {/* Auto-Scrolling Container */}
        <div className="scroll-container ">
          <div
            className="scrolling-list-left max-h-[20vh]"
            style={{ animationDelay: "500ms" }}
          >
            {duplicatedReviews_1.map((review, index) => {
              return (
                <div
                  key={index}
                  className="mx-4 item"
                  data-aos="fade-up"
                  data-aos-delay={`${(index % reviews_1.length) * 100}`}
                >
                  <img
                    src={review}
                    width={300}
                    height={400}
                    alt={`Customer Review ${index + 1}`}
                    className="rounded-lg shadow-md object-cover"
                    style={{ objectFit: "contain", aspectRatio: "1" }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="scroll-container">
          <div
            className="scrolling-list-right max-h-[40vh]"
            style={{ animationDelay: "100ms" }}
          >
            {duplicatedReviews_2.map((review, index) => {
              return (
                <div
                  key={index}
                  className="mx-4 item"
                  data-aos="fade-up"
                  data-aos-delay={`${(index % reviews_2.length) * 100}`}
                >
                  <img
                    src={review}
                    width={300}
                    height={400}
                    alt={`Customer Review ${index + 1}`}
                    className="rounded-lg shadow-md"
                    style={{ objectFit: "contain",  aspectRatio: "1/2"}}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="scroll-container">
          <div className="scrolling-list-left max-h-[30vh]">
            {duplicatedReviews_3.map((review, index) => {
              return (
                <div
                  key={index}
                  className="mx-4 item"
                  data-aos="fade-up"
                  data-aos-delay={`${(index % reviews_3.length) * 100}`}
                >
                  <img
                    src={review}
                    width={300}
                    height={400}
                    alt={`Customer Review ${index + 1}`}
                    className="rounded-lg shadow-md object-cover"
                    style={{ objectFit: "contain",  aspectRatio: "1/2" }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
