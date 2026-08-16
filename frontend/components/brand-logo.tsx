import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  priority?: boolean;
  className?: string;
};

export function BrandLogo({ href = "/", priority = false, className = "" }: BrandLogoProps) {
  return (
    <Link className={`brand-logo ${className}`.trim()} href={href} aria-label="DuriSense หน้าหลัก">
      <Image
        src="/brand/logo.png"
        alt="DuriSense"
        width={224}
        height={84}
        priority={priority}
        sizes="(max-width: 720px) 150px, 190px"
      />
    </Link>
  );
}
