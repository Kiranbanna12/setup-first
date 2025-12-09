import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BookOpen, Plus, Search, Trash2, FileText, MoreVertical, Clock, Filter, Star, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Note {
    id: string;
    title: string;
    content: string;
    project_id: string | null;
    created_at: string;
    updated_at: string;
    is_favorite: boolean;
    type: 'rich' | 'text';
    projects?: {
        name: string;
    };
}

const TEMPLATES = [
    { id: 'meeting', name: 'Meeting Notes', icon: '📋', content: '<h1>Meeting Notes</h1><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ul><li></li></ul><h2>Discussion</h2><p></p><h2>Action Items</h2><ul><li></li></ul>' },
    { id: 'project', name: 'Project Plan', icon: '📁', content: '<h1>Project Plan</h1><h2>Overview</h2><p></p><h2>Goals</h2><ul><li></li></ul><h2>Timeline</h2><p></p><h2>Resources</h2><p></p>' },
    { id: 'todo', name: 'To-Do List', icon: '✅', content: '<h1>To-Do List</h1><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Task 1</li><li data-type="taskItem" data-checked="false">Task 2</li></ul>' },
    { id: 'blank', name: 'Blank Page', icon: '📄', content: '<p></p>' },
];

export default function Notes() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { projectId } = useParams();
    const [notes, setNotes] = useState<Note[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("all");

    // Dialog states
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState("");
    const [noteType, setNoteType] = useState<'personal' | 'project'>('personal');
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (projectId) {
            setFilterType('project');
            setSelectedProjectId(projectId);
            setNoteType('project');
        }
    }, [projectId]);

    useEffect(() => {
        // Load all data in parallel for faster loading
        loadAllData();
    }, [projectId]);

    // Optimized: Load all data in parallel with a single auth call
    const loadAllData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Run both queries in parallel
            const [notesResult, projectsResult] = await Promise.all([
                loadNotesQuery(projectId),
                supabase.from('projects').select('id, name').order('created_at', { ascending: false })
            ]);

            // Process notes
            if (notesResult.data) {
                setNotes((notesResult.data || []).map((n: any) => ({
                    ...n,
                    type: (n.type === 'rich' || n.type === 'text') ? n.type : 'rich'
                })));
            }

            // Process projects
            setProjects(projectsResult.data || []);
        } catch (error) {
            console.error('Error loading notes data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper function for notes query
    const loadNotesQuery = (projectIdParam?: string) => {
        let query = supabase
            .from('notes')
            .select(`
          *,
          projects (
            name
          )
        `)
            .order('updated_at', { ascending: false });

        if (projectIdParam) {
            query = query.eq('project_id', projectIdParam);
        }

        return query;
    };

    // Keep separate functions for manual refresh if needed
    const loadNotes = async () => {
        try {
            const result = await loadNotesQuery(projectId);
            if (result.data) {
                setNotes((result.data || []).map((n: any) => ({
                    ...n,
                    type: (n.type === 'rich' || n.type === 'text') ? n.type : 'rich'
                })));
            }
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    };

    const loadProjects = async () => {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    };

    const handleCreateNote = async () => {
        if (!newNoteTitle.trim()) {
            toast.error("Please enter a title");
            return;
        }

        if (noteType === 'project' && !selectedProjectId) {
            toast.error("Please select a project");
            return;
        }

        try {
            setCreating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("You must be logged in");
                return;
            }

            const { data, error } = await supabase
                .from('notes')
                .insert({
                    title: newNoteTitle,
                    content: '',
                    project_id: noteType === 'project' ? selectedProjectId : null,
                    created_by: user.id,
                    type: 'rich'
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("Note created successfully");
            setShowCreateDialog(false);
            setNewNoteTitle("");
            setNoteType('personal');
            setSelectedProjectId("");

            // Navigate to the new note
            if (data) {
                if (data.project_id) {
                    navigate(`/projects/${data.project_id}/notes/${data.id}`);
                } else {
                    navigate(`/notes/${data.id}`);
                }
            }
        } catch (error) {
            console.error('Error creating note:', error);
            toast.error("Failed to create note");
        } finally {
            setCreating(false);
        }
    };

    const deleteNote = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this note?")) return;

        try {
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setNotes(notes.filter(n => n.id !== id));
            toast.success("Note deleted");
        } catch (error) {
            console.error("Error deleting note:", error);
            toast.error("Failed to delete note");
        }
    };

    const toggleFavorite = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const { error } = await supabase
                .from('notes')
                .update({ is_favorite: !note.is_favorite })
                .eq('id', note.id);

            if (error) throw error;

            setNotes(notes.map(n => n.id === note.id ? { ...n, is_favorite: !n.is_favorite } : n));
        } catch (error) {
            console.error("Error updating note:", error);
        }
    };

    const filteredNotes = notes.filter(note => {
        const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (note.projects?.name.toLowerCase() || "").includes(searchQuery.toLowerCase());
        const matchesFilter = filterType === 'all' ||
            (filterType === 'favorites' && note.is_favorite) ||
            (filterType === 'personal' && !note.project_id) ||
            (filterType === 'project' && note.project_id);
        return matchesSearch && matchesFilter;
    });

    return (
        <SidebarProvider>
            <div className="flex w-full min-h-screen">
                <AppSidebar />
                <div className="flex-1 bg-background dark:bg-background">
                    <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-3 sm:gap-4">
                            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                                <SidebarTrigger />
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                                        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                                    </div>
                                    <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Notes</h1>
                                </div>
                                {projectId && (
                                    <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)} className="hidden sm:flex">
                                        Back to Project
                                    </Button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                                <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                                    <div className="relative flex-1 min-w-0 sm:w-[200px]">
                                        <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3 sm:h-4 sm:w-4" />
                                        <Input
                                            placeholder="Search notes..."
                                            className="pl-8 sm:pl-10 h-9 sm:h-10 text-xs sm:text-sm w-full"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger className="w-[90px] sm:w-[150px] h-9 sm:h-10 text-xs sm:text-sm px-2 sm:px-3">
                                            <Filter className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                                            <span className="hidden sm:inline">Filter</span>
                                            <span className="sm:hidden">Sort</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Notes</SelectItem>
                                            <SelectItem value="favorites">Favorites</SelectItem>
                                            <SelectItem value="personal">Personal</SelectItem>
                                            <SelectItem value="project">Project Notes</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    onClick={() => setShowCreateDialog(true)}
                                    className="flex-shrink-0 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                                >
                                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                                    <span className="hidden sm:inline">New Note</span>
                                    <span className="sm:hidden">New</span>
                                </Button>
                            </div>
                        </div>
                    </header>

                    <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
                        <div className="mb-4 sm:mb-6 lg:mb-8">
                            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Your Notes</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Capture ideas, meeting minutes, and project requirements.
                            </p>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                    <Card key={i} className="border-l-4 border-l-muted/50">
                                        <CardHeader className="p-4 pb-2 space-y-2">
                                            <div className="flex items-start justify-between">
                                                <div className="h-5 w-3/4 bg-muted/50 rounded animate-pulse" />
                                                <div className="h-5 w-5 bg-muted/50 rounded animate-pulse" />
                                            </div>
                                            <div className="h-5 w-24 bg-muted/30 rounded animate-pulse" />
                                        </CardHeader>
                                        <CardContent className="p-4 pt-2">
                                            <div className="space-y-2 min-h-[3rem]">
                                                <div className="h-3 w-full bg-muted/40 rounded animate-pulse" />
                                                <div className="h-3 w-5/6 bg-muted/40 rounded animate-pulse" />
                                                <div className="h-3 w-2/3 bg-muted/40 rounded animate-pulse" />
                                            </div>
                                            <div className="h-3 w-28 bg-muted/30 rounded animate-pulse mt-3" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : filteredNotes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-muted/20 rounded-lg border-2 border-dashed">
                                <div className="bg-background p-4 rounded-full mb-4 shadow-sm">
                                    <FileText className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">No notes found</h3>
                                <p className="text-muted-foreground max-w-sm mb-6 text-sm">
                                    Create your first note to keep track of ideas, meeting minutes, or project requirements.
                                </p>
                                <Button onClick={() => setShowCreateDialog(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Note
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredNotes.map(note => (
                                    <Card
                                        key={note.id}
                                        className="cursor-pointer group hover:shadow-md transition-all border-l-4"
                                        style={{ borderLeftColor: note.project_id ? 'hsl(142, 76%, 36%)' : '#ec4899' }}
                                        onClick={() => {
                                            if (note.project_id) {
                                                navigate(`/projects/${note.project_id}/notes/${note.id}`);
                                            } else {
                                                navigate(`/notes/${note.id}`);
                                            }
                                        }}
                                    >
                                        <CardHeader className="p-4 pb-2 space-y-2">
                                            <div className="flex items-start justify-between">
                                                <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors text-sm sm:text-base">
                                                    {note.title}
                                                </h3>
                                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={(e) => toggleFavorite(note, e)}
                                                    >
                                                        <Star className={`w-3.5 h-3.5 ${note.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <MoreVertical className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={(e) => deleteNote(note.id, e)}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                {note.project_id ? (
                                                    <span className="flex items-center gap-1 bg-success/10 dark:bg-success/20 text-success dark:text-success px-1.5 py-0.5 rounded">
                                                        <BookOpen className="w-3 h-3" />
                                                        {note.projects?.name || 'Unknown Project'}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded">
                                                        <FileText className="w-3 h-3" />
                                                        Personal
                                                    </span>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-2">
                                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 min-h-[3rem]">
                                                {(() => {
                                                    try {
                                                        if (note.content?.trim().startsWith('{')) {
                                                            const parsed = JSON.parse(note.content);
                                                            if (parsed && typeof parsed === 'object') {
                                                                const body = parsed.body || '';
                                                                return body.replace(/<[^>]*>?/gm, '') || "No content...";
                                                            }
                                                        }
                                                    } catch (e) {
                                                        // Fallback to simple string
                                                    }
                                                    return note.content?.replace(/<[^>]*>?/gm, '') || "No content...";
                                                })()}
                                            </p>
                                            <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
                                                <Clock className="w-3 h-3" />
                                                Updated {format(new Date(note.updated_at), 'MMM d, yyyy')}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </main>
                </div>

                {/* Create Note Dialog */}
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Create New Note</DialogTitle>
                            <DialogDescription>
                                Create a new personal note or associate it with a project.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    placeholder="Note title..."
                                    value={newNoteTitle}
                                    onChange={(e) => setNewNoteTitle(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Type</Label>
                                <RadioGroup
                                    value={noteType}
                                    onValueChange={(v: 'personal' | 'project') => setNoteType(v)}
                                    className="flex gap-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="personal" id="personal" />
                                        <Label htmlFor="personal" className="cursor-pointer font-normal">Personal</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="project" id="project" />
                                        <Label htmlFor="project" className="cursor-pointer font-normal">Project</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {noteType === 'project' && (
                                <div className="space-y-2">
                                    <Label>Select Project</Label>
                                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a project..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {projects.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                            <Button onClick={handleCreateNote} disabled={creating}>
                                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Create"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </SidebarProvider>
    );
}
