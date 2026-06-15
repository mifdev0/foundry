import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"], 
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "Foundry",
  description: "Personal learning path builder untuk semua bidang dan topik belajar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} font-sans antialiased dreamy-gradient`}>
        <div className="fixed inset-0 dot-grid pointer-events-none opacity-40" />
        {children}
      </body>
    </html>
  );
}
