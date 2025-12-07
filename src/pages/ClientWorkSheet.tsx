// @ts-nocheck
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, TrendingUp, CheckCircle, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

interface Project {
  id: string;
  name: string;
  project_type: string;
  fee: number;
  assigned_date: string;
  deadline: string;
  created_at: string;
  updated_at: string;
  status: string;
  is_subproject: boolean;
  parent_project_id: string | null;
}

interface Client {
  id: string;
  full_name: string;
  email: string;
  company: string;
  employment_type: string;
}

const ClientWorkSheet = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [isLinkedClient, setIsLinkedClient] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  const months = [
    { value: "0", label: "January" }, { value: "1", label: "February" },
    { value: "2", label: "March" }, { value: "3", label: "April" },
    { value: "4", label: "May" }, { value: "5", label: "June" },
    { value: "6", label: "July" }, { value: "7", label: "August" },
    { value: "8", label: "September" }, { value: "9", label: "October" },
    { value: "10", label: "November" }, { value: "11", label: "December" }
  ];

  useEffect(() => {
    if (clientId) {
      fetchClientData();
      fetchProjects();
    }
  }, [clientId]);

  useEffect(() => {
    filterProjects();
  }, [projects, selectedMonth, selectedYear]);

  const fetchClientData = async () => {
    try {
      // Check if this is a linked client (ID starts with "linked-")
      if (clientId?.startsWith('linked-')) {
        setIsLinkedClient(true);
        // Extract the editors entry ID from the linked-xxx format
        const editorsEntryId = clientId.replace('linked-', '');

        // Get the editors entry to find who created it (that's our linked client)
        const { data: editorEntry, error: editorError } = await supabase
          .from("editors")
          .select("created_by")
          .eq("id", editorsEntryId)
          .single();

        if (editorError) throw editorError;

        // Get the creator's profile (this is the linked client)
        const { data: creatorProfile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", editorEntry.created_by)
          .single();

        if (profileError) throw profileError;

        setClient({
          id: clientId, // Keep the linked ID
          full_name: creatorProfile.full_name || "Unknown User",
          email: creatorProfile.email || "",
          company: "Linked Client",
          employment_type: "freelance"
        });
      } else {
        // Regular client - fetch from clients table
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("id", clientId)
          .single();

        if (error) throw error;
        setClient(data);
      }
    } catch (error: any) {
      toast.error("Failed to fetch client data");
      console.error(error);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      // Check if this is a linked client
      if (clientId?.startsWith('linked-')) {
        // Extract the editors entry ID
        const editorsEntryId = clientId.replace('linked-', '');

        // Get the editors entry to find who created it
        const { data: editorEntry, error: editorError } = await supabase
          .from("editors")
          .select("created_by")
          .eq("id", editorsEntryId)
          .single();

        if (editorError) throw editorError;

        // For linked clients, fetch projects where:
        // 1. The project was created by the linked client (created_by = linked client's user_id)
        // 2. AND the current user is assigned as editor (editor_id = current user's editor entry)
        // OR
        // 1. The project was created by the linked client
        // 2. AND the current user is assigned as client (client_id matches)

        // First, get the current user's editor entry created by this linked client
        const { data: myEditorEntry } = await supabase
          .from("editors")
          .select("id")
          .eq("created_by", editorEntry.created_by)
          .eq("user_id", user.id)
          .single();

        // Also get the current user's client entry created by this linked client
        const { data: myClientEntry } = await supabase
          .from("clients")
          .select("id")
          .eq("created_by", editorEntry.created_by)
          .eq("user_id", user.id)
          .single();

        // Build the query for projects assigned to the current user
        let projectsData: any[] = [];

        if (myEditorEntry) {
          const { data: editorProjects, error: editorProjectsError } = await supabase
            .from("projects")
            .select("*")
            .eq("created_by", editorEntry.created_by)
            .eq("editor_id", myEditorEntry.id)
            .order("created_at", { ascending: false });

          if (!editorProjectsError && editorProjects) {
            projectsData = [...projectsData, ...editorProjects];
          }
        }

        if (myClientEntry) {
          const { data: clientProjects, error: clientProjectsError } = await supabase
            .from("projects")
            .select("*")
            .eq("created_by", editorEntry.created_by)
            .eq("client_id", myClientEntry.id)
            .order("created_at", { ascending: false });

          if (!clientProjectsError && clientProjects) {
            // Avoid duplicates
            const existingIds = new Set(projectsData.map(p => p.id));
            clientProjects.forEach(p => {
              if (!existingIds.has(p.id)) {
                projectsData.push(p);
              }
            });
          }
        }

        // Sort by created_at desc
        projectsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setProjects(projectsData);
      } else {
        // Regular client - fetch projects as before
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProjects(data || []);
      }
    } catch (error: any) {
      toast.error("Failed to fetch projects");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    if (selectedMonth === "all" && selectedYear === "all") {
      setFilteredProjects(projects);
      return;
    }

    const filtered = projects.filter((project) => {
      const projectDate = new Date(project.created_at);
      const yearMatch = selectedYear !== "all" ? projectDate.getFullYear().toString() === selectedYear : true;
      const monthMatch = selectedMonth !== "all" ? projectDate.getMonth().toString() === selectedMonth : true;
      return yearMatch && monthMatch;
    });

    setFilteredProjects(filtered);
  };

  const calculateMetrics = () => {
    const total = filteredProjects.length;
    const completed = filteredProjects.filter(p => p.status === "completed").length;
    const inProgress = filteredProjects.filter(p => p.status === "in-progress").length;

    const completedWithDates = filteredProjects.filter(p =>
      p.status === "completed" && p.assigned_date && p.updated_at
    );

    const avgCompletionTime = completedWithDates.length > 0
      ? completedWithDates.reduce((acc, p) => {
        const days = differenceInDays(new Date(p.updated_at), new Date(p.assigned_date));
        return acc + days;
      }, 0) / completedWithDates.length
      : 0;

    const totalSpent = filteredProjects.filter(p => p.status === "completed").reduce((acc, p) => acc + (p.fee || 0), 0);
    const pendingAmount = filteredProjects.filter(p => p.status !== "completed").reduce((acc, p) => acc + (p.fee || 0), 0);

    return {
      total,
      completed,
      inProgress,
      avgCompletionTime: Math.round(avgCompletionTime),
      totalSpent,
      pendingAmount
    };
  };

  const metrics = calculateMetrics();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      "in-progress": "secondary",
      draft: "outline",
      pending: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getParentProjectName = (parentId: string | null) => {
    if (!parentId) return null;
    const parent = projects.find(p => p.id === parentId);
    return parent?.name;
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1">
          <header className="sticky top-0 z-10 border-b bg-card/95 dark:bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 dark:supports-[backdrop-filter]:bg-card/80">
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
              <SidebarTrigger />
              <Button variant="ghost" size="icon" onClick={() => navigate("/clients")} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold truncate">Client Work Sheet</h1>
                {client && (
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground text-xs sm:text-sm truncate">{client.full_name}</p>
                    {client.company && <p className="text-xs text-muted-foreground truncate">{client.company}</p>}
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
            {/* Filters */}
            <Card className="shadow-elegant">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  Filter by Date
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => { setSelectedMonth("all"); setSelectedYear("all"); }} className="h-9 text-xs sm:text-sm">
                  Clear Filters
                </Button>
              </CardContent>
            </Card>

            {/* Metrics Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Projects</CardTitle>
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold">{metrics.total}</div>
                  <p className="text-xs text-muted-foreground truncate">
                    {metrics.inProgress} in progress
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Completed</CardTitle>
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold">{metrics.completed}</div>
                  <p className="text-xs text-muted-foreground truncate">
                    {metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}% rate
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Spent</CardTitle>
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold">₹{metrics.totalSpent.toLocaleString('en-IN')}</div>
                  <p className="text-xs text-muted-foreground truncate">
                    Completed projects
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold">₹{metrics.pendingAmount.toLocaleString('en-IN')}</div>
                  <p className="text-xs text-muted-foreground truncate">
                    Ongoing projects
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Projects Table */}
            <Card className="shadow-elegant">
              <CardHeader className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                <CardTitle className="text-sm sm:text-base lg:text-lg">Projects List</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 lg:px-6 pb-4">
                {loading ? (
                  <div className="flex justify-center py-8 text-xs sm:text-sm">Loading...</div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                      {filteredProjects.map((project) => {
                        const parentName = getParentProjectName(project.parent_project_id);
                        const displayName = parentName ? `${parentName}: ${project.name}` : project.name;
                        const daysActive = project.assigned_date
                          ? differenceInDays(
                            project.status === "completed" ? new Date(project.updated_at) : new Date(),
                            new Date(project.assigned_date)
                          )
                          : null;

                        return (
                          <Card key={project.id} className="border">
                            <CardContent className="p-3 space-y-2">
                              <div className="font-medium text-sm truncate">{displayName}</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Type:</span>
                                  <div className="font-medium truncate">{project.project_type || "N/A"}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Status:</span>
                                  <div className="mt-1">{getStatusBadge(project.status)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Assigned:</span>
                                  <div className="font-medium truncate">
                                    {project.assigned_date ? format(new Date(project.assigned_date), "PP") : "N/A"}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Deadline:</span>
                                  <div className="font-medium truncate">
                                    {project.deadline ? format(new Date(project.deadline), "PP") : "N/A"}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Fee:</span>
                                  <div className="font-medium truncate">₹{project.fee?.toLocaleString('en-IN') || 0}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Days Active:</span>
                                  <div className="font-medium">{daysActive !== null ? `${daysActive} days` : "-"}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {filteredProjects.length === 0 && (
                        <div className="text-center text-muted-foreground py-8 text-xs sm:text-sm">
                          No projects found
                        </div>
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Project Name</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Assigned</TableHead>
                            <TableHead className="text-xs">Deadline</TableHead>
                            <TableHead className="text-xs">Fee</TableHead>
                            <TableHead className="text-xs">Days</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProjects.map((project) => {
                            const parentName = getParentProjectName(project.parent_project_id);
                            const displayName = parentName ? `${parentName}: ${project.name}` : project.name;
                            const daysActive = project.assigned_date
                              ? differenceInDays(
                                project.status === "completed" ? new Date(project.updated_at) : new Date(),
                                new Date(project.assigned_date)
                              )
                              : null;

                            return (
                              <TableRow key={project.id}>
                                <TableCell className="font-medium text-xs sm:text-sm">{displayName}</TableCell>
                                <TableCell className="text-xs sm:text-sm">{project.project_type || "N/A"}</TableCell>
                                <TableCell>{getStatusBadge(project.status)}</TableCell>
                                <TableCell className="text-xs sm:text-sm">
                                  {project.assigned_date ? format(new Date(project.assigned_date), "PP") : "N/A"}
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm">
                                  {project.deadline ? format(new Date(project.deadline), "PP") : "N/A"}
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm">₹{project.fee?.toLocaleString('en-IN') || 0}</TableCell>
                                <TableCell className="text-xs sm:text-sm">{daysActive !== null ? `${daysActive} days` : "-"}</TableCell>
                              </TableRow>
                            );
                          })}
                          {filteredProjects.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-xs sm:text-sm">
                                No projects found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default ClientWorkSheet;
