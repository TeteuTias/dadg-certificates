/**
 * WaveDivider — SVG wave placed between two sections.
 * `bg` = background color of the CURRENT section (what's behind the wave).
 * `fill` = color of the NEXT section (the wave "bleeds" into it).
 * `flip` = mirrors the wave horizontally for visual variety.
 */
interface WaveDividerProps {
  bg: string;
  fill: string;
  flip?: boolean;
}

export default function WaveDivider({ bg, fill, flip = false }: WaveDividerProps) {
  return (
    <div
      className="relative w-full overflow-hidden leading-none h-8 sm:h-12 md:h-[72px]"
      style={{ background: bg, marginTop: -1, marginBottom: -1 }}
    >
      <svg
        viewBox="0 0 1440 72"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute bottom-0 w-full h-full"
        style={{ transform: flip ? "scaleX(-1)" : undefined }}
      >
        <path
          d="M0,36 C480,72 960,0 1440,36 L1440,72 L0,72 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
