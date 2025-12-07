/**
 * Professional Video Editing Themed Chat Background
 * Subtle, non-distracting pattern with video editing icons
 */

export const ChatBackground = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />

            {/* Subtle pattern overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.02]">
                <defs>
                    {/* Video editing icons pattern */}
                    <pattern id="video-editing-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                        {/* Camera icon */}
                        <g transform="translate(20, 20)" opacity="0.4">
                            <rect x="2" y="6" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M23 10l5-3v12l-5-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </g>

                        {/* Timeline/Cut icon */}
                        <g transform="translate(120, 80)" opacity="0.4">
                            <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="6" y="8" width="4" height="8" rx="1" fill="currentColor" opacity="0.5" />
                            <rect x="14" y="8" width="4" height="8" rx="1" fill="currentColor" opacity="0.5" />
                            <path d="M12 4v16" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" />
                        </g>

                        {/* Play button */}
                        <g transform="translate(160, 20)" opacity="0.4">
                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M10 8l6 4-6 4V8z" fill="currentColor" opacity="0.6" />
                        </g>

                        {/* Film strip */}
                        <g transform="translate(40, 140)" opacity="0.4">
                            <rect x="2" y="8" width="20" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="2" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="1" />
                            <line x1="2" y1="17" x2="22" y2="17" stroke="currentColor" strokeWidth="1" />
                            <line x1="8" y1="8" x2="8" y2="20" stroke="currentColor" strokeWidth="1" />
                            <line x1="16" y1="8" x2="16" y2="20" stroke="currentColor" strokeWidth="1" />
                        </g>

                        {/* Waveform */}
                        <g transform="translate(140, 140)" opacity="0.4">
                            <path d="M2 12h2l1-4 2 8 2-6 2 4 2-2h2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M2 12h2l1-4 2 8 2-6 2 4 2-2h2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" transform="translate(0, 5)" />
                        </g>
                    </pattern>
                </defs>

                <rect width="100%" height="100%" fill="url(#video-editing-pattern)" />
            </svg>

            {/* Subtle vignette effect */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-background/10" />
        </div>
    );
};
