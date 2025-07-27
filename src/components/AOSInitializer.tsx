"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

export default function AOSInitializer() {
  useEffect(() => {
    AOS.init({
      duration: 800, // Animation duration in milliseconds
      once: true, // Whether animation should happen only once
      offset: 100, // Offset (in pixels) from the original trigger point
    });
  }, []);

  return null;
}