import type { CarInfo } from "../game/cars";
import { cn } from "../lib/utils";

/**
 * A top-down drawing of one of the garage's cars, built from its sprite colours, so the same car
 * looks the same on the race screen, in the garage and on the board. Front of the car is at the top.
 */
export function CarArt({
  car,
  locked = false,
  className,
  title,
}: {
  car: CarInfo;
  /** Dim the car and hide its detail, for a car the player hasn't bought. */
  locked?: boolean;
  className?: string;
  title?: string;
}) {
  const { body, glass, trim } = car.sprite;
  return (
    <svg
      viewBox="0 0 60 100"
      width={60}
      height={100}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block h-full w-auto", className)}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      style={{ filter: locked ? "grayscale(0.85) opacity(0.55)" : undefined }}
    >
      <ellipse cx="30" cy="95" rx="19" ry="4" fill="#2E0F20" opacity="0.16" />

      {/* Tyres */}
      <rect x="2" y="19" width="10" height="19" rx="4" fill="#111827" />
      <rect x="48" y="19" width="10" height="19" rx="4" fill="#111827" />
      <rect x="2" y="62" width="10" height="19" rx="4" fill="#111827" />
      <rect x="48" y="62" width="10" height="19" rx="4" fill="#111827" />

      {/* Body */}
      <rect x="8" y="5" width="44" height="90" rx="15" fill={body} />
      <path d="M12 15c-2 6-2 20 0 30v22c-2 8-2 16 0 22v-2c-4-1-5-4-5-9V24c0-5 1-8 5-9Z" fill="#000" opacity="0.16" />
      <rect x="47" y="14" width="4" height="74" rx="2" fill="#000" opacity="0.14" />

      {/* Bonnet vents */}
      <rect x="17" y="11" width="9" height="2" rx="1" fill={trim} opacity="0.55" />
      <rect x="34" y="11" width="9" height="2" rx="1" fill={trim} opacity="0.55" />

      {/* Windscreen, roof, rear window */}
      <rect x="14" y="19" width="32" height="16" rx="6" fill={glass} opacity="0.92" />
      <rect x="14" y="38" width="32" height="28" rx="7" fill="#000" opacity="0.1" />
      <rect x="25" y="40" width="10" height="24" rx="4" fill={trim} opacity="0.9" />
      <rect x="14" y="69" width="32" height="13" rx="5" fill={glass} opacity="0.8" />

      {/* Racing stripe over the nose and tail */}
      <rect x="26" y="7" width="8" height="10" rx="3" fill={trim} opacity="0.85" />
      <rect x="26" y="84" width="8" height="8" rx="3" fill={trim} opacity="0.85" />

      {/* Lights */}
      <rect x="12" y="8" width="9" height="5" rx="2.5" fill="#FEF9C3" />
      <rect x="39" y="8" width="9" height="5" rx="2.5" fill="#FEF9C3" />
      <rect x="12" y="89" width="9" height="4" rx="2" fill="#F87171" />
      <rect x="39" y="89" width="9" height="4" rx="2" fill="#F87171" />

      {/* Mirrors and spoiler */}
      <rect x="4" y="33" width="5" height="4" rx="2" fill={body} />
      <rect x="51" y="33" width="5" height="4" rx="2" fill={body} />
      <rect x="11" y="92" width="38" height="5" rx="2.5" fill="#111827" />
      <rect x="11" y="92" width="38" height="2" rx="1" fill={trim} opacity="0.7" />
    </svg>
  );
}
