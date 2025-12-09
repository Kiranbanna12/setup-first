import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdvancedRichEditor from '@/components/shared/AdvancedRichEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import {
    BookOpen, Save, ArrowLeft, Star, StarOff, Clock, Trash2, Plus, X
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type NotePage = {
    id: string;
    name: string;
    content: string;
};

type Note = {
    id: string;
    title: string;
    notebook?: string;
    section?: string;
    type: 'rich' | 'text';
    content?: string;
    pages?: NotePage[];
    tags?: string[];
    is_favorite?: boolean;
    created_at?: string;
    updated_at?: string;
    project_id?: string | null;
    projects?: {
        name: string;
    };
};

const NoteDetails: React.FC = () => {
    const { projectId, noteId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [note, setNote] = useState<Note | null>(null);
    const [activePageId, setActivePageId] = useState<string>('main');

    useEffect(() => {
        if (!noteId) return;
        loadNote();
    }, [noteId]);

    const loadNote = async () => {
        setLoading(true);
        try {
            const { data: foundNote, error } = await supabase
                .from('notes')
                .select(`
            *,
            projects (
                name
            )
        `)
                .eq('id', noteId)
                .single();

            if (error) throw error;

            if (foundNote) {
                let parsed: any = {};
                try {
                    if (foundNote.content && typeof foundNote.content === 'string') {
                        // Try to parse content as JSON (new structure)
                        // If it starts with { and contains __notebook_page, it's our rich structure
                        if (foundNote.content.trim().startsWith('{') && foundNote.content.includes('__notebook_page')) {
                            const maybe = JSON.parse(foundNote.content);
                            if (maybe && maybe.__notebook_page) {
                                parsed = { ...maybe };
                            }
                        } else {
                            // Legacy or simple content
                            parsed = { body: foundNote.content };
                        }
                    }
                } catch (e) {
                    // If parsing fails, treat as simple string
                    parsed = { body: foundNote.content };
                }

                setNote({
                    id: foundNote.id,
                    title: foundNote.title,
                    notebook: parsed.notebook || 'Default',
                    section: parsed.section || 'Quick Notes',
                    type: 'rich',
                    content: parsed.body || '',
                    pages: parsed.pages || [],
                    tags: foundNote.tags || [],
                    is_favorite: foundNote.is_favorite,
                    created_at: foundNote.created_at,
                    updated_at: foundNote.updated_at,
                    project_id: foundNote.project_id,
                    projects: foundNote.projects
                });
            } else {
                toast.error('Note not found');
                navigate(projectId ? `/projects/${projectId}/notes` : `/notes`);
            }
        } catch (err) {
            console.error('Failed to load note', err);
            toast.error('Failed to load note');
            navigate(projectId ? `/projects/${projectId}/notes` : `/notes`);
        } finally {
            setLoading(false);
        }
    };

    const saveNote = async () => {
        if (!note) return;
        setLoading(true);
        try {
            const contentToSave = JSON.stringify({
                __notebook_page: true,
                notebook: note.notebook,
                section: note.section,
                title: note.title,
                body: note.content,
                pages: note.pages || [],
                tags: note.tags,
            });

            const { error } = await supabase
                .from('notes')
                .update({
                    title: note.title,
                    content: contentToSave,
                    tags: note.tags,
                    is_favorite: note.is_favorite
                })
                .eq('id', note.id);

            if (error) throw error;

            await loadNote();
            toast.success('Note saved');
        } catch (err) {
            console.error("Error saving note:", err);
            toast.error('Failed to save note');
        } finally {
            setLoading(false);
        }
    };

    const deleteNote = async () => {
        if (!note) return;
        try {
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', note.id);

            if (error) throw error;

            toast.success('Note deleted');
            navigate(projectId ? `/projects/${projectId}/notes` : `/notes`);
        } catch (err) {
            console.error("Error deleting note:", err);
            toast.error('Failed to delete note');
        }
    };

    const toggleFavorite = () => {
        if (!note) return;
        setNote({ ...note, is_favorite: !note.is_favorite });
    };

    const addNewPage = () => {
        if (!note) return;
        const newPage: NotePage = {
            id: `page-${Date.now()}`,
            name: `Page ${(note.pages?.length || 0) + 2}`,
            content: '<p></p>'
        };
        setNote({ ...note, pages: [...(note.pages || []), newPage] });
        setActivePageId(newPage.id);
        toast.success('New page added');
    };

    const deletePage = (pageId: string) => {
        if (!note || !note.pages) return;
        const updatedPages = note.pages.filter(p => p.id !== pageId);
        setNote({ ...note, pages: updatedPages });
        if (activePageId === pageId) {
            setActivePageId('main');
        }
        toast.success('Page deleted');
    };

    const renamePage = (pageId: string, newName: string) => {
        if (!note || !note.pages) return;
        const updatedPages = note.pages.map(p =>
            p.id === pageId ? { ...p, name: newName } : p
        );
        setNote({ ...note, pages: updatedPages });
    };

    const getActiveContent = (): string => {
        if (activePageId === 'main') {
            return note?.content || '<p></p>';
        }
        const activePage = note?.pages?.find(p => p.id === activePageId);
        return activePage?.content || '<p></p>';
    };

    const updateActiveContent = (newContent: string) => {
        if (!note) return;
        if (activePageId === 'main') {
            setNote({ ...note, content: newContent });
        } else {
            const updatedPages = note.pages?.map(p =>
                p.id === activePageId ? { ...p, content: newContent } : p
            ) || [];
            setNote({ ...note, pages: updatedPages });
        }
    };

    if (loading && !note) {
        return (
            <SidebarProvider>
                <div className="flex w-full h-screen overflow-hidden">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
                        <div className="border-b bg-card p-3 md:p-4 flex-shrink-0">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-8 w-8 bg-muted/50 rounded animate-pulse" />
                                <div className="h-8 w-8 bg-muted/50 rounded animate-pulse" />
                                <div className="flex-1 h-9 bg-muted/40 rounded animate-pulse" />
                                <div className="h-8 w-8 bg-muted/50 rounded animate-pulse" />
                                <div className="h-8 w-16 bg-muted/50 rounded animate-pulse" />
                            </div>
                            <div className="flex gap-2 ml-10">
                                <div className="h-5 w-20 bg-muted/40 rounded animate-pulse" />
                                <div className="h-5 w-32 bg-muted/30 rounded animate-pulse" />
                            </div>
                        </div>
                        <div className="flex-1 p-4 md:p-8">
                            <div className="max-w-7xl mx-auto space-y-4">
                                <div className="h-6 w-3/4 bg-muted/40 rounded animate-pulse" />
                                <div className="h-4 w-full bg-muted/30 rounded animate-pulse" />
                                <div className="h-4 w-5/6 bg-muted/30 rounded animate-pulse" />
                                <div className="h-4 w-2/3 bg-muted/30 rounded animate-pulse" />
                                <div className="h-32 w-full bg-muted/20 rounded animate-pulse mt-8" />
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarProvider>
        );
    }

    if (!note) {
        return <div className="p-4">Note not found</div>;
    }

    return (
        <SidebarProvider>
            <div className="flex w-full h-screen overflow-hidden">
                <AppSidebar />
                <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
                    {/* Top Bar */}
                    <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm z-50 flex-shrink-0">
                        <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate(projectId ? `/projects/${projectId}/notes` : `/notes`)}
                                    className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                                    title="Back to notes"
                                >
                                    <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                                </Button>
                                <SidebarTrigger className="flex-shrink-0" />
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-muted-foreground" />
                                    <Input
                                        value={note.title}
                                        onChange={e => setNote({ ...note, title: e.target.value })}
                                        className="flex-1 text-lg sm:text-xl lg:text-2xl font-bold h-9 sm:h-10 lg:h-12 border-none shadow-none focus-visible:ring-0 px-1 sm:px-2 bg-transparent"
                                        placeholder="Note title..."
                                    />
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={toggleFavorite}
                                        className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                                        title="Toggle favorite"
                                    >
                                        {note.is_favorite ? (
                                            <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                                        ) : (
                                            <StarOff className="w-4 h-4 sm:w-5 sm:h-5" />
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={saveNote}
                                        disabled={loading}
                                        className="h-8 sm:h-9 flex-shrink-0 px-3 sm:px-4"
                                    >
                                        <Save className="w-4 h-4 sm:w-4 sm:h-4 sm:mr-2" />
                                        <span className="hidden sm:inline text-sm">Save</span>
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0 text-destructive hover:text-destructive"
                                                title="Delete note"
                                            >
                                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Note</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete this note? This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={deleteNote} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground ml-10 sm:ml-12 lg:ml-14">
                                <Badge variant="outline" className="text-xs font-normal truncate max-w-[150px] sm:max-w-[200px]">
                                    {note.projects?.name || 'Personal'}
                                </Badge>
                                <Separator orientation="vertical" className="h-3 sm:h-4 hidden sm:block" />
                                <div className="flex items-center gap-1.5 truncate">
                                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                    <span className="truncate">
                                        {note.updated_at
                                            ? `${format(new Date(note.updated_at), 'MMM d, yyyy h:mm a')}`
                                            : 'Not saved'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Editor Area */}
                    <div className="flex-1 overflow-hidden bg-muted/10">
                        <div className="w-full h-full p-0 sm:p-4 md:p-6 lg:p-8">
                            <div className="max-w-5xl mx-auto h-full shadow-sm">
                                <AdvancedRichEditor
                                    key={activePageId}
                                    value={getActiveContent()}
                                    onChange={(val: string) => updateActiveContent(val)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tabs Bar (like spreadsheet) */}
                    <div className="border-t bg-muted/30 flex items-center gap-1 p-1 overflow-x-auto flex-shrink-0">
                        {/* Main Page Tab */}
                        <button
                            onClick={() => setActivePageId('main')}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${activePageId === 'main'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                }`}
                        >
                            Main
                        </button>

                        {/* Additional Pages */}
                        {note.pages?.map((page, index) => (
                            <div key={page.id} className="flex items-center group">
                                <button
                                    onClick={() => setActivePageId(page.id)}
                                    onDoubleClick={() => {
                                        const newName = prompt('Enter new page name:', page.name);
                                        if (newName && newName.trim()) {
                                            renamePage(page.id, newName.trim());
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-l text-sm font-medium transition-colors whitespace-nowrap ${activePageId === page.id
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                        }`}
                                >
                                    {page.name}
                                </button>
                                <button
                                    onClick={() => deletePage(page.id)}
                                    className={`px-1 py-1.5 rounded-r text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity ${activePageId === page.id ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                                        }`}
                                    title="Delete page"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {/* Add New Page Button */}
                        <button
                            onClick={addNewPage}
                            className="px-2 py-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors flex items-center gap-1 ml-1"
                            title="Add new page"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">New Page</span>
                        </button>
                    </div>
                </div>
            </div>
        </SidebarProvider>
    );
};

export default NoteDetails;
