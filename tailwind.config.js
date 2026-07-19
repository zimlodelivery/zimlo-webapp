/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ---- Edit these to re-theme the whole app ----
        plate: "#E8E4DC",
        platedark: "#CBC3B2",
        platerim: "#B9AE99",
        yellow: "#FFC93C",
        orange: "#FF7A1A",
        orangedeep: "#E85D04",
        charcoal: "#221D1A",
        maroon: "#8B2E1F",
        cream: "#FFF8ED",
        jimlogreen: "#3F8F5F",
      },
      fontFamily: {
        display: ["'Baloo 2'", "sans-serif"],
        body: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
};
