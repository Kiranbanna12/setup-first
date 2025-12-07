// @ts-nocheck
/**
 * ChatList - Optimized for instant loading like WhatsApp
 * Uses batch queries instead of per-project queries
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Pin, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ChatListProps {
  currentUserId: string;
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}

interface ProjectChat {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  pinned: boolean;
  is_shared?: boolean;
}

// Cache for chat list
let chatCache: { chats: ProjectChat[]; timestamp: number; userId: string } | null = null;
const CACHE_TTL = 30000; // 30 seconds

export const ChatList = ({ currentUserId, selectedProjectId, onSelectProject }: ChatListProps) => {
  const [chats, setChats] = useState<ProjectChat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  // Handle realtime message updates
  const handleMessageChange = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT') {
      const newMessage = payload.new;
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => c.id === newMessage.project_id);
        if (chatIndex === -1) return prevChats; // Project not in list

        const updatedChats = [...prevChats];
        const chat = { ...updatedChats[chatIndex] };

        // Update last message
        chat.lastMessage = newMessage.content || 'New message';
        chat.lastMessageTime = newMessage.created_at;

        // Increment unread count if not from current user and not in selected chat
        if (newMessage.sender_id !== currentUserId && newMessage.project_id !== selectedProjectId) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }

        updatedChats[chatIndex] = chat;

        // Re-sort by last message time
        updatedChats.sort((a, b) =>
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );

        return updatedChats;
      });
    } else if (payload.eventType === 'UPDATE') {
      // Handle read status updates - decrease unread count
      const updatedMessage = payload.new;
      if (updatedMessage.is_read) {
        setChats(prevChats => {
          const chatIndex = prevChats.findIndex(c => c.id === updatedMessage.project_id);
          if (chatIndex === -1) return prevChats;

          const updatedChats = [...prevChats];
          const chat = { ...updatedChats[chatIndex] };

          // Recalculate unread or just decrement
          if (chat.unreadCount > 0) {
            chat.unreadCount = Math.max(0, chat.unreadCount - 1);
          }

          updatedChats[chatIndex] = chat;
          return updatedChats;
        });
      }
    }
  }, [currentUserId, selectedProjectId]);

  useEffect(() => {
    // Check cache first for instant display
    if (chatCache && chatCache.userId === currentUserId && Date.now() - chatCache.timestamp < CACHE_TTL) {
      setChats(chatCache.chats);
      setLoading(false);
      // Still refresh in background
      loadChatsOptimized(true);
    } else {
      loadChatsOptimized(false);
    }

    // Set up realtime subscription for messages
    const messagesChannel = supabase
      .channel(`chatlist-messages-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        handleMessageChange
      )
      .subscribe();

    // Also subscribe to project_chat_members for join updates
    const membersChannel = supabase
      .channel(`chatlist-members-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_chat_members'
        },
        () => {
          // Reload chats when membership changes
          loadChatsOptimized(true);
        }
      )
      .subscribe();

    // Fallback refresh every 60 seconds (less aggressive, realtime handles most updates)
    const interval = setInterval(() => loadChatsOptimized(true), 60000);

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(membersChannel);
      clearInterval(interval);
    };
  }, [currentUserId, handleMessageChange]);

  // Reset unread count when selecting a project
  useEffect(() => {
    if (selectedProjectId) {
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => c.id === selectedProjectId);
        if (chatIndex === -1) return prevChats;

        const updatedChats = [...prevChats];
        updatedChats[chatIndex] = { ...updatedChats[chatIndex], unreadCount: 0 };
        return updatedChats;
      });
    }
  }, [selectedProjectId]);

  const loadChatsOptimized = async (isBackground: boolean) => {
    // Prevent duplicate loads
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      if (!isBackground) setLoading(true);

      // Single query to get all user's projects
      const { data: myProjects } = await supabase
        .from("projects")
        .select("id, name, created_at, updated_at, created_by, editor_id")
        .eq("created_by", currentUserId)
        .order("updated_at", { ascending: false });

      // Get projects where user is editor (single query)
      const { data: editorData } = await supabase
        .from('editors')
        .select('id')
        .eq('user_id', currentUserId);

      let assignedProjects: any[] = [];
      if (editorData && editorData.length > 0) {
        const editorIds = editorData.map(e => e.id);
        const { data: p } = await supabase
          .from('projects')
          .select('id, name, created_at, updated_at, created_by, editor_id')
          .in('editor_id', editorIds)
          .neq('created_by', currentUserId);
        // Note: Editor-assigned projects are NOT marked as is_shared (they are "assigned" projects)
        assignedProjects = p || [];
      }

      // Get projects accessed via shared links with chat permission
      const { data: sharedAccessData } = await (supabase as any)
        .from('user_accessed_shares')
        .select('project_id, can_chat')
        .eq('user_id', currentUserId)
        .eq('can_chat', true);

      let sharedChatProjects: any[] = [];
      if (sharedAccessData && sharedAccessData.length > 0) {
        const sharedProjectIds = sharedAccessData.map((s: any) => s.project_id);
        const { data: sharedProjects } = await supabase
          .from('projects')
          .select('id, name, created_at, updated_at, created_by')
          .in('id', sharedProjectIds)
          .neq('created_by', currentUserId);

        // Mark shared-link projects with is_shared flag
        sharedChatProjects = (sharedProjects || []).map((p: any) => ({
          ...p,
          is_shared: true
        }));
      }

      // Combine and deduplicate
      const allProjects = [...(myProjects || [])];
      assignedProjects.forEach(p => {
        if (!allProjects.find(existing => existing.id === p.id)) {
          allProjects.push(p); // No is_shared flag for editor assignments
        }
      });

      // Add shared-link chat projects
      sharedChatProjects.forEach(p => {
        if (!allProjects.find(existing => existing.id === p.id)) {
          allProjects.push(p);
        }
      });

      if (allProjects.length === 0) {
        setChats([]);
        chatCache = { chats: [], timestamp: Date.now(), userId: currentUserId };
        return;
      }

      const projectIds = allProjects.map(p => p.id);

      // BATCH: Get last message for all projects in ONE query
      // This uses a subquery approach - get recent messages grouped by project
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id, project_id, content, created_at, sender_id, is_read')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      // Process messages to get last message per project
      const lastMessages: Record<string, any> = {};
      const unreadCounts: Record<string, number> = {};

      (allMessages || []).forEach(msg => {
        // Track last message per project
        if (!lastMessages[msg.project_id]) {
          lastMessages[msg.project_id] = msg;
        }
        // Count unread (not sent by user and not read)
        if (msg.sender_id !== currentUserId && !msg.is_read) {
          unreadCounts[msg.project_id] = (unreadCounts[msg.project_id] || 0) + 1;
        }
      });

      // Build chat list
      const chatList: ProjectChat[] = allProjects.map(project => {
        const lastMsg = lastMessages[project.id];
        return {
          id: project.id,
          name: project.name,
          lastMessage: lastMsg?.content || "No messages yet",
          lastMessageTime: lastMsg?.created_at || project.created_at,
          unreadCount: unreadCounts[project.id] || 0,
          pinned: false,
          is_shared: project.is_shared
        };
      });

      // Sort by last message time
      chatList.sort((a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setChats(chatList);
      chatCache = { chats: chatList, timestamp: Date.now(), userId: currentUserId };
    } catch (error) {
      console.error("Failed to load chats:", error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const filteredChats = useMemo(() =>
    chats.filter(chat => chat.name.toLowerCase().includes(search.toLowerCase())),
    [chats, search]
  );

  const pinnedChats = useMemo(() => filteredChats.filter(c => c.pinned), [filteredChats]);
  const regularChats = useMemo(() => filteredChats.filter(c => !c.pinned), [filteredChats]);

  return (
    <div className="w-full md:w-80 lg:w-96 border-r flex flex-col bg-card h-full overflow-hidden">
      {/* Search Bar - Fixed at top */}
      <div className="p-3 sm:p-4 border-b space-y-2 bg-card flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 sm:pl-9 h-9 text-xs sm:text-sm"
          />
        </div>
      </div>

      {/* Chat List - Scrollable content area */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 sm:p-2 space-y-0.5 sm:space-y-1">
          {loading && chats.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {pinnedChats.length > 0 && (
                <>
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                    <Pin className="h-3 w-3 flex-shrink-0" />
                    PINNED
                  </div>
                  {pinnedChats.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      isSelected={chat.id === selectedProjectId}
                      onClick={() => onSelectProject(chat.id)}
                    />
                  ))}
                </>
              )}

              {regularChats.length > 0 && pinnedChats.length > 0 && (
                <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-muted-foreground">
                  ALL CHATS
                </div>
              )}

              {regularChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isSelected={chat.id === selectedProjectId}
                  onClick={() => onSelectProject(chat.id)}
                />
              ))}

              {filteredChats.length === 0 && !loading && (
                <div className="p-6 sm:p-8 text-center text-muted-foreground text-xs sm:text-sm">
                  {search ? "No projects found" : "No projects yet"}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

interface ChatListItemProps {
  chat: ProjectChat;
  isSelected: boolean;
  onClick: () => void;
}

const ChatListItem = ({ chat, isSelected, onClick }: ChatListItemProps) => {
  return (
    <div
      onClick={onClick}
      className={`p-2 sm:p-3 rounded-lg cursor-pointer transition-all duration-200 ${isSelected
        ? "bg-[#f0f2f5] dark:bg-[#2a2f32] border-l-4 border-l-[#25D366]"
        : "hover:bg-[#f5f6f6] dark:hover:bg-[#202428]"
        }`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          <h3 className={`font-semibold text-xs sm:text-sm truncate ${isSelected ? 'text-foreground' : ''}`}>
            {chat.name}
          </h3>
          {chat.is_shared && (
            <Badge variant="outline" className="h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs shrink-0">
              <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </Badge>
          )}
        </div>
        {chat.unreadCount > 0 && (
          <Badge
            variant="default"
            className="ml-1.5 sm:ml-2 h-4 sm:h-5 min-w-4 sm:min-w-5 rounded-full px-1 sm:px-1.5 text-[10px] sm:text-xs shrink-0 bg-[#25D366] hover:bg-[#25D366] animate-in fade-in zoom-in duration-200"
          >
            {chat.unreadCount}
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1">
          {chat.lastMessage}
        </p>
        <span className="text-[10px] sm:text-xs text-muted-foreground ml-1.5 sm:ml-2 shrink-0">
          {format(new Date(chat.lastMessageTime), "HH:mm")}
        </span>
      </div>
    </div>
  );
};
