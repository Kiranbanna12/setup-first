/**
 * Chat Search Component - WhatsApp Style
 * Search messages in current chat with navigation
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChatSearchProps {
    messages: any[];
    onResultSelect: (messageId: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const ChatSearch = ({ messages, onResultSelect, isOpen, onClose }: ChatSearchProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setCurrentResultIndex(0);
            return;
        }

        // Search in messages
        const query = searchQuery.toLowerCase();
        const results = messages.filter(msg =>
            !msg.is_system_message &&
            msg.content?.toLowerCase().includes(query)
        );

        setSearchResults(results);
        setCurrentResultIndex(results.length > 0 ? 0 : -1);

        // Highlight first result
        if (results.length > 0) {
            onResultSelect(results[0].id);
        }
    }, [searchQuery, messages]);

    const handleNext = () => {
        if (searchResults.length === 0) return;
        const nextIndex = (currentResultIndex + 1) % searchResults.length;
        setCurrentResultIndex(nextIndex);
        onResultSelect(searchResults[nextIndex].id);
    };

    const handlePrevious = () => {
        if (searchResults.length === 0) return;
        const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
        setCurrentResultIndex(prevIndex);
        onResultSelect(searchResults[prevIndex].id);
    };

    const handleClose = () => {
        setSearchQuery('');
        setSearchResults([]);
        setCurrentResultIndex(0);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNext();
        } else if (e.key === 'Escape') {
            handleClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="w-full bg-card border-b shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 px-2 sm:px-4 py-2 sm:py-3">
                {/* Search Input Container */}
                <div className="flex-1 relative min-w-0">
                    <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-7 sm:pl-9 pr-2 sm:pr-4 h-8 sm:h-9 md:h-10 text-xs sm:text-sm rounded-lg bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                    />
                </div>

                {/* Results Count - Hidden on very small screens, compact on mobile */}
                {searchQuery && (
                    <div className="hidden xs:flex sm:flex items-center text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap bg-muted/50 px-1.5 sm:px-2 py-1 rounded-md">
                        {searchResults.length > 0 ? (
                            <span className="font-medium">
                                {currentResultIndex + 1}<span className="text-muted-foreground/70">/</span>{searchResults.length}
                            </span>
                        ) : (
                            <span className="text-destructive/70">0</span>
                        )}
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-full hover:bg-muted"
                        onClick={handlePrevious}
                        disabled={searchResults.length === 0}
                        title="Previous result"
                    >
                        <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-full hover:bg-muted"
                        onClick={handleNext}
                        disabled={searchResults.length === 0}
                        title="Next result"
                    >
                        <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                </div>

                {/* Close Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleClose}
                    title="Close search"
                >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
            </div>
        </div>
    );
};
