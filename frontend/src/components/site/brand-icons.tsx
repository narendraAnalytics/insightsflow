import type { SVGProps } from "react";

export function InsightFlowMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="url(#flow-mark-gradient)" />
      <path
        d="M13 27c2.5-3.5 3-8 1.5-13.5"
        stroke="#fdf3ea"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M27 13c-2.5 3.5-3 8-1.5 13.5"
        stroke="#fdf3ea"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.75"
      />
      <defs>
        <linearGradient id="flow-mark-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b6338a" />
          <stop offset="0.5" stopColor="#e05a8f" />
          <stop offset="1" stopColor="#e8935a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SlackGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" {...props}>
      <path d="M14.8 24.6a2.9 2.9 0 1 1-2.9-2.9h2.9v2.9Z" fill="#e01e5a" />
      <path d="M16.2 24.6a2.9 2.9 0 1 1 5.8 0v7.3a2.9 2.9 0 1 1-5.8 0v-7.3Z" fill="#e01e5a" />
      <path d="M19.1 14.7a2.9 2.9 0 1 1 2.9-2.9v2.9h-2.9Z" fill="#36c5f0" />
      <path d="M19.1 16.2a2.9 2.9 0 1 1 0 5.8h-7.3a2.9 2.9 0 1 1 0-5.8h7.3Z" fill="#36c5f0" />
      <path d="M28.9 19.1a2.9 2.9 0 1 1 2.9 2.9h-2.9v-2.9Z" fill="#2eb67d" />
      <path d="M27.5 19.1a2.9 2.9 0 1 1-5.8 0v-7.3a2.9 2.9 0 1 1 5.8 0v7.3Z" fill="#2eb67d" />
      <path d="M24.6 28.9a2.9 2.9 0 1 1-2.9 2.9v-2.9h2.9Z" fill="#ecb22e" />
      <path d="M24.6 27.5a2.9 2.9 0 1 1 0-5.8h7.3a2.9 2.9 0 1 1 0 5.8h-7.3Z" fill="#ecb22e" />
    </svg>
  );
}

export function GitHubGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#24292f"
        d="M12 .5A11.5 11.5 0 0 0 .5 12.3c0 5.2 3.3 9.6 8 11.2.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.4-1.4-5.4-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11 11 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2a4.7 4.7 0 0 1 1.2 3.2c0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.3v3.4c0 .3.2.7.8.6a11.5 11.5 0 0 0 8-11.2A11.5 11.5 0 0 0 12 .5Z"
      />
    </svg>
  );
}

export function GoogleDriveGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M8.1 2.6 1.3 14.4l3.4 5.9 6.8-11.8Z" fill="#00ac47" />
      <path d="M15.5 2.6H8.1l6.8 11.8h7.4Z" fill="#ffba00" />
      <path d="M4.7 20.3h14.6l3.4-5.9H8.1Z" fill="#0066da" />
    </svg>
  );
}

export function NotionGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#fdf3ea" stroke="#e7ded3" />
      <path
        d="M7.3 7.1h1.8l5.3 7.8V7.7l1.6-.6v9.8h-1.6l-5.5-8v8h-1.6Z"
        fill="#241c15"
      />
    </svg>
  );
}

export function LinearGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="11" fill="#5e6ad2" />
      <path d="M6.5 12.5 12 7l1 1-4.5 4.5Z" fill="#fdf3ea" opacity="0.9" />
      <path d="M8.5 15.5 15 9l1 1-5.5 5.5Z" fill="#fdf3ea" />
    </svg>
  );
}

export function GmailGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="1.5" y="4.5" width="21" height="15" rx="2.4" fill="#fdf3ea" stroke="#e7ded3" />
      <path d="M2.8 6 12 13l9.2-7" stroke="#ea4335" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M2.4 6.4v11.3l6.2-4.8Z" fill="#34a853" />
      <path d="M21.6 6.4v11.3l-6.2-4.8Z" fill="#fbbc04" />
    </svg>
  );
}

export function GoogleCalendarGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="2.5" y="4" width="19" height="17" rx="3" fill="#fdf3ea" stroke="#e7ded3" />
      <rect x="2.5" y="4" width="19" height="5" rx="2.4" fill="#4285f4" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#4285f4" fontFamily="sans-serif">
        31
      </text>
      <rect x="7" y="2.2" width="1.8" height="4" rx="0.9" fill="#8a8a8a" />
      <rect x="15.2" y="2.2" width="1.8" height="4" rx="0.9" fill="#8a8a8a" />
    </svg>
  );
}

export function GoogleSheetsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M6 2.2h8.4L19 6.8V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.2a1 1 0 0 1 1-1Z" fill="#0f9d58" />
      <path d="M14.4 2.2 19 6.8h-3.6a1 1 0 0 1-1-1Z" fill="#0b8043" />
      <rect x="7.2" y="9.6" width="9.6" height="9.2" rx="0.6" fill="#fdf3ea" />
      <path d="M7.2 12.7h9.6M7.2 15.8h9.6M11.2 9.6v9.2M13.2 9.6v9.2" stroke="#0f9d58" strokeWidth="0.8" />
    </svg>
  );
}
