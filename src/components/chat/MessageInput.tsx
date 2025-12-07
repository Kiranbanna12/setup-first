import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Smile, X, Image as ImageIcon, Video, FileText } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MessageInputProps {
  onSend: (content: string, attachment?: File) => void;
  replyingTo?: any;
  onCancelReply?: () => void;
  editingMessage?: any;
  onCancelEdit?: () => void;
  onTyping?: (isTyping: boolean) => void;
}

// Simple emoji list for the picker
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤔', '🤐', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥'],
  'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '💪', '🦾', '👏', '🙌'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Objects': ['🎉', '🎊', '🎁', '🏆', '⭐', '🌟', '✨', '💯', '🔥', '💥', '💫', '⚡', '✅', '❌', '❓', '❗', '💡', '📌'],
};

export const MessageInput = ({
  onSend,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onTyping,
}: MessageInputProps) => {
  const [message, setMessage] = useState(editingMessage?.content || "");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content || "");
    }
  }, [editingMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !attachment) return;

    onSend(message, attachment || undefined);
    setMessage("");
    clearAttachment();

    // Stop typing indicator
    if (onTyping && isTyping) {
      setIsTyping(false);
      onTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 50MB for videos, 10MB for others)
      const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
        return;
      }
      setAttachment(file);

      // Create preview for images and videos
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachmentPreview(null);
      }
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setMessage(prev => prev + emoji);
    if (!isMobile) {
      textareaRef.current?.focus();
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (documentInputRef.current) documentInputRef.current.value = "";
  };

  const handleTyping = (value: string) => {
    setMessage(value);

    if (onTyping) {
      if (value.length > 0 && !isTyping) {
        setIsTyping(true);
        onTyping(true);
      } else if (value.length === 0 && isTyping) {
        setIsTyping(false);
        onTyping(false);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTyping(false);
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Emoji Picker Component
  const EmojiPickerContent = () => (
    <div className="p-2 max-h-[300px] overflow-y-auto">
      {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
        <div key={category} className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">{category}</p>
          <div className="grid grid-cols-8 gap-1">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  handleEmojiClick(emoji);
                  if (isMobile) setShowEmojiPicker(false);
                }}
                className="text-xl hover:bg-accent rounded p-1 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="border-t bg-card">
      {/* Reply/Edit Banner - WhatsApp Style */}
      {(replyingTo || editingMessage) && (
        <div className="px-3 sm:px-4 md:px-4 py-2 sm:py-2 md:py-2.5 border-b border-l-4 border-l-primary bg-muted/30 flex items-start gap-2 sm:gap-2.5 md:gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary flex-shrink-0 sm:w-[14px] sm:h-[14px]">
                <path d="M9 10l-5 5 5 5" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
              <p className="text-[11px] sm:text-xs font-semibold text-primary">
                {replyingTo ? "Replying to" : "Editing message"}
                {replyingTo?.sender_name && (
                  <span className="ml-1 text-foreground">
                    {replyingTo.sender_name}
                  </span>
                )}
              </p>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate leading-[16px] sm:leading-[18px]">
              {(replyingTo || editingMessage)?.content}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 sm:h-7 sm:w-7 hover:bg-destructive/10 flex-shrink-0"
            onClick={replyingTo ? onCancelReply : onCancelEdit}
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      )}

      {/* Attachment Preview - Enhanced with Image/Video Preview */}
      {attachment && (
        <div className="px-3 sm:px-4 pt-2 sm:pt-3 pb-2 border-b">
          {attachmentPreview && (
            <div className="mb-2 relative rounded-lg overflow-hidden max-w-[200px] sm:max-w-xs">
              {attachment.type.startsWith('image/') ? (
                <img src={attachmentPreview} alt="Preview" className="w-full h-auto max-h-48 sm:max-h-64 object-contain bg-muted" />
              ) : attachment.type.startsWith('video/') ? (
                <video src={attachmentPreview} controls className="w-full h-auto max-h-48 sm:max-h-64 bg-muted" />
              ) : null}
            </div>
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0">
              {attachment.type.startsWith('image/') ? (
                <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
              ) : attachment.type.startsWith('video/') ? (
                <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500 flex-shrink-0" />
              ) : (
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
              )}
              <span className="truncate font-medium">{attachment.name}</span>
              <span className="text-muted-foreground text-[10px] sm:text-xs flex-shrink-0">
                ({(attachment.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 sm:h-7 sm:w-7 hover:bg-destructive/10 flex-shrink-0"
              onClick={clearAttachment}
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
            </Button>
          </div>
        </div>
      )}

      {/* Input Area - Responsive padding */}
      <form onSubmit={handleSubmit} className="p-2 sm:p-3 md:p-4">
        <div className="flex gap-1.5 sm:gap-2">
          <div className="flex-1 flex gap-2 items-end">
            {/* File Input References */}
            <input
              ref={imageInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*"
            />
            <input
              ref={videoInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="video/*"
            />
            <input
              ref={documentInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
            />

            {/* Attachment Menu - WhatsApp Style */}
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-accent flex-shrink-0">
                  <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 sm:w-48 p-1.5 sm:p-2" align="start">
                <div className="flex flex-col gap-0.5 sm:gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start gap-2 sm:gap-3 h-8 sm:h-10 text-xs sm:text-sm"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                    <span>Photos</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start gap-2 sm:gap-3 h-8 sm:h-10 text-xs sm:text-sm"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500 flex-shrink-0" />
                    <span>Videos</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start gap-2 sm:gap-3 h-8 sm:h-10 text-xs sm:text-sm"
                    onClick={() => documentInputRef.current?.click()}
                  >
                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
                    <span>Documents</span>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Emoji Picker - Responsive: Sheet for Mobile, Popover for Desktop */}
            {/* Mobile: Bottom Sheet */}
            {isMobile ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-accent flex-shrink-0"
                  onClick={() => {
                    textareaRef.current?.blur();
                    setTimeout(() => setShowEmojiPicker(true), 100);
                  }}
                >
                  <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Sheet open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <SheetContent side="bottom" className="h-[400px] p-0">
                    <SheetHeader className="px-4 py-3 border-b">
                      <SheetTitle className="text-sm">Select Emoji</SheetTitle>
                    </SheetHeader>
                    <div className="h-[calc(100%-60px)] overflow-auto">
                      <EmojiPickerContent />
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              /* Desktop: Popover */
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-accent flex-shrink-0"
                  >
                    <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0 border shadow-lg z-[100]"
                  align="start"
                  side="top"
                  sideOffset={8}
                >
                  <EmojiPickerContent />
                </PopoverContent>
              </Popover>
            )}

            <Textarea
              ref={textareaRef}
              placeholder="Type a message..."
              value={message}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1 min-h-[36px] sm:min-h-9 md:min-h-10 max-h-20 sm:max-h-24 md:max-h-32 resize-none text-xs sm:text-sm md:text-base px-3 py-2"
              rows={1}
            />
          </div>

          <Button
            type="submit"
            className="gradient-primary h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0"
            disabled={!message.trim() && !attachment}
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
