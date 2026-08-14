import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const title = "PreçoCerto Curitiba | Compare sua cesta";
  const description =
    "Compare preços de mercados em Curitiba e acompanhe ofertas verificadas.";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title,
    description,
    applicationName: "PreçoCerto",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "PreçoCerto",
    },
    icons: {
      icon: "/app-icon.svg",
      apple: "/app-icon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "PreçoCerto Curitiba" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#17372d",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
