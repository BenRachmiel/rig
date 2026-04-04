import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rig",
  description: "Music library management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rig",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "auto",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Synchronous theme script — runs before first paint to prevent FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem("rig:settings")||"{}").state;if(!s)return;var t=s.theme;var light=t==="light"||(t==="system"&&window.matchMedia("(prefers-color-scheme:light)").matches);if(light){document.documentElement.classList.remove("dark");var m=document.querySelector('meta[name=theme-color]');if(!m){m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m)}m.setAttribute("content","#ffffff")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="h-full flex">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
