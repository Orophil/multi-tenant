import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feature Flags",
  description: "Role-based console for the multi-tenant feature-flag system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
