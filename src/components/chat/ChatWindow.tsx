// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { ChatMembers } from "./ChatMembers";
import { ChatBackground } from "./ChatBackground";
import { TypingIndicator } from "./TypingIndicator";
import { ChatSearch } from "./ChatSearch";
import { DateSeparator } from "./DateSeparator";
import { SystemMessage } from "./SystemMessage";
import { JoinRequestNotification } from "./JoinRequestNotification";
import { MessageInfoDialog } from "./MessageInfoDialog";
import { MoreVertical, Search, Phone, Video, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabasePresence } from "@/hooks/useSupabasePresence";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatWindowProps {
  projectId: string;
  projectName: string;
  currentUserId: string;
  projectCreatorId?: string;
  onBack?: () => void;
}

export const ChatWindow = ({ projectId, projectName, currentUserId, projectCreatorId, onBack }: ChatWindowProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, any>>({});
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [isChatMember, setIsChatMember] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [messageInfoOpen, setMessageInfoOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUserId === projectCreatorId;
  const canApproveRequests = isAdmin || isChatMember;

  // Load current user profile for presence
  useEffect(() => {
    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', currentUserId)
        .single();

      if (profile) {
        setCurrentUserProfile(profile);
      }
    };
    loadProfile();
  }, [currentUserId]);

  // Use Supabase Presence for online users and typing indicators
  const { onlineUsers, typingUsers, isConnected, sendTypingIndicator, onlineCount } = useSupabasePresence({
    channelName: `chat-${projectId}`,
    currentUserId,
    userInfo: currentUserProfile,
  });

  useEffect(() => {
    loadMessages();
    checkChatMembership();
    loadJoinRequests();

    // Subscribe to new messages for this project using Supabase Realtime
    const messagesChannel = supabase
      .channel(`messages-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${projectId}`
        },
        async (payload) => {
          // Handle different events
          if (payload.eventType === 'INSERT') {
            // Enrich new message with sender info - always fetch to avoid stale closure
            const newMessage = payload.new;

            // Fetch sender profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email, avatar_url')
              .eq('id', newMessage.sender_id)
              .single();

            if (profile) {
              setSenderProfiles(prev => ({
                ...prev,
                [newMessage.sender_id]: profile
              }));
            }

            // Fetch reply context if needed
            let replyContext = null;
            if (newMessage.reply_to_message_id) {
              const { data: replyMsg } = await supabase
                .from('messages')
                .select('id, content, sender_id')
                .eq('id', newMessage.reply_to_message_id)
                .single();

              if (replyMsg) {
                // Fetch sender name for reply
                const { data: replyProfile } = await supabase
                  .from('profiles')
                  .select('full_name, email')
                  .eq('id', replyMsg.sender_id)
                  .single();

                replyContext = {
                  ...replyMsg,
                  sender_name: replyProfile?.full_name || replyProfile?.email || 'User'
                };
              }
            }

            const enrichedMessage = {
              ...newMessage,
              sender_name: profile?.full_name || profile?.email || 'Unknown User',
              sender_avatar: profile?.avatar_url,
              reply_to: replyContext
            };

            // Add message only if it doesn't already exist (prevent duplicates from optimistic update)
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                // Update existing message with any new data, preserving reply_to if we didn't fetch it effectively?
                // Actually enrichedMessage.reply_to is authoritative now.
                return prev.map(msg => msg.id === newMessage.id ? enrichedMessage : msg);
              }
              return [...prev, enrichedMessage];
            });
            setTimeout(scrollToBottom, 100);

            // Auto-mark incoming message as read if it's from another user
            if (newMessage.sender_id !== currentUserId) {
              markMessagesAsRead([enrichedMessage]);

              // Play in-chat message sound only (no toast notification inside chat)
              try {
                const audio = new Audio('/assets/sound-effects/in-chat-message.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => { });
              } catch (e) {
                // Silently fail if audio can't play
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update message with latest data
            const updatedMsg = payload.new;
            setMessages(prev => prev.map(msg => {
              if (msg.id === updatedMsg.id) {
                return {
                  ...updatedMsg,
                  sender_name: msg.sender_name,
                  sender_avatar: msg.sender_avatar,
                  reply_to: msg.reply_to
                };
              }
              return msg;
            }));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Subscribe to project_chat_members for join request notifications
    const membersChannel = supabase
      .channel(`members-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_chat_members",
          filter: `project_id=eq.${projectId}`
        },
        async (payload) => {
          // Reload join requests on any change
          loadJoinRequests();
          checkChatMembership();

          // Show toast notifications
          if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
            // New join request
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', payload.new.user_id)
              .single();

            const userName = profile?.full_name || profile?.email || 'Someone';
            toast.info(`${userName} requested to join the chat`);
          } else if (payload.eventType === 'UPDATE' && payload.new.is_active && payload.new.status === 'approved') {
            // Join request approved
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', payload.new.user_id)
              .single();

            const userName = profile?.full_name || profile?.email || 'Someone';
            toast.success(`${userName} joined the chat`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, joinRequests]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const checkChatMembership = async () => {
    try {
      let memberCount = 1; // Start with 1 for the project owner

      // Get project to check editor_id and client_id
      const { data: project } = await supabase
        .from('projects')
        .select('editor_id, client_id')
        .eq('id', projectId)
        .single();

      // Count editor if assigned
      if (project?.editor_id) {
        const { data: editor } = await supabase
          .from('editors')
          .select('user_id')
          .eq('id', project.editor_id)
          .single();
        // Only count if editor is not the same as owner
        if (editor?.user_id && editor.user_id !== projectCreatorId) {
          memberCount++;
        }
      }

      // Count client if assigned
      if (project?.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('user_id')
          .eq('id', project.client_id)
          .single();
        // Only count if client is not the same as owner or editor
        if (client?.user_id && client.user_id !== projectCreatorId) {
          memberCount++;
        }
      }

      // Get shared members from project_chat_members
      const { data: sharedMembers } = await supabase
        .from('project_chat_members' as any)
        .select('user_id')
        .eq('project_id', projectId)
        .eq('is_active', true);

      if (sharedMembers) {
        // Get unique user IDs already counted (owner, editor, client)
        const alreadyCounted = new Set([projectCreatorId]);
        if (project?.editor_id) {
          const { data: editor } = await supabase
            .from('editors')
            .select('user_id')
            .eq('id', project.editor_id)
            .single();
          if (editor?.user_id) alreadyCounted.add(editor.user_id);
        }
        if (project?.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('user_id')
            .eq('id', project.client_id)
            .single();
          if (client?.user_id) alreadyCounted.add(client.user_id);
        }

        // Count shared members not already counted
        for (const member of sharedMembers) {
          if (member.user_id && !alreadyCounted.has(member.user_id)) {
            memberCount++;
            alreadyCounted.add(member.user_id);
          }
        }
      }

      const isMember = sharedMembers?.some(m => m.user_id === currentUserId);
      setIsChatMember(isMember || currentUserId === projectCreatorId);
      setTotalMembers(memberCount);
    } catch (error) {
      console.error('Failed to check chat membership:', error);
    }
  };

  const loadJoinRequests = async () => {
    try {
      // Use RPC to fetch pending join requests (bypasses RLS issues)
      const { data: pendingRequests, error } = await (supabase.rpc as any)('get_pending_join_requests', {
        project_id_input: projectId
      });

      if (error) throw error;

      // Map the response to expected format
      const enrichedRequests = (pendingRequests || []).map((request: any) => ({
        id: request.id,
        user_id: request.user_id,
        user_name: request.user_name || request.user_email || "Unknown User",
        user_avatar: request.user_avatar,
        created_at: request.created_at
      }));

      setJoinRequests(enrichedRequests);
    } catch (error) {
      console.error('Failed to load join requests:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select(`
          *,
          reply_to:reply_to_message_id(
            id,
            content,
            sender_id
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Load sender profiles for all messages
      const senderIds = [...new Set((messagesData || []).map(m => m.sender_id))];
      const profiles: Record<string, any> = {};

      for (const senderId of senderIds) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('id', senderId)
          .single();

        if (profile) {
          profiles[senderId] = profile;
        }
      }

      setSenderProfiles(profiles);

      // Enrich messages with sender info
      const enrichedMessages = (messagesData || []).map(msg => {
        // Enrich reply_to with sender info
        let enrichedReplyTo = null;
        if (msg.reply_to) {
          const replySenderId = msg.reply_to.sender_id;
          enrichedReplyTo = {
            ...msg.reply_to,
            sender_name: profiles[replySenderId]?.full_name || profiles[replySenderId]?.email || 'Unknown User'
          };
        }

        return {
          ...msg,
          // If we have a reply_to via the join, use it. But MessageBubble expects it directly on the message object sometimes or structured differently.
          // MessageBubble checks `message.reply_to_message_id && message.reply_to`
          reply_to: enrichedReplyTo,
          sender_name: profiles[msg.sender_id]?.full_name || profiles[msg.sender_id]?.email || 'Unknown User',
          sender_avatar: profiles[msg.sender_id]?.avatar_url
        };
      });

      setMessages(enrichedMessages);

      // Mark messages as read after loading
      markMessagesAsRead(enrichedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  // Mark messages as read when user views them
  const markMessagesAsRead = async (messagesToMark: any[]) => {
    try {
      // Filter messages that are not sent by current user and not already read by current user
      const unreadMessages = messagesToMark.filter(msg => {
        if (msg.sender_id === currentUserId) return false; // Skip own messages
        const readBy = msg.read_by || [];
        return !readBy.includes(currentUserId); // Not already read by this user
      });

      if (unreadMessages.length === 0) return;

      // Update each unread message to mark as read
      for (const msg of unreadMessages) {
        const currentReadBy = msg.read_by || [];
        if (!currentReadBy.includes(currentUserId)) {
          const updatedReadBy = [...currentReadBy, currentUserId];

          // Update in database - this will trigger realtime broadcast
          await supabase
            .from('messages')
            .update({
              read_by: updatedReadBy,
              is_read: true,
              status: 'read'
            })
            .eq('id', msg.id);
        }
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  // Handle typing indicator from MessageInput
  const handleTyping = (isTyping: boolean) => {
    sendTypingIndicator(isTyping);
  };

  const handleSendMessage = async (content: string, attachment?: File) => {
    try {
      let attachmentUrl = null;
      let attachmentType = null;

      // Stop typing when sending
      sendTypingIndicator(false);

      if (editingMessage) {
        // Update existing message
        const { error } = await supabase
          .from("messages")
          .update({
            content,
            edited: true
          })
          .eq("id", editingMessage.id);

        if (error) throw error;
        setEditingMessage(null);
      } else {
        // Create explicit reply context for optimistic update
        const replyContext = replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          sender_id: replyingTo.sender_id,
          sender_name: replyingTo.sender_name
        } : null;

        // Optimistic update
        const tempMessage = {
          id: `temp-${Date.now()}`,
          content,
          sender_id: currentUserId,
          project_id: projectId,
          created_at: new Date().toISOString(),
          sender_name: currentUserProfile?.full_name || 'You',
          is_sending: true,
          reply_to: replyContext,
          reply_to_message_id: replyingTo?.id
        };

        setMessages(prev => [...prev, tempMessage]);
        setTimeout(scrollToBottom, 100);

        // Create new message
        const { data: newMessage, error } = await supabase
          .from("messages")
          .insert({
            project_id: projectId,
            sender_id: currentUserId,
            content,
            reply_to_message_id: replyingTo?.id || null,
            attachment_url: attachmentUrl,
            attachment_type: attachmentType,
            is_read: false
          })
          .select()
          .single();

        if (error) {
          // Remove temp message on error
          setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
          throw error;
        }

        // Replace temp message with real one
        setMessages(prev => prev.map(m =>
          m.id === tempMessage.id
            ? {
              ...newMessage,
              sender_name: currentUserProfile?.full_name || 'You',
              is_sending: false,
              reply_to: replyContext
            }
            : m
        ));

        setReplyingTo(null);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageToDelete);

      if (error) throw error;
      toast.success("Message deleted");
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      const reactions = message.reactions || {};
      const userReactions = reactions[emoji] || [];

      // Toggle reaction
      const updatedReactions = userReactions.includes(currentUserId)
        ? userReactions.filter((id: string) => id !== currentUserId)
        : [...userReactions, currentUserId];

      if (updatedReactions.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = updatedReactions;
      }

      const { error } = await supabase
        .from("messages")
        .update({ reactions })
        .eq("id", messageId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  const handlePin = async (messageId: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      const { error } = await supabase
        .from("messages")
        .update({ is_pinned: !message.is_pinned })
        .eq("id", messageId);

      if (error) throw error;
      toast.success(message.is_pinned ? "Message unpinned" : "Message pinned");
    } catch (error) {
      console.error("Failed to pin message:", error);
      toast.error("Failed to pin message");
    }
  };

  const handleStar = async (messageId: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      const { error } = await supabase
        .from("messages")
        .update({ is_starred: !message.is_starred })
        .eq("id", messageId);

      if (error) throw error;
      toast.success(message.is_starred ? "Message unstarred" : "Message starred");
    } catch (error) {
      console.error("Failed to star message:", error);
      toast.error("Failed to star message");
    }
  };

  const handleInfo = (messageId: string) => {
    setSelectedMessageId(messageId);
    setMessageInfoOpen(true);
  };

  const handleSearchResultSelect = (messageId: string) => {
    setHighlightedMessageId(messageId);

    // Scroll to the message
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Clear highlight after 2 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  const handleClearChatHistory = async () => {
    if (!confirm("Are you sure you want to clear chat history? This will only clear messages for you.")) {
      return;
    }
    toast.info("Clear chat history feature - Coming soon");
  };

  const handleRequestProcessed = () => {
    loadJoinRequests();
    loadMessages();
    setTimeout(scrollToBottom, 100);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      <ChatBackground />

      {/* Chat Header - WhatsApp Style with Back Button on Mobile */}
      <div className="fixed md:sticky top-0 left-0 right-0 border-b bg-card/95 backdrop-blur-sm px-3 sm:px-4 md:px-6 py-3 sm:py-3.5 md:py-4 flex items-center justify-between shadow-sm z-50 w-full max-w-full flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Back Button - Only visible on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden flex-shrink-0 h-8 w-8"
            onClick={() => {
              if (onBack) onBack();
            }}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-xs sm:text-sm md:text-base truncate">{projectName}</h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Project Chat</p>
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-destructive'} flex-shrink-0`}
                title={isConnected ? 'Connected' : 'Disconnected'} />
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {isConnected
                  ? (onlineCount > 0
                    ? `${onlineCount} online${totalMembers > 0 ? ` of ${totalMembers}` : ''}`
                    : 'Online')
                  : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
          {/* Members List */}
          {projectCreatorId && (
            <ChatMembers
              projectId={projectId}
              currentUserId={currentUserId}
              projectCreatorId={projectCreatorId}
              onMemberRemoved={loadMessages}
            />
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
            onClick={() => toast.info("Audio call - Coming soon")}
            title="Start audio call"
          >
            <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
            onClick={() => toast.info("Video call - Coming soon")}
            title="Start video call"
          >
            <Video className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
              >
                <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.info("View project details - Coming soon")}>
                View project details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Already available in header")}>
                Manage participants
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleClearChatHistory}>
                Clear chat history
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* WhatsApp-Style Search - Positioned Below Header */}
      {searchOpen && (
        <div className="fixed md:sticky top-[52px] sm:top-[56px] md:top-0 left-0 right-0 z-40 bg-background dark:bg-background">
          <ChatSearch
            messages={messages}
            onResultSelect={handleSearchResultSelect}
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
          />
        </div>
      )}

      {/* Messages Area - Responsive with padding for sticky header and fixed input */}
      <div
        className={`flex-1 w-full overflow-y-auto overflow-x-hidden px-2 sm:px-3 md:px-6 pb-20 md:pb-0 ${searchOpen ? 'pt-[100px] sm:pt-[110px] md:pt-0' : 'pt-16 md:pt-0'
          }`}
      >
        {/* Join Requests - Show if any exist (RPC handles access control) */}
        {joinRequests.length > 0 && (
          <div className="px-1 sm:px-2 md:px-4 pt-3 sm:pt-3.5 md:pt-4 pb-2">
            {joinRequests.map((request) => (
              <JoinRequestNotification
                key={request.id}
                request={request}
                projectId={projectId}
                onRequestProcessed={handleRequestProcessed}
              />
            ))}
          </div>
        )}

        <div className="space-y-2 sm:space-y-3 md:space-y-4 py-2 sm:py-3 md:py-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12 text-xs sm:text-sm text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message, index) => {
              // Check if we need to show a date separator
              const showDateSeparator = index === 0 ||
                new Date(messages[index - 1].created_at).toDateString() !== new Date(message.created_at).toDateString();

              return (
                <div key={message.id}>
                  {/* Date Separator */}
                  {showDateSeparator && (
                    <DateSeparator date={message.created_at} />
                  )}

                  {/* Render system messages differently */}
                  {message.is_system_message ? (
                    (() => {
                      try {
                        const data = message.system_message_data
                          ? JSON.parse(message.system_message_data)
                          : { type: message.system_message_type, user_name: 'User' };

                        return (
                          <SystemMessage
                            type={data.type || message.system_message_type}
                            userName={data.user_name || 'User'}
                            timestamp={message.created_at}
                          />
                        );
                      } catch (error) {
                        console.error('Failed to parse system message:', error);
                        return null;
                      }
                    })()
                  ) : (
                    // Render regular messages
                    <div
                      id={`message-${message.id}`}
                      className={highlightedMessageId === message.id ? "animate-pulse bg-yellow-100 dark:bg-yellow-900/20 rounded-lg transition-colors" : ""}
                    >
                      <MessageBubble
                        message={message}
                        currentUserId={currentUserId}
                        isOwnMessage={message.sender_id === currentUserId}
                        onReply={setReplyingTo}
                        onEdit={setEditingMessage}
                        onDelete={(id) => {
                          setMessageToDelete(id);
                          setDeleteDialogOpen(true);
                        }}
                        onReact={handleReact}
                        onPin={handlePin}
                        onStar={handleStar}
                        onInfo={handleInfo}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing Indicator */}
        <TypingIndicator typingUsers={typingUsers} />
      </div>

      {/* Message Input - Fixed at Bottom on mobile, sticky on desktop */}
      <div className="fixed md:sticky bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-t shadow-lg w-full max-w-full flex-shrink-0 md:mt-auto">
        <MessageInput
          onSend={handleSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onTyping={handleTyping}
        />
      </div>

      {/* Message Info Dialog */}
      <MessageInfoDialog
        messageId={selectedMessageId || ""}
        open={messageInfoOpen}
        onOpenChange={setMessageInfoOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
