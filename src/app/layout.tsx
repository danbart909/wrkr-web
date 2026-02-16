import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "WRKR",
  description: "Post jobs. Find work. Get paid.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
