import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TarantulaHawk - AI-Powered AML, Risk and Compliance SaAS Platform | FinCEN BSA & Mexico SHCP, CNBV, LFPIORPI",
  description: "Advanced anti-money laundering (AML) platform with AI/ML technology for USA FinCEN BSA and Mexico LFPIORPI compliance. Real-time transaction monitoring, risk assessment, and automated reporting for financial institutions.",
  keywords: [
    "AML software",
    "anti money laundering",
    "FinCEN compliance",
    "BSA compliance",
    "Bank Secrecy Act",
    "LFPIORPI Mexico",
    "SHCP compliance",
    "transaction monitoring",
    "KYC software",
    "financial crime detection",
    "AI AML",
    "machine learning AML",
    "compliance software",
    "SAR filing",
    "Mexico AML",
    "USA AML",
    "cross-border AML",
    "CNBV compliance",
    "financial institutions software",
    "regulatory compliance",
    "Dr. Carlos Ruiz Viquez"
  ].join(", "),
  authors: [{ name: "Dr. Carlos Ruiz Viquez." }],
  creator: "TarantulaHawk, Inc.",
  publisher: "TarantulaHawk, Inc.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["es_MX", "es_US"],
    url: "https://tarantulahawk.cloud",
    title: "TarantulaHawk - AI-Powered AML Compliance Software",
    description: "Advanced anti-money laundering software with AI/ML for FinCEN BSA and Mexico LFPIORPI compliance. Real-time transaction monitoring and automated reporting.",
    siteName: "TarantulaHawk",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "TarantulaHawk AML Compliance and Risk AI Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TarantulaHawk - AI-Powered AML Compliance Platform",
    description: "Advanced anti-money laundering software with AI/ML for FinCEN BSA and Mexico LFPIORPI compliance.",
    images: ["/twitter-image.jpg"],
    creator: "@tarantulahawk",
  },
  alternates: {
    canonical: "https://tarantulahawk.cloud",
    languages: {
      'en-US': 'https://tarantulahawk.cloud/en',
      'es-MX': 'https://tarantulahawk.cloud/es',
    },
  },
  category: "Financial Technology",
  other: {
    "application-name": "TarantulaHawk AI/ML AML Platform",
    "msapplication-TileColor": "#CC3300",
    "theme-color": "#000000",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="google-site-verification" content="your-google-verification-code" />
        <link rel="canonical" href="https://tarantulahawk.cloud" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "TarantulaHawk",
              "applicationCategory": "FinanceApplication",
              "operatingSystem": "Web-based",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "description": "Free trial available"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "127"
              },
              "description": "AI-powered anti-money laundering compliance, risk platform for financial institutions",
              "featureList": [
                "Real-time transaction monitoring",
                "AI/ML fraud detection",
                "FinCEN BSA compliance",
                "Mexico LFPIORPI compliance",
                "Automated SAR filing",
                "KYC verification",
                "Risk assessment"
              ],
              "provider": {
                "@type": "Organization",
                "name": "TarantulaHawk, Inc.",
                "url": "https://tarantulahawk.cloud",
                "contactPoint": {
                  "@type": "ContactPoint",
                  "contactType": "Sales",
                  "email": "info@tarantulahawk.cloud"
                }
              }
            })
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
