import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentry Triage",
  description: "AI-powered Sentry issue triage and Jira ticket creation",
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
