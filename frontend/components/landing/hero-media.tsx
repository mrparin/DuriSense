"use client";

import { Sprout } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export function HeroMedia() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  return (
    <div className={`hero-media hero-media--${state}`}>
      <div className="hero-media__fallback" role="img" aria-label="DuriSense ระบบจัดการแปลงทุเรียน">
        <Sprout aria-hidden="true" />
        <span>DuriSense</span>
      </div>
      {state !== "error" && (
        <Image
          className="hero__image"
          src="/images/durian-orchard-hero.png"
          alt="สวนทุเรียนที่ติดตั้งสถานีตรวจอากาศและระบบให้น้ำ"
          fill
          priority
          sizes="100vw"
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}
    </div>
  );
}
