import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DuriSense | ระบบจัดการแปลงทุเรียนอัจฉริยะ",
    template: "%s | DuriSense",
  },
  description:
    "ติดตามสภาพแปลง จัดการอุปกรณ์ และเตรียมการให้น้ำอย่างมีข้อมูลด้วย DuriSense",
  applicationName: "DuriSense",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#083d2a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
