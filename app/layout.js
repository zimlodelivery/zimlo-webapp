import "./globals.css";

export const metadata = {
  title: "Zimlo — भूख लगी? Zimlo.",
  description: "Pilukhedi's own hyperlocal delivery — order food or anything else you need.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#FF7A1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body text-charcoal bg-cream min-h-screen">{children}</body>
    </html>
  );
}
