import { useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Edit, Trash2, Plus, ChevronDown, ChevronRight, Share2, MessageSquare, Calendar, DollarSign, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ShareButton } from "@/components/project-share/ShareButton";
import { Card, CardContent } from "@/components/ui/card";

interface Project {
  id: string;
  name: string;
  description?: string;
  project_type?: string;
  status: string;
  fee?: number;
  assigned_date?: string;
  deadline?: string;
  created_at: string;
  is_subproject?: boolean;
  parent_project_id?: string;
  //   is_shared?: boolean; // Added loosely typed checks in old code
}

interface ProjectsTableProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onAddSubProject: (parentId: string) => void;
  onProjectClick: (projectId: string, project?: any) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
}

export const ProjectsTable = ({
  projects,
  onEdit,
  onDelete,
  onAddSubProject,
  onProjectClick,
  sortConfig,
  onSort
}: ProjectsTableProps) => {
  const navigate = useNavigate();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleExpand = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "secondary", label: "Draft" },
      in_review: { variant: "default", label: "In Review" },
      approved: { variant: "default", label: "Approved", className: "bg-primary hover:bg-primary/90 text-white" },
      completed: { variant: "default", label: "Completed", className: "bg-primary hover:bg-primary/90 text-white" }
    };

    const config = variants[status] || variants.draft;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const mainProjects = projects.filter(p => !p.is_subproject);

  // Mobile card layout for projects
  const renderProjectCard = (project: Project, isSubProject = false) => {
    const subProjects = projects.filter(p => p.parent_project_id === project.id);
    const hasSubProjects = subProjects.length > 0;
    const isExpanded = expandedProjects.has(project.id);

    return (
      <div key={project.id} className={isSubProject ? "ml-4" : ""}>
        <Card
          className={`mb-3 cursor-pointer hover:shadow-md transition-all ${isSubProject ? "bg-muted/30" : ""}`}
          onClick={() => {
            if (isSubProject) return;
            // Navigate to shared view for shared link projects
            if ((project as any).isSharedLink && (project as any).shareToken) {
              navigate(`/shared/${(project as any).shareToken}`);
            } else {
              onProjectClick(project.id, project);
            }
          }}
        >
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {!isSubProject && hasSubProjects && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(project.id);
                      }}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm break-words">{project.name}</h3>
                      {(project as any).isSharedLink && (
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 flex-shrink-0">
                          <Share2 className="w-3 h-3 mr-1" />
                          Shared
                        </Badge>
                      )}
                    </div>
                    {project.project_type && (
                      <p className="text-xs text-muted-foreground mt-1">{project.project_type}</p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(project.status)}
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {project.fee && !(project as any).isSharedLink && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>₹{project.fee.toLocaleString()}</span>
                  </div>
                )}
                {project.deadline && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(project.deadline).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div
                className="flex items-center justify-end gap-1 pt-2 border-t"
                onClick={(e) => e.stopPropagation()}
              >
                {!isSubProject && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => navigate(`/projects/${project.id}/notes`)}
                      title="Notes"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => navigate(`/chat?project=${project.id}`)}
                      title="Chat"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    {/* ShareButton omitted to avoid missing dependency, can add back if component exists */}
                    <ShareButton
                      projectId={project.id}
                      projectName={project.name}
                      variant="ghost"
                      size="sm"
                      showLabel={false}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => onAddSubProject(project.id)}
                      title="Add Sub-project"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {!(project as any).isSharedLink && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => onEdit(project)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive h-8 px-2">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{project.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(project.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sub-projects */}
        {!isSubProject && isExpanded && hasSubProjects && (
          <div className="ml-4 mb-3">
            {subProjects.map(subProject => renderProjectCard(subProject, true))}
          </div>
        )}
      </div>
    );
  };

  const renderProjectRow = (project: Project, isSubProject = false) => {
    const subProjects = projects.filter(p => p.parent_project_id === project.id);
    const hasSubProjects = subProjects.length > 0;
    const isExpanded = expandedProjects.has(project.id);

    return (
      <Fragment key={project.id}>
        <TableRow
          className={isSubProject ? "bg-muted/30" : "hover:bg-muted/50 cursor-pointer"}
          onClick={() => {
            if (isSubProject) return;
            // Navigate to shared view for shared link projects
            if ((project as any).isSharedLink && (project as any).shareToken) {
              navigate(`/shared/${(project as any).shareToken}`);
            } else {
              onProjectClick(project.id, project);
            }
          }}
        >
          <TableCell onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              {!isSubProject && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleExpand(project.id)}
                  disabled={!hasSubProjects}
                >
                  {hasSubProjects && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                </Button>
              )}
              <span className={isSubProject ? "ml-8 text-xs sm:text-sm" : "font-medium text-xs sm:text-sm"}>
                {project.name}
              </span>
              {(project as any).isSharedLink && (
                <Badge variant="outline" className="ml-2 text-xs bg-primary/10 text-primary border-primary/30">
                  <Share2 className="w-3 h-3 mr-1" />
                  Shared
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell className="hidden md:table-cell text-xs sm:text-sm">{project.project_type || "—"}</TableCell>
          <TableCell className="text-xs sm:text-sm">{getStatusBadge(project.status)}</TableCell>
          <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
            {(project as any).isSharedLink ? "—" : (project.fee ? `₹${project.fee.toLocaleString()}` : "—")}
          </TableCell>
          <TableCell className="hidden xl:table-cell text-xs sm:text-sm">
            {project.assigned_date ? new Date(project.assigned_date).toLocaleDateString() : "—"}
          </TableCell>
          <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
            {project.deadline ? new Date(project.deadline).toLocaleDateString() : "—"}
          </TableCell>
          <TableCell onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 sm:gap-2">
              {!isSubProject && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => navigate(`/projects/${project.id}/notes`)}
                    title="Project Notes"
                  >
                    <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => navigate(`/chat?project=${project.id}`)}
                    title="Project Chat"
                  >
                    <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  {/* ShareButton commented out */}
                  <ShareButton
                    projectId={project.id}
                    projectName={project.name}
                    variant="ghost"
                    size="sm"
                    showLabel={false}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => onAddSubProject(project.id)}
                    title="Add Sub-project"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </>
              )}
              {!(project as any).isSharedLink && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => onEdit(project)}
                  >
                    <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 sm:h-8 sm:w-8 p-0">
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{project.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(project.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && subProjects.map(subProject => (
          <Fragment key={subProject.id}>
            {renderProjectRow(subProject, true)}
          </Fragment>
        ))}
      </Fragment>
    );
  };

  return (
    <>
      {/* Mobile Card Layout (below md breakpoint) */}
      <div className="md:hidden space-y-3">
        {/* Mobile Sort Controls */}
        <div className="flex gap-2 pb-3 border-b overflow-x-auto scrollbar-hide">
          <Button
            variant="outline"
            size="sm"
            className={`text-xs whitespace-nowrap flex-shrink-0 h-8 ${sortConfig?.key === 'name' ? 'bg-primary/10 border-primary/30' : ''}`}
            onClick={() => onSort('name')}
          >
            Name {sortConfig?.key === 'name' && getSortIcon('name')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`text-xs whitespace-nowrap flex-shrink-0 h-8 ${sortConfig?.key === 'status' ? 'bg-primary/10 border-primary/30' : ''}`}
            onClick={() => onSort('status')}
          >
            Status {sortConfig?.key === 'status' && getSortIcon('status')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`text-xs whitespace-nowrap flex-shrink-0 h-8 ${sortConfig?.key === 'deadline' ? 'bg-primary/10 border-primary/30' : ''}`}
            onClick={() => onSort('deadline')}
          >
            Deadline {sortConfig?.key === 'deadline' && getSortIcon('deadline')}
          </Button>
        </div>

        {/* Projects Cards */}
        {mainProjects.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-xs text-muted-foreground">
              No projects found. Create your first project to get started.
            </CardContent>
          </Card>
        ) : (
          mainProjects.map(project => renderProjectCard(project))
        )}
      </div>

      {/* Desktop Table Layout (md and above) */}
      <div className="hidden md:block rounded-lg border bg-card shadow-elegant overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm"
                  onClick={() => onSort('name')}
                >
                  Project Name {getSortIcon('name')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm"
                  onClick={() => onSort('project_type')}
                >
                  Type {getSortIcon('project_type')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm"
                  onClick={() => onSort('status')}
                >
                  Status {getSortIcon('status')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm hidden lg:table-cell"
                  onClick={() => onSort('fee')}
                >
                  Fee {getSortIcon('fee')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm hidden xl:table-cell"
                  onClick={() => onSort('assigned_date')}
                >
                  Assigned {getSortIcon('assigned_date')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm hidden lg:table-cell"
                  onClick={() => onSort('deadline')}
                >
                  Deadline {getSortIcon('deadline')}
                </TableHead>
                <TableHead className="text-xs sm:text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mainProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">
                    No projects found. Create your first project to get started.
                  </TableCell>
                </TableRow>
              ) : (
                mainProjects.map(project => (
                  <Fragment key={project.id}>
                    {renderProjectRow(project)}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
};
