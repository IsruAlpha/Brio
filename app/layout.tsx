import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/app/components/ui/Toaster";
import { Modal } from "@/app/components/ui/Modal";
import { GeneratingModal } from "@/app/components/GeneratingModal";

export const metadata: Metadata = {
  title: "Brio — names worth keeping",
  description:
    "Describe your idea, drop a competitor, or paste a name you like. AI finds you something good — then checks if it's actually free.",
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    title: "Brio — names worth keeping",
    description:
      "Describe your idea, drop a competitor, or paste a name you like. AI finds you something good — then checks if it's actually free.",
    images: [
      {
        url: "/opengraph-image.png",
        alt: "Brio landing page preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Brio — names worth keeping",
    description:
      "Describe your idea, drop a competitor, or paste a name you like. AI finds you something good — then checks if it's actually free.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
        <Modal />
        <GeneratingModal />
      </body>
    </html>
  );
}
