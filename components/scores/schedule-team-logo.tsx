import Image from "next/image";

import { cn } from "@/lib/utils";

type ScheduleTeamLogoProps = {
  src: string;
  alt?: string;
  size: number;
  className?: string;
};

/** NFL team mark from Sleeper/ESPN CDNs (schedule + game centre). */
export function ScheduleTeamLogo({
  src,
  alt = "",
  size,
  className,
}: ScheduleTeamLogoProps) {
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
