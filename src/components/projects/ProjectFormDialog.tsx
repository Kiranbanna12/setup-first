import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Lock } from "lucide-react";
import { ProjectTypeCombobox } from "./ProjectTypeCombobox";

interface ProjectFormData {
  name: string;
  description: string;
  project_type: string;
  editor_id: string;
  client_id: string;
  fee: string;
  client_fee: string;
  editor_fee: string;
  agency_margin: string;
  hide_editor_from_client: boolean;
  assigned_date: string;
  deadline: string;
  raw_footage_link: string;
  status: string;
  is_subproject: boolean;
  parent_project_id: string;
}

interface SubProject {
  id?: string;
  name: string;
  description: string;
  editor_id: string;
  client_id: string;
  deadline: string;
}

interface Editor {
  id: string;
  full_name: string;
  employment_type: string;
  email?: string;
}

interface Client {
  id: string;
  full_name: string;
  company?: string;
  employment_type: string;
  email?: string;
}

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProject: any;
  onSubmit: (data: any) => void;
  editors: Editor[];
  clients: Client[];
  parentProjectId?: string | null;
}

export const ProjectFormDialog = ({
  open,
  onOpenChange,
  editingProject,
  onSubmit,
  editors,
  clients,
  parentProjectId
}: ProjectFormDialogProps) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasSubProject, setHasSubProject] = useState(false);
  const [subProjects, setSubProjects] = useState<SubProject[]>([]);
  const [invoicePaid, setInvoicePaid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: "",
    description: "",
    project_type: "",
    editor_id: "",
    client_id: "",
    fee: "",
    client_fee: "",
    editor_fee: "",
    agency_margin: "",
    hide_editor_from_client: false,
    assigned_date: new Date().toISOString().split('T')[0],
    deadline: "",
    raw_footage_link: "",
    status: "draft",
    is_subproject: false,
    parent_project_id: ""
  });

  useEffect(() => {
    loadCurrentUser();
  }, []);

  // Load sub-projects when editing a project
  useEffect(() => {
    if (editingProject && open) {
      loadSubProjects(editingProject.id);
    }
  }, [editingProject, open]);

  // Check if the project's linked invoice is paid
  const checkInvoicePaidStatus = async (invoiceId: string | null) => {
    if (!invoiceId) {
      setInvoicePaid(false);
      return;
    }

    try {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('status')
        .eq('id', invoiceId)
        .single();

      setInvoicePaid(invoice?.status === 'paid');
    } catch (error) {
      console.error("Error checking invoice status:", error);
      setInvoicePaid(false);
    }
  };

  useEffect(() => {
    if (editingProject) {
      setFormData({
        name: editingProject.name || "",
        description: editingProject.description || "",
        project_type: editingProject.project_type || "",
        editor_id: editingProject.editor_id || "",
        client_id: editingProject.client_id || "",
        fee: editingProject.fee?.toString() || "",
        client_fee: editingProject.client_fee?.toString() || "",
        editor_fee: editingProject.editor_fee?.toString() || "",
        agency_margin: editingProject.agency_margin?.toString() || "",
        hide_editor_from_client: editingProject.hide_editor_from_client || false,
        assigned_date: editingProject.assigned_date || "",
        deadline: editingProject.deadline || "",
        raw_footage_link: editingProject.raw_footage_link || "",
        status: editingProject.status || "draft",
        is_subproject: editingProject.is_subproject || false,
        parent_project_id: editingProject.parent_project_id || ""
      });

      // Check if linked invoice is paid
      checkInvoicePaidStatus(editingProject.invoice_id);
    } else {
      setFormData({
        name: "",
        description: "",
        project_type: "",
        editor_id: "",
        client_id: "",
        fee: "",
        client_fee: "",
        editor_fee: "",
        agency_margin: "",
        hide_editor_from_client: false,
        assigned_date: new Date().toISOString().split('T')[0],
        deadline: "",
        raw_footage_link: "",
        status: "draft",
        is_subproject: !!parentProjectId,
        parent_project_id: parentProjectId || ""
      });
      setHasSubProject(false);
      setSubProjects([]);
      setInvoicePaid(false);
    }
  }, [editingProject, open, parentProjectId]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadSubProjects = async (projectId: string) => {
    try {
      const { data: existingSubProjects } = await supabase
        .from('projects')
        .select('*')
        .eq('parent_project_id', projectId)
        .order('created_at', { ascending: true });

      if (existingSubProjects && existingSubProjects.length > 0) {
        setHasSubProject(true);
        setSubProjects(existingSubProjects.map((sp: any) => ({
          id: sp.id, // Keep the id for updates
          name: sp.name || "",
          description: sp.description || "",
          editor_id: sp.editor_id || "",
          client_id: sp.client_id || "",
          deadline: sp.deadline || ""
        })));
      } else {
        setHasSubProject(false);
        setSubProjects([]);
      }
    } catch (error) {
      console.error("Error loading sub-projects:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) return;

    // Validation
    if (!formData.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    // User type validation
    if (!validateUserPermissions()) {
      return;
    }

    // Sub-project validation
    if (hasSubProject && subProjects.length > 0) {
      for (let i = 0; i < subProjects.length; i++) {
        if (!subProjects[i].name.trim()) {
          toast.error(`Sub-project ${i + 1} name is required`);
          return;
        }
      }
    }

    if (formData.raw_footage_link && !isValidUrl(formData.raw_footage_link)) {
      toast.error("Please enter a valid URL for raw footage link");
      return;
    }

    if (formData.deadline && formData.assigned_date) {
      if (new Date(formData.deadline) < new Date(formData.assigned_date)) {
        toast.error("Deadline cannot be before assigned date");
        return;
      }
    }

    const selectedEditor = editors.find(e => e.id === formData.editor_id);
    const selectedClient = clients.find(c => c.id === formData.client_id);
    const isFreelance = selectedEditor?.employment_type === 'freelance' || selectedClient?.employment_type === 'freelance';

    // Include all fields that exist in the projects table
    const submitData = {
      name: formData.name,
      description: formData.description || null,
      project_type: formData.project_type || null,
      status: formData.status,
      deadline: formData.deadline || null,
      raw_footage_link: formData.raw_footage_link || null,
      assigned_date: formData.assigned_date || null,
      fee: (isFreelance && formData.fee) ? parseFloat(formData.fee) : null,
      client_fee: formData.client_fee ? parseFloat(formData.client_fee) : null,
      editor_fee: formData.editor_fee ? parseFloat(formData.editor_fee) : null,
      agency_margin: formData.agency_margin ? parseFloat(formData.agency_margin) : null,
      hide_editor_from_client: formData.hide_editor_from_client || false,
      editor_id: formData.editor_id || null,
      client_id: formData.client_id || null,
      is_subproject: !!parentProjectId || formData.is_subproject,
      parent_project_id: parentProjectId || formData.parent_project_id || null,
      // subProjects is handled separately in Projects.tsx, not stored in projects table
      subProjects: hasSubProject ? subProjects : []
    };

    try {
      setIsSubmitting(true);
      await onSubmit(submitData);
    } finally {
      // Reset after a short delay to allow UI to update
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  const validateUserPermissions = () => {
    if (!currentUser) return true; // Skip validation if user not loaded yet

    // Basic validation is handled by UI hiding, but double check here
    return true;
  };

  const addSubProject = () => {
    setSubProjects([...subProjects, {
      name: "",
      description: "",
      editor_id: "",
      client_id: "",
      deadline: ""
    }]);
  };

  const removeSubProject = (index: number) => {
    setSubProjects(subProjects.filter((_, i) => i !== index));
  };

  const updateSubProject = (index: number, field: keyof SubProject, value: string) => {
    const updated = [...subProjects];
    updated[index] = { ...updated[index], [field]: value };
    setSubProjects(updated);
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const userCategory = currentUser?.user_category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {editingProject ? "Edit Project" : parentProjectId ? "Add Sub-Project" : "Create New Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs sm:text-sm">Project Name *</Label>
              <Input
                id="name"
                placeholder="Summer Campaign 2025"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_type" className="text-xs sm:text-sm">Project Type</Label>
              <ProjectTypeCombobox
                value={formData.project_type}
                onValueChange={(value) => setFormData({ ...formData, project_type: value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs sm:text-sm">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the project..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="text-xs sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* 
              ROLE BASED VISIBILITY:
              - Agency: Sees BOTH Editor and Client selects.
              - Client: Sees ONLY Editor select (Assign an editor).
              - Editor: Sees ONLY Client select (Work for a client).
            */}

            {/* Editor Selection: Visible to Agency and Client */}
            {(userCategory === 'agency' || userCategory === 'client' || editingProject) && (
              <div className="space-y-2">
                <Label htmlFor="editor" className="text-xs sm:text-sm">Assigned Editor</Label>
                {editors.length === 0 ? (
                  <div className="p-3 border border-dashed border-warning/50 bg-warning/5 rounded-lg">
                    <p className="text-xs sm:text-sm text-warning font-medium">No editors available</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please add editors from the <span className="font-medium text-primary">Editors</span> page first.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={formData.editor_id}
                    onValueChange={(value) => setFormData({ ...formData, editor_id: value, fee: "" })}
                    disabled={userCategory === 'editor' && !editingProject}
                  >
                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Select editor" />
                    </SelectTrigger>
                    <SelectContent>
                      {editors.map((editor) => (
                        <SelectItem key={editor.id} value={editor.id} className="text-xs sm:text-sm">
                          {editor.full_name} ({editor.employment_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Client Selection: Visible to Agency and Editor */}
            {(userCategory === 'agency' || userCategory === 'editor' || editingProject) && (
              <div className="space-y-2">
                <Label htmlFor="client" className="text-xs sm:text-sm">Assigned Client</Label>
                {clients.length === 0 ? (
                  <div className="p-3 border border-dashed border-warning/50 bg-warning/5 rounded-lg">
                    <p className="text-xs sm:text-sm text-warning font-medium">No clients available</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please add clients from the <span className="font-medium text-primary">Clients</span> page first.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                    disabled={userCategory === 'client' && !editingProject}
                  >
                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id} className="text-xs sm:text-sm">
                          {client.full_name} {client.company ? `(${client.company})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          {/* Role-Based Pricing Section */}
          {((formData.editor_id && editors.find(e => e.id === formData.editor_id)?.employment_type === 'freelance') ||
            (formData.client_id && clients.find(c => c.id === formData.client_id)?.employment_type === 'freelance')) && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                <h4 className="text-sm font-semibold">Pricing Details</h4>

                {/* Warning when invoice is paid */}
                {invoicePaid && (
                  <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <Lock className="h-4 w-4 text-warning flex-shrink-0" />
                    <p className="text-sm text-warning">
                      Fee cannot be changed. This project has a paid invoice.
                    </p>
                  </div>
                )}

                {/* Agency View: Client Fee + Editor Fee + Margin */}
                {userCategory === 'agency' && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="client_fee" className="text-xs sm:text-sm">Client Fee (₹)</Label>
                        <span className="text-[10px] text-muted-foreground">Amount charged to client</span>
                      </div>
                      <Input
                        id="client_fee"
                        type="number"
                        step="0.01"
                        placeholder="Amount to charge client"
                        value={formData.client_fee}
                        onChange={(e) => {
                          const clientFee = e.target.value;
                          const editorFee = formData.editor_fee || "0";
                          const margin = (parseFloat(clientFee || "0") - parseFloat(editorFee)).toString();
                          setFormData({ ...formData, client_fee: clientFee, agency_margin: margin, fee: clientFee });
                        }}
                        className="h-9 text-xs sm:text-sm"
                        disabled={invoicePaid}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="editor_fee" className="text-xs sm:text-sm">Editor Fee (₹)</Label>
                        <span className="text-[10px] text-muted-foreground">Amount paid to editor</span>
                      </div>
                      <Input
                        id="editor_fee"
                        type="number"
                        step="0.01"
                        placeholder="Amount to pay editor"
                        value={formData.editor_fee}
                        onChange={(e) => {
                          const editorFee = e.target.value;
                          const clientFee = formData.client_fee || "0";
                          const margin = (parseFloat(clientFee) - parseFloat(editorFee || "0")).toString();
                          setFormData({ ...formData, editor_fee: editorFee, agency_margin: margin });
                        }}
                        className="h-9 text-xs sm:text-sm"
                        disabled={invoicePaid}
                      />
                    </div>

                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Agency Margin</span>
                        <span className="text-lg font-bold text-primary">₹{parseFloat(formData.agency_margin || "0").toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Calculated profit (Client Fee - Editor Fee)
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="hide-editor"
                        checked={formData.hide_editor_from_client}
                        onCheckedChange={(checked) => setFormData({ ...formData, hide_editor_from_client: checked as boolean })}
                      />
                      <Label htmlFor="hide-editor" className="text-xs sm:text-sm font-normal cursor-pointer">
                        Hide editor details from client (Editor name will not be visible to client)
                      </Label>
                    </div>
                  </>
                )}

                {/* Editor View: Editor Fee Only */}
                {userCategory === 'editor' && (
                  <div className="space-y-2">
                    <Label htmlFor="editor_fee" className="text-xs sm:text-sm">
                      Your Fee (₹) <span className="text-muted-foreground">- Your earnings from this project</span>
                    </Label>
                    <Input
                      id="editor_fee"
                      type="number"
                      step="0.01"
                      placeholder="Enter your fee"
                      value={formData.editor_fee}
                      onChange={(e) => setFormData({ ...formData, editor_fee: e.target.value, fee: e.target.value })}
                      className="h-9 text-xs sm:text-sm"
                      disabled={invoicePaid}
                    />
                  </div>
                )}

                {/* Client View: Client Fee Only */}
                {userCategory === 'client' && (
                  <div className="space-y-2">
                    <Label htmlFor="client_fee" className="text-xs sm:text-sm">
                      Project Budget (₹) <span className="text-muted-foreground">- Your investment in this project</span>
                    </Label>
                    <Input
                      id="client_fee"
                      type="number"
                      step="0.01"
                      placeholder="Enter project budget"
                      value={formData.client_fee}
                      onChange={(e) => setFormData({ ...formData, client_fee: e.target.value, fee: e.target.value })}
                      className="h-9 text-xs sm:text-sm"
                      disabled={invoicePaid}
                    />
                  </div>
                )}

                {/* Default/Fallback: Simple Fee */}
                {!userCategory && (
                  <div className="space-y-2">
                    <Label htmlFor="fee" className="text-xs sm:text-sm">Project Fee (₹)</Label>
                    <Input
                      id="fee"
                      type="number"
                      step="0.01"
                      placeholder="Enter project fee"
                      value={formData.fee}
                      onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                      className="h-9 text-xs sm:text-sm"
                      disabled={invoicePaid}
                    />
                  </div>
                )}
              </div>
            )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="assigned_date" className="text-xs sm:text-sm">Assigned Date</Label>
              <Input
                id="assigned_date"
                type="date"
                value={formData.assigned_date}
                onChange={(e) => setFormData({ ...formData, assigned_date: e.target.value })}
                className="h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline" className="text-xs sm:text-sm">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="h-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="raw_footage_link" className="text-xs sm:text-sm">Raw Footage Link</Label>
            <Input
              id="raw_footage_link"
              type="url"
              placeholder="https://drive.google.com/..."
              value={formData.raw_footage_link}
              onChange={(e) => setFormData({ ...formData, raw_footage_link: e.target.value })}
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-xs sm:text-sm">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft" className="text-xs sm:text-sm">Draft</SelectItem>
                <SelectItem value="in_review" className="text-xs sm:text-sm">In Review</SelectItem>
                <SelectItem value="approved" className="text-xs sm:text-sm">Approved</SelectItem>
                <SelectItem value="completed" className="text-xs sm:text-sm">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Project Section - Only show if not already a sub-project */}
          {!parentProjectId && (
            <div className="border-t pt-3 sm:pt-4 space-y-3 sm:space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-subproject"
                  checked={hasSubProject}
                  onCheckedChange={(checked) => {
                    setHasSubProject(checked as boolean);
                    if (!checked) {
                      setSubProjects([]);
                    }
                  }}
                />
                <Label htmlFor="has-subproject" className="text-xs sm:text-sm font-medium cursor-pointer">
                  Add Sub-Projects
                </Label>
              </div>

              {hasSubProject && (
                <div className="space-y-3 sm:space-y-4 pl-3 sm:pl-6 border-l-2 border-primary/20">
                  {subProjects.map((subProject, index) => (
                    <div key={index} className="space-y-2 sm:space-y-3 p-3 sm:p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs sm:text-sm font-semibold">Sub-Project {index + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSubProject(index)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Name *</Label>
                        <Input
                          placeholder="Sub-project name"
                          value={subProject.name}
                          onChange={(e) => updateSubProject(index, 'name', e.target.value)}
                          required={hasSubProject}
                          className="h-9 text-xs sm:text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          placeholder="Brief description"
                          value={subProject.description}
                          onChange={(e) => updateSubProject(index, 'description', e.target.value)}
                          rows={2}
                          className="text-xs sm:text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {(userCategory !== 'editor' || editingProject) && (
                          <div className="space-y-2">
                            <Label className="text-xs">Editor</Label>
                            <Select
                              value={subProject.editor_id}
                              onValueChange={(value) => updateSubProject(index, 'editor_id', value)}
                            >
                              <SelectTrigger className="h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Select editor" />
                              </SelectTrigger>
                              <SelectContent>
                                {editors.map((editor) => (
                                  <SelectItem key={editor.id} value={editor.id} className="text-xs sm:text-sm">
                                    {editor.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {(userCategory !== 'client' || editingProject) && (
                          <div className="space-y-2">
                            <Label className="text-xs">Client</Label>
                            <Select
                              value={subProject.client_id}
                              onValueChange={(value) => updateSubProject(index, 'client_id', value)}
                            >
                              <SelectTrigger className="h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client.id} value={client.id} className="text-xs sm:text-sm">
                                    {client.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Deadline</Label>
                        <Input
                          type="date"
                          value={subProject.deadline}
                          onChange={(e) => updateSubProject(index, 'deadline', e.target.value)}
                          className="h-9 text-xs sm:text-sm"
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSubProject}
                    className="w-full h-9 text-xs sm:text-sm"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Add Another Sub-Project
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-9 sm:h-10 text-xs sm:text-sm gradient-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : (editingProject ? "Update Project" : "Create Project")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
