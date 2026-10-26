import type { MetadataRoute } from "next";

/**
 * The web app manifest, so the portal can be installed to a phone's home screen.
 *
 * No service worker and no offline cache, on purpose: an HR portal that shows a
 * cached payslip or leave balance after it has changed is showing invented data.
 * Installed, it opens like an app and still asks the server for every number.
 * Colours are the AskMira Red and Cream tokens in globals.css.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AskMira",
    short_name: "AskMira",
    description: "Your HR: payslips, leave, attendance, approvals and recognition.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fef8f4",
    theme_color: "#eb061d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
