import { cn } from "@/lib/utils";

export function LogoVideo({ className }: { className?: string }) {
  return (
    <video
      className={cn("shrink-0 rounded-[11px] object-cover", className)}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
    >
      <source
        src="https://res.cloudinary.com/dkqbzwicr/video/upload/v1789315906/logovideo_eumdgq.mp4"
        type="video/mp4"
      />
    </video>
  );
}
