/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/components/**/*.{js,ts,jsx,tsx}",
      "./src/app/**/*.{js,ts,jsx,tsx}", // If using Next.js App Router
    ],
    theme: {
      extend: {
        screens: {
          'md': '810px', // Tablet starts at 810px
          'lg': '1200px', // Desktop starts at 1200px
        },
        colors: {
          orange: {
            500: rgb(255, 145, 77)
          },
        },
        animation: {
          "fade-in": "fadeIn 0.5s ease-in-out",
          "scroll": "scroll 30s linear infinite",
        },
        keyframes: {
          fadeIn: {
            "0%": { opacity: "0" },
            "100%": { opacity: "1" },
          },
          scroll: {
            "0%": { transform: "translateX(0)" },
            "100%": { transform: "translateX(-50%)" }, // Move to -50% for seamless looping
          },
        },
      },
    },
    plugins: [],
  };