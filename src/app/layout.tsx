import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";

import { StepUpProvider } from "@/components/auth/StepUpProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LocaleProvider } from "@/lib/i18n";

import "./globals.css";

// Inter for data-dense screens, Fraunces for culture and dashboard headlines
// (FRD 5.13). Both loaded as CSS variables so globals.css owns the mapping.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: {
    default: "AskMira",
    template: "%s · AskMira",
  },
  description:
    "Culture-analytics-first HRMS for the Indian mid-market — statutory compliance, people analytics and a culture layer in one platform.",
  icons: {
    icon: [
      { url: "/brand/askmira-favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "AskMira", statusBarStyle: "default" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <AuthProvider>
          <LocaleProvider>
            <ThemeProvider>
              <StepUpProvider>{children}</StepUpProvider>
              <Toaster richColors closeButton position="top-right" />
            </ThemeProvider>
          </LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
