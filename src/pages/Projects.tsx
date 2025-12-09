// @ts-nocheck
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Video, Plus } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectsTable } from "@/components/projects/ProjectsTable";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectSearch } from "@/components/projects/ProjectSearch";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { SubscriptionLimitDialog } from "@/components/subscription/SubscriptionLimitDialog";

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [editors, setEditors] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [parentProjectId, setParentProjectId] = useState<string | null>(null);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const { canAddProject, hasActiveSubscription, refreshLimits, projectCount } = useSubscriptionLimits();

  useEffect(() => {
    // Load all data in parallel for faster loading
    loadAllData();
  }, []);

  // Optimized: Load all data in parallel
  const loadAllData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Run all three loads in parallel - they handle their own queries
      await Promise.all([
        loadProjects(session),
        loadEditors(session),
        loadClients(session)
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (session?: any) => {
    try {
      // Use passed session or get new one
      if (!session) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (!session) {
          navigate("/auth");
          return;
        }
      }

      const userId = session.user.id;

      // Get current user's email for matching in editors/clients tables
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();

      const userEmail = currentProfile?.email?.toLowerCase() || "";

      // Run all queries in parallel for faster loading
      const [
        myProjectsResult,
        editorsByUserIdResult,
        editorsByEmailResult,
        clientsByUserIdResult,
        clientsByEmailResult,
        sharedProjectsResult
      ] = await Promise.all([
        // 1. Get projects I created
        supabase.from('projects').select('*').eq('created_by', userId).order('created_at', { ascending: false }),
        // 2. Get editor entries where I am the editor (by user_id)
        supabase.from('editors').select('id, user_id, email').eq('user_id', userId),
        // 3. Get editor entries where I am the editor (by email)
        userEmail ? supabase.from('editors').select('id, user_id, email').ilike('email', userEmail) : Promise.resolve({ data: [] }),
        // 4. Get client entries where I am the client (by user_id)
        supabase.from('clients').select('id, user_id, email').eq('user_id', userId),
        // 5. Get client entries where I am the client (by email)
        userEmail ? supabase.from('clients').select('id, user_id, email').ilike('email', userEmail) : Promise.resolve({ data: [] }),
        // 6. Get shared projects
        (supabase.rpc as any)('get_user_shared_projects')
      ]);

      // Process editor entries
      const allMyEditorEntries = [...(editorsByUserIdResult.data || []), ...(editorsByEmailResult.data || [])];
      const myEditorIds = [...new Set(allMyEditorEntries.map((e: any) => e.id))];

      // Process client entries
      const allMyClientEntries = [...(clientsByUserIdResult.data || []), ...(clientsByEmailResult.data || [])];
      const myClientIds = [...new Set(allMyClientEntries.map((c: any) => c.id))];

      // Run assigned projects queries in parallel
      const assignedQueries = [];
      if (myEditorIds.length > 0) {
        assignedQueries.push(
          supabase.from('projects').select('*').in('editor_id', myEditorIds).neq('created_by', userId).order('created_at', { ascending: false })
        );
      } else {
        assignedQueries.push(Promise.resolve({ data: [] }));
      }

      if (myClientIds.length > 0) {
        assignedQueries.push(
          supabase.from('projects').select('*').in('client_id', myClientIds).neq('created_by', userId).order('created_at', { ascending: false })
        );
      } else {
        assignedQueries.push(Promise.resolve({ data: [] }));
      }

      const [editorProjectsResult, clientProjectsResult] = await Promise.all(assignedQueries);

      // Combine and deduplicate all projects
      const allProjects = [...(myProjectsResult.data || [])];
      const seenIds = new Set(allProjects.map(p => p.id));

      // Add assigned projects
      for (const project of [...(editorProjectsResult.data || []), ...(clientProjectsResult.data || [])]) {
        if (!seenIds.has(project.id)) {
          allProjects.push({ ...project, isAssigned: true });
          seenIds.add(project.id);
        }
      }

      // Add shared link projects
      const sharedLinkProjects = sharedProjectsResult.data && Array.isArray(sharedProjectsResult.data) ? sharedProjectsResult.data : [];
      for (const project of sharedLinkProjects) {
        if (!seenIds.has(project.id)) {
          allProjects.push(project);
          seenIds.add(project.id);
        }
      }

      // Sort by created_at descending
      allProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setProjects(allProjects);
    } catch (error: any) {
      console.error("Error loading projects:", error);
      toast.error("Failed to load projects");
    }
  };

  const loadEditors = async (session?: any) => {
    try {
      const user = session?.user;
      if (!user) return;

      // Run initial queries in parallel
      const [profileResult, myEditorsResult, clientEntriesResult] = await Promise.all([
        supabase.from("profiles").select("email").eq("id", user.id).single(),
        supabase.from('editors').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('created_at', { ascending: false })
      ]);

      const userEmail = profileResult.data?.email?.toLowerCase() || "";

      const myClientEntries = (clientEntriesResult.data || []).filter(
        (entry: any) => {
          const isNotMyEntry = entry.created_by !== user.id;
          const emailMatch = entry.email?.toLowerCase().trim() === userEmail.toLowerCase().trim();
          const userIdMatch = entry.user_id === user.id;
          return isNotMyEntry && (emailMatch || userIdMatch);
        }
      );

      // Quick path: if no linked entries, set editors immediately
      if (myClientEntries.length === 0) {
        setEditors(myEditorsResult.data || []);
        return;
      }

      const creatorIds = myClientEntries.map((e: any) => e.created_by).filter(Boolean);
      let creatorProfiles: any[] = [];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", creatorIds);
        creatorProfiles = profiles || [];
      }

      const linkedEditors = myClientEntries.map((entry: any) => {
        const creator = creatorProfiles.find((p: any) => p.id === entry.created_by);
        return {
          id: `linked-${entry.id}`,
          user_id: creator?.id || null,
          full_name: creator?.full_name || "Unknown User",
          email: creator?.email || "",
          specialty: "Linked Editor",
          employment_type: entry.employment_type || "freelance",
          isLinked: true,
          originalEntry: entry
        };
      });

      setEditors([...(myEditorsResult.data || []), ...linkedEditors]);
    } catch (error) {
      console.error("Error loading editors:", error);
    }
  };

  const loadClients = async (session?: any) => {
    try {
      const user = session?.user;
      if (!user) return;

      // Run initial queries in parallel
      const [profileResult, myClientsResult, editorEntriesResult] = await Promise.all([
        supabase.from("profiles").select("email").eq("id", user.id).single(),
        supabase.from('clients').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
        supabase.from('editors').select('*').order('created_at', { ascending: false })
      ]);

      const userEmail = profileResult.data?.email?.toLowerCase() || "";

      const myEditorEntries = (editorEntriesResult.data || []).filter(
        (entry: any) => {
          const isNotMyEntry = entry.created_by !== user.id;
          const emailMatch = entry.email?.toLowerCase().trim() === userEmail.toLowerCase().trim();
          const userIdMatch = entry.user_id === user.id;
          return isNotMyEntry && (emailMatch || userIdMatch);
        }
      );

      // Quick path: if no linked entries, set clients immediately
      if (myEditorEntries.length === 0) {
        setClients(myClientsResult.data || []);
        return;
      }

      const creatorIds = myEditorEntries.map((e: any) => e.created_by).filter(Boolean);
      let creatorProfiles: any[] = [];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", creatorIds);
        creatorProfiles = profiles || [];
      }

      const linkedClients = myEditorEntries.map((entry: any) => {
        const creator = creatorProfiles.find((p: any) => p.id === entry.created_by);
        return {
          id: `linked-${entry.id}`,
          user_id: creator?.id || null,
          full_name: creator?.full_name || "Unknown User",
          email: creator?.email || "",
          company: "Linked Client",
          employment_type: entry.employment_type || "freelance",
          isLinked: true,
          originalEntry: entry
        };
      });

      setClients([...(myClientsResult.data || []), ...linkedClients]);
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const handleCreateProject = async (formData: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // For new projects: Real-time server-side limit check to prevent bypass via refresh
      if (!editingProject && !hasActiveSubscription) {
        const { count: currentProjectCount } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("created_by", session.user.id);

        const FREE_TIER_LIMIT = 3;
        if ((currentProjectCount || 0) >= FREE_TIER_LIMIT) {
          setLimitDialogOpen(true);
          refreshLimits(); // Sync the client state
          return;
        }
      }

      // Logic to resolve linked editor/client IDs to actual table IDs
      let processedFormData = { ...formData };

      // Handle linked editor (someone's client entry shown as my editor)
      if (formData.editor_id?.startsWith('linked-')) {
        const linkedEditor = editors.find(e => e.id === formData.editor_id);
        if (linkedEditor?.user_id) {
          const { data: existing } = await supabase.from('editors').select('id').eq('created_by', session.user.id).eq('user_id', linkedEditor.user_id).single();
          if (existing) {
            processedFormData.editor_id = existing.id;
          } else {
            const { data: newEntry } = await supabase.from('editors').insert({
              created_by: session.user.id,
              user_id: linkedEditor.user_id,
              full_name: linkedEditor.full_name,
              email: linkedEditor.email,
              employment_type: linkedEditor.employment_type || 'freelance'
            }).select().single();
            if (newEntry) processedFormData.editor_id = newEntry.id;
          }
        }
      }
      // Handle linked client (someone's editor entry shown as my client)
      if (formData.client_id?.startsWith('linked-')) {
        const linkedClient = clients.find(c => c.id === formData.client_id);
        if (linkedClient?.user_id) {
          const { data: existing } = await supabase.from('clients').select('id').eq('created_by', session.user.id).eq('user_id', linkedClient.user_id).single();
          if (existing) {
            processedFormData.client_id = existing.id;
          } else {
            const { data: newEntry } = await supabase.from('clients').insert({
              created_by: session.user.id,
              user_id: linkedClient.user_id,
              full_name: linkedClient.full_name,
              email: linkedClient.email,
              employment_type: linkedClient.employment_type || 'freelance'
            }).select().single();
            if (newEntry) processedFormData.client_id = newEntry.id;
          }
        }
      }

      if (editingProject) {
        // Remove subProjects as it's not a column in projects table
        const { subProjects, ...projectData } = processedFormData;

        // 1. Update main project
        const { error } = await supabase.from('projects').update(projectData).eq('id', editingProject.id);
        if (error) throw error;

        // 2. Handle Sub-projects Sync
        if (!processedFormData.is_subproject && !processedFormData.parent_project_id) {
          // Get existing sub-projects from DB to find deletions
          const { data: dbSubProjects } = await supabase
            .from('projects')
            .select('id')
            .eq('parent_project_id', editingProject.id);

          const existingIds = dbSubProjects?.map(p => p.id) || [];
          const submittedIds = subProjects?.map((p: any) => p.id).filter(Boolean) || [];

          // A. Delete removed sub-projects
          const toDelete = existingIds.filter(id => !submittedIds.includes(id));
          if (toDelete.length > 0) {
            await supabase.from('projects').delete().in('id', toDelete);
          }

          // B. Upsert (Update or Insert) sub-projects
          if (subProjects && subProjects.length > 0) {
            for (const subProject of subProjects) {
              const subProjectData = {
                name: subProject.name,
                description: subProject.description || null,
                editor_id: subProject.editor_id || null,
                client_id: subProject.client_id || null,
                deadline: subProject.deadline || null,
                status: 'draft',
                is_subproject: true,
                parent_project_id: editingProject.id,
                created_by: session.user.id
                // Note: we don't pass ID for insert, but we do for update if we used upsert. 
                // However, simpler is to separate by ID presence.
              };

              if (subProject.id) {
                // Update
                await supabase.from('projects').update(subProjectData).eq('id', subProject.id);
              } else if (subProject.name?.trim()) {
                // Insert
                await supabase.from('projects').insert(subProjectData);
              }
            }
          }
        }

        toast.success("Project updated successfully!");
      } else {
        // Remove subProjects as it's not a column in projects table
        const { subProjects, ...projectData } = processedFormData;

        // Auto-assign editor/client based on user's profile category
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('user_category, full_name, email')
          .eq('id', session.user.id)
          .single();

        const userCategory = userProfile?.user_category?.toLowerCase() || 'editor';

        // If user is editor and no editor_id specified, auto-assign themselves
        if (userCategory === 'editor' && !projectData.editor_id) {
          // Find existing editor record for this user
          const { data: existingEditor } = await supabase
            .from('editors')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('created_by', session.user.id)
            .maybeSingle();

          if (existingEditor) {
            projectData.editor_id = existingEditor.id;
          } else {
            // Create self-referencing editor record 
            const { data: newEditor } = await supabase
              .from('editors')
              .insert({
                full_name: userProfile?.full_name || session.user.email?.split('@')[0] || 'Editor',
                email: userProfile?.email || session.user.email,
                created_by: session.user.id,
                user_id: session.user.id,
                employment_type: 'freelance'
              })
              .select()
              .single();
            if (newEditor) {
              projectData.editor_id = newEditor.id;
            }
          }
        }

        // If user is client and no client_id specified, auto-assign themselves
        if (userCategory === 'client' && !projectData.client_id) {
          // Find existing client record for this user
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('created_by', session.user.id)
            .maybeSingle();

          if (existingClient) {
            projectData.client_id = existingClient.id;
          } else {
            // Create self-referencing client record
            const { data: newClient } = await supabase
              .from('clients')
              .insert({
                full_name: userProfile?.full_name || session.user.email?.split('@')[0] || 'Client',
                email: userProfile?.email || session.user.email,
                created_by: session.user.id,
                user_id: session.user.id
              })
              .select()
              .single();
            if (newClient) {
              projectData.client_id = newClient.id;
            }
          }
        }

        const { data: newProject, error } = await supabase.from('projects').insert({ ...projectData, created_by: session.user.id }).select().single();
        if (error) throw error;

        // Create sub-projects if any
        if (subProjects && subProjects.length > 0) {
          for (const subProject of subProjects) {
            if (subProject.name?.trim()) {
              await supabase.from('projects').insert({
                name: subProject.name,
                description: subProject.description || null,
                editor_id: subProject.editor_id || null,
                client_id: subProject.client_id || null,
                deadline: subProject.deadline || null,
                status: 'draft',
                is_subproject: true,
                parent_project_id: newProject.id,
                created_by: session.user.id
              });
            }
          }
        }

        toast.success("Project created successfully!");

        // Notifications Logic
        // Get current user's profile for notification message
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single();

        const senderName = currentProfile?.full_name || "Someone";

        // Send notification to assigned editor
        if (processedFormData.editor_id) {
          const { data: editor } = await supabase.from('editors').select('user_id').eq('id', processedFormData.editor_id).single();
          if (editor?.user_id) {
            await supabase.from('notifications').insert({
              user_id: editor.user_id,
              type: 'project_assigned',
              title: 'New Project Assignment',
              message: `${senderName} has assigned you to project "${processedFormData.name}".`,
              priority: 'important',
              link: `/projects/${newProject.id}`,
              metadata: { project_id: newProject.id, assigned_by: session.user.id }
            });
          }
        }
        // Send notification to assigned client
        if (processedFormData.client_id) {
          const { data: client } = await supabase.from('clients').select('user_id').eq('id', processedFormData.client_id).single();
          if (client?.user_id) {
            await supabase.from('notifications').insert({
              user_id: client.user_id,
              type: 'project_assigned',
              title: 'New Project Created',
              message: `${senderName} has created a project "${processedFormData.name}" with you as the client.`,
              priority: 'important',
              link: `/projects/${newProject.id}`,
              metadata: { project_id: newProject.id, assigned_by: session.user.id }
            });
          }
        }
      }

      setDialogOpen(false);
      setEditingProject(null);
      setParentProjectId(null);
      loadProjects();
      refreshLimits(); // Refresh limits after create/update
    } catch (error: any) {
      toast.error("Failed to save project");
      console.error(error);
    }
  };

  const handleEdit = (project: any) => {
    setEditingProject(project);
    setParentProjectId(null);
    setDialogOpen(true);
  };

  const handleAddSubProject = (parentId: string) => {
    setParentProjectId(parentId);
    setEditingProject(null);
    setDialogOpen(true);
  };

  const handleDelete = async (projectId: string) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success("Project deleted successfully");
      refreshLimits(); // Refresh limits after delete
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingProject(null);
      setParentProjectId(null);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.project_type?.toLowerCase().includes(query) ||
        project.status.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
    }

    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [projects, searchQuery, sortConfig]);

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  // Skeleton loading component for faster perceived loading
  const LoadingSkeleton = () => (
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
                    <Video className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Projects</h1>
                </div>
              </div>
            </div>
          </header>
          <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Your Projects</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Loading your projects...</p>
            </div>
            {/* Skeleton table */}
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

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
                    <Video className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Projects</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <div className="flex-1 sm:flex-initial">
                  <ProjectSearch onSearch={setSearchQuery} />
                </div>
                <Button
                  variant="outline"
                  className="flex-shrink-0 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                  onClick={() => {
                    if (!canAddProject && !editingProject) {
                      setLimitDialogOpen(true);
                    } else {
                      setDialogOpen(true);
                    }
                  }}
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Project</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Your Projects</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage your video editing projects and track progress. Search, sort, and organize with sub-projects.
              </p>
            </div>

            <ProjectsTable
              projects={filteredAndSortedProjects}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddSubProject={handleAddSubProject}
              onProjectClick={handleProjectClick}
              sortConfig={sortConfig}
              onSort={handleSort}
            />

            <ProjectFormDialog
              open={dialogOpen}
              onOpenChange={handleDialogClose}
              editingProject={editingProject}
              onSubmit={handleCreateProject}
              editors={editors}
              clients={clients}
              parentProjectId={parentProjectId}
            />

            <SubscriptionLimitDialog
              open={limitDialogOpen}
              onOpenChange={setLimitDialogOpen}
              title="Project Limit Reached"
              description="Free tier is limited to 3 projects. Upgrade to a paid plan to create unlimited projects."
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Projects;
