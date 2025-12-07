import { format, isToday, isYesterday, isThisYear } from "date-fns";

interface DateSeparatorProps {
    date: string | Date;
}

export const DateSeparator = ({ date }: DateSeparatorProps) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const getDateLabel = (date: Date): string => {
        if (isToday(date)) {
            return "Today";
        } else if (isYesterday(date)) {
            return "Yesterday";
        } else if (isThisYear(date)) {
            // Show date without year (e.g., "15 March")
            return format(date, "d MMMM");
        } else {
            // Show full date with year (e.g., "15 March 2024")
            return format(date, "d MMMM yyyy");
        }
    };

    return (
        <div className="flex items-center justify-center my-4 sm:my-5 md:my-6">
            <div className="relative">
                {/* Horizontal line */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-border -translate-y-1/2 -z-10" />

                {/* Date badge - WhatsApp style - Responsive */}
                <div className="bg-background border border-border px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-0.5 md:py-1 rounded-md text-[10px] sm:text-xs font-medium text-muted-foreground shadow-sm mx-auto inline-block">
                    {getDateLabel(dateObj)}
                </div>
            </div>
        </div>
    );
};
