import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { GoogleGenerativeAI, SchemaType } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to format seconds as M:SS
function formatTimestamp(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return 'General';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface FunctionArgs {
  name?: string;
  description?: string;
  client_id?: string;
  deadline?: string;
  full_name?: string;
  email?: string;
  company?: string;
  specialty?: string;
  employment_type?: string;
  monthly_salary?: number;
  project_id?: string;
  version_number?: number;
  preview_url?: string;
  notes?: string;
  content?: string;
  comment_text?: string;
  version_id?: string;
  timestamp_seconds?: number;
  editor_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase configuration");
      throw new Error('Internal Server Configuration Error');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify User Authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      console.error("Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthorized: No token provided' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse Request Body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, conversationId, messages } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch active AI provider config (Google Gemini)
    let modelToUse = 'gemini-1.5-flash';
    let apiKey = Deno.env.get('GOOGLE_API_KEY');

    try {
      const { data: aiConfig, error: aiError } = await supabase
        .from('ai_provider_configs')
        .select('*')
        .eq('is_active', true)
        .eq('is_default', true)
        .eq('provider', 'google')
        .maybeSingle();

      if (!aiError && aiConfig) {
        if (aiConfig.model) modelToUse = aiConfig.model;
        if (aiConfig.api_key) apiKey = aiConfig.api_key;
      }
    } catch (err) {
      console.warn('AI Config Fetch Failed:', err);
    }

    if (!apiKey) {
      console.error("Missing Google API Key");
      throw new Error('Missing Google API Key. Please configure it in Admin Panel.');
    }

    console.log(`Using AI model: ${modelToUse}`);

    // Fetch User Profile Data
    let profileData: any = { full_name: '', email: user.email, user_category: 'editor', subscription_tier: 'basic' };

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && profile) {
        profileData = profile;
      }
    } catch (err) {
      console.warn('Profile fetch failed:', err);
    }

    // Determine User Role & Permissions
    const userCategory = profileData.user_category?.toLowerCase() || 'editor';
    const subTier = profileData.subscription_tier?.toLowerCase() || 'basic';

    const isClient = userCategory === 'client';
    const isAgency = subTier === 'agency' || subTier === 'premium';
    const isEditor = !isClient;

    // Fetch Context Data based on Role
    let projectsData: any[] = [];
    let editorsData: any[] = [];
    let clientsData: any[] = [];
    let paymentsData: any[] = [];
    let versionsData: any[] = [];
    let feedbackData: any[] = [];

    try {
      // Fetch projects first
      const projectsResult = await supabase.from('projects').select('*').eq('created_by', user.id).limit(50);
      projectsData = projectsResult.data || [];

      const paymentsResult = await supabase.from('payments').select('*').eq('user_id', user.id).limit(20);
      paymentsData = paymentsResult.data || [];

      if (isAgency || isClient) {
        const editorsResult = await supabase.from('editors').select('*').eq('created_by', user.id).limit(50);
        editorsData = editorsResult.data || [];
      }

      if (isAgency || isEditor) {
        const clientsResult = await supabase.from('clients').select('*').eq('created_by', user.id).limit(50);
        clientsData = clientsResult.data || [];
      }

      // Fetch versions and feedback for user's projects
      if (projectsData.length > 0) {
        const projectIds = projectsData.map(p => p.id);
        const versionsResult = await supabase.from('video_versions').select('*').in('project_id', projectIds);
        versionsData = versionsResult.data || [];

        // Fetch feedback from video_feedback table using version IDs
        if (versionsData.length > 0) {
          const versionIds = versionsData.map(v => v.id);
          const feedbackResult = await supabase.from('video_feedback').select('*').in('version_id', versionIds);
          feedbackData = feedbackResult.data || [];
        }
      }

    } catch (dbError) {
      console.error('Database context fetch error:', dbError);
    }

    // Build rich context for AI
    const contextContext = `
User Context:
- Name: ${profileData.full_name || 'Unknown'}
- Email: ${profileData.email || user.email || 'Unknown'}
- Role: ${userCategory}
- Plan: ${subTier}

Projects (${projectsData.length}):
${projectsData.map(p => `- ${p.name} (ID: ${p.id}, Status: ${p.status})`).join('\n')}

Video Versions (${versionsData.length}):
${versionsData.map(v => `- Project ${v.project_id}: v${v.version_number} (ID: ${v.id}, Preview: ${v.preview_url})`).join('\n')}

Feedback (${feedbackData.length}):
${feedbackData.map(f => `- Version ${f.version_id}: "${f.comment_text?.slice(0, 50)}..." (Timestamp: ${formatTimestamp(f.timestamp_seconds)})`).join('\n')}

${(isAgency || isClient) ? `Editors (${editorsData.length}):\n${editorsData.map(e => `- ${e.full_name} (ID: ${e.id}, ${e.specialty || 'General'}, ${e.email})`).join('\n')}` : ''}

${(isAgency || isEditor) ? `Clients (${clientsData.length}):\n${clientsData.map(c => `- ${c.full_name} (ID: ${c.id}, ${c.company || 'No Company'}, ${c.email})`).join('\n')}` : ''}
`;

    const systemPrompt = `You are XrozenAI, an expert AI assistant for the Xrozen Workflow platform.
You help users manage video editing projects, track editors and clients, handle payments, and provide insights.

IMPORTANT DATA ISOLATION RULES:
- Only show data that belongs to the current user (created_by = user.id)
- Never reveal data from other users
- Respect the user's role and subscription tier

CAPABILITIES:
1. Create and manage projects (read/write)
2. Add and manage clients (read/write) - if user is Agency or Editor
3. Add and manage editors (read/write) - if user is Agency or Client
4. Add and view feedback on projects/versions (read/write)
5. View all video versions for projects (read)
6. Get preview links for specific versions
7. View editor/client worksheets data

When user asks for a link:
- For version preview: provide the preview_url from video_versions
- Always provide the full URL

${contextContext}

Answer questions based on the user's actual data shown above.
If you take an action (like creating a project), confirm the details clearly.
Always be helpful, concise, and professional in Hindi or English based on user's language.`;

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelToUse });

    // Define tools with proper Gemini schema types
    const definedTools: any[] = [
      {
        name: "create_project",
        description: "Create a new video editing project",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING, description: "Project name" },
            description: { type: SchemaType.STRING, description: "Project description" },
            client_id: { type: SchemaType.STRING, description: "Client UUID (optional)" },
            deadline: { type: SchemaType.STRING, description: "Deadline in YYYY-MM-DD format (optional)" }
          },
          required: ["name"]
        }
      },
      {
        name: "list_projects",
        description: "List all user's projects with their current status, IDs, and links",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      },
      {
        name: "get_project_details",
        description: "Get complete details of a specific project including all versions, feedback, and links",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            project_id: { type: SchemaType.STRING, description: "Project ID" }
          },
          required: ["project_id"]
        }
      },
      {
        name: "get_project_link",
        description: "Get the preview or final link for a project or specific version",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            project_id: { type: SchemaType.STRING, description: "Project ID" },
            version_number: { type: SchemaType.NUMBER, description: "Specific version number (optional, omit for final link)" }
          },
          required: ["project_id"]
        }
      },
      {
        name: "list_versions",
        description: "List all video versions for a specific project with preview links",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            project_id: { type: SchemaType.STRING, description: "Project ID" }
          },
          required: ["project_id"]
        }
      },
      {
        name: "add_version",
        description: "Add a new video version to a project",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            project_id: { type: SchemaType.STRING, description: "Project ID" },
            version_number: { type: SchemaType.NUMBER, description: "Version number (e.g. 1, 2)" },
            preview_url: { type: SchemaType.STRING, description: "URL to the video file" },
            notes: { type: SchemaType.STRING, description: "Optional notes about this version" }
          },
          required: ["project_id", "version_number", "preview_url"]
        }
      },
      {
        name: "add_feedback",
        description: "Add feedback/comment to a specific video version",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            version_id: { type: SchemaType.STRING, description: "Video version ID (required)" },
            comment_text: { type: SchemaType.STRING, description: "The feedback text" },
            timestamp_seconds: { type: SchemaType.NUMBER, description: "Optional video timestamp in seconds" }
          },
          required: ["version_id", "comment_text"]
        }
      },
      {
        name: "list_feedback",
        description: "List all feedback for a project or specific version",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            project_id: { type: SchemaType.STRING, description: "Project ID" },
            version_id: { type: SchemaType.STRING, description: "Optional version ID to filter" }
          },
          required: ["project_id"]
        }
      },
      {
        name: "get_editor_worksheet",
        description: "Get editor worksheet/work summary data",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            editor_id: { type: SchemaType.STRING, description: "Editor ID (optional, shows all if omitted)" }
          }
        }
      },
      {
        name: "get_client_worksheet",
        description: "Get client worksheet/project summary data",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            client_id: { type: SchemaType.STRING, description: "Client ID (optional, shows all if omitted)" }
          }
        }
      }
    ];

    // Add role-specific tools
    if (isAgency || isEditor) {
      definedTools.push({
        name: "add_client",
        description: "Add a new client to the system",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            full_name: { type: SchemaType.STRING, description: "Client full name" },
            email: { type: SchemaType.STRING, description: "Client email" },
            company: { type: SchemaType.STRING, description: "Company name (optional)" }
          },
          required: ["full_name", "email"]
        }
      });
      definedTools.push({
        name: "list_clients",
        description: "List all clients with their details",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      });
    }

    if (isAgency || isClient) {
      definedTools.push({
        name: "add_editor",
        description: "Add a new editor to the system",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            full_name: { type: SchemaType.STRING, description: "Editor full name" },
            email: { type: SchemaType.STRING, description: "Editor email" },
            specialty: { type: SchemaType.STRING, description: "Editor specialty (optional)" },
            employment_type: { type: SchemaType.STRING, description: "Employment type: freelance or fulltime (optional)" },
            monthly_salary: { type: SchemaType.NUMBER, description: "Monthly salary (optional)" }
          },
          required: ["full_name", "email"]
        }
      });
      definedTools.push({
        name: "list_editors",
        description: "List all editors with their details",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      });
    }

    const tools = [{ functionDeclarations: definedTools }];

    // Construct history
    const history = [
      {
        role: "user",
        parts: [{ text: systemPrompt }]
      },
      {
        role: "model",
        parts: [{ text: "Understood. I am XrozenAI, ready to help you manage your projects, clients, editors, and workflow. How can I assist you today?" }]
      },
      ...(messages || []).map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    ];

    const chat = model.startChat({
      history: history,
      tools: tools,
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    let assistantMessage = response.text();

    // Handle function calls - loop to handle multiple sequential calls
    let currentResponse = response;
    let maxIterations = 10; // Safety limit to prevent infinite loops
    let iteration = 0;

    while (currentResponse.functionCalls() && currentResponse.functionCalls()!.length > 0 && iteration < maxIterations) {
      iteration++;
      const call = currentResponse.functionCalls()![0];
      const functionName = call.name;
      const functionArgs = call.args as FunctionArgs;

      console.log(`Executing tool (iteration ${iteration}): ${functionName}`, functionArgs);

      let toolResult = '';
      let actionData = null;

      try {
        switch (functionName) {
          case 'create_project': {
            // Auto-assign editor/client based on user's profile category
            let autoEditorId = functionArgs.editor_id || null;
            let autoClientId = functionArgs.client_id || null;

            // If user is an editor, auto-assign themselves as editor
            if (isEditor && !autoEditorId) {
              const { data: existingEditor } = await supabase
                .from('editors')
                .select('id')
                .eq('user_id', user.id)
                .eq('created_by', user.id)
                .maybeSingle();

              if (existingEditor) {
                autoEditorId = existingEditor.id;
              } else {
                const { data: newEditorRecord } = await supabase
                  .from('editors')
                  .insert({
                    full_name: profileData.full_name || user.email?.split('@')[0] || 'Editor',
                    email: profileData.email || user.email,
                    created_by: user.id,
                    user_id: user.id,
                    employment_type: 'freelance'
                  })
                  .select()
                  .single();
                if (newEditorRecord) {
                  autoEditorId = newEditorRecord.id;
                }
              }
            }

            // If user is a client, auto-assign themselves as client
            if (isClient && !autoClientId) {
              const { data: existingClient } = await supabase
                .from('clients')
                .select('id')
                .eq('user_id', user.id)
                .eq('created_by', user.id)
                .maybeSingle();

              if (existingClient) {
                autoClientId = existingClient.id;
              } else {
                const { data: newClientRecord } = await supabase
                  .from('clients')
                  .insert({
                    full_name: profileData.full_name || user.email?.split('@')[0] || 'Client',
                    email: profileData.email || user.email,
                    created_by: user.id,
                    user_id: user.id
                  })
                  .select()
                  .single();
                if (newClientRecord) {
                  autoClientId = newClientRecord.id;
                }
              }
            }

            const { data: newProject, error: projectError } = await supabase
              .from('projects')
              .insert({
                name: functionArgs.name,
                description: functionArgs.description,
                created_by: user.id,
                editor_id: autoEditorId,
                client_id: autoClientId,
                deadline: functionArgs.deadline,
                status: 'draft'
              })
              .select()
              .single();

            if (projectError) throw projectError;
            actionData = { type: 'project', id: newProject.id, name: functionArgs.name };

            const assignmentInfo = [];
            if (autoEditorId) assignmentInfo.push(`Editor: ${profileData.full_name || 'You'}`);
            if (autoClientId) assignmentInfo.push(`Client: ${profileData.full_name || 'You'}`);

            toolResult = `Successfully created project "${functionArgs.name}" with ID ${newProject.id}${assignmentInfo.length > 0 ? `. Auto-assigned: ${assignmentInfo.join(', ')}` : ''}`;
            break;
          }

          case 'add_client': {
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({
                full_name: functionArgs.full_name,
                email: functionArgs.email,
                company: functionArgs.company,
                created_by: user.id,
                user_id: null
              })
              .select()
              .single();

            if (clientError) throw clientError;
            actionData = { type: 'client', id: newClient.id, name: functionArgs.full_name };
            toolResult = `Successfully added client "${functionArgs.full_name}"`;
            break;
          }

          case 'add_editor': {
            const { data: newEditor, error: editorError } = await supabase
              .from('editors')
              .insert({
                full_name: functionArgs.full_name,
                email: functionArgs.email,
                specialty: functionArgs.specialty,
                employment_type: functionArgs.employment_type || 'freelance',
                monthly_salary: functionArgs.monthly_salary,
                created_by: user.id,
                user_id: null
              })
              .select()
              .single();

            if (editorError) throw editorError;
            actionData = { type: 'editor', id: newEditor.id, name: functionArgs.full_name };
            toolResult = `Successfully added editor "${functionArgs.full_name}"`;
            break;
          }

          case 'list_projects': {
            const { data: projects, error: listError } = await supabase
              .from('projects')
              .select('id, name, status, created_at, deadline')
              .eq('created_by', user.id)
              .order('created_at', { ascending: false });

            if (listError) throw listError;
            toolResult = projects && projects.length > 0
              ? `Your projects:\n${projects.map((p: any) => `- ${p.name} (ID: ${p.id}, Status: ${p.status}, Deadline: ${p.deadline || 'Not set'})`).join('\n')}`
              : 'You have no projects currently.';
            break;
          }

          case 'list_clients': {
            const { data: clients, error: listError } = await supabase
              .from('clients')
              .select('*')
              .eq('created_by', user.id)
              .order('created_at', { ascending: false });

            if (listError) throw listError;
            toolResult = clients && clients.length > 0
              ? `Your clients:\n${clients.map((c: any) => `- ${c.full_name} (ID: ${c.id}, Email: ${c.email}, Company: ${c.company || 'N/A'})`).join('\n')}`
              : 'You have no clients currently.';
            break;
          }

          case 'list_editors': {
            const { data: editors, error: listError } = await supabase
              .from('editors')
              .select('*')
              .eq('created_by', user.id)
              .order('created_at', { ascending: false });

            if (listError) throw listError;
            toolResult = editors && editors.length > 0
              ? `Your editors:\n${editors.map((e: any) => `- ${e.full_name} (ID: ${e.id}, Email: ${e.email}, Specialty: ${e.specialty || 'General'})`).join('\n')}`
              : 'You have no editors currently.';
            break;
          }

          case 'get_project_details': {
            const { data: project, error: projError } = await supabase
              .from('projects')
              .select('*')
              .eq('id', functionArgs.project_id)
              .eq('created_by', user.id)
              .maybeSingle();

            if (projError) throw projError;
            if (!project) {
              toolResult = 'Project not found or you do not have access to it.';
              break;
            }

            const { data: versions } = await supabase
              .from('video_versions')
              .select('*')
              .eq('project_id', functionArgs.project_id)
              .order('version_number', { ascending: false });

            const versionIds = (versions || []).map((v: any) => v.id);
            let allFeedback: any[] = [];
            if (versionIds.length > 0) {
              const { data: feedback } = await supabase
                .from('video_feedback')
                .select('*')
                .in('version_id', versionIds)
                .order('created_at', { ascending: false });
              allFeedback = feedback || [];
            }

            const feedbackWithNames = await Promise.all(allFeedback.map(async (f: any) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', f.user_id)
                .maybeSingle();
              return { ...f, userName: profile?.full_name || 'Unknown' };
            }));

            toolResult = `
Project: ${project.name}
ID: ${project.id}
Status: ${project.status}
Description: ${project.description || 'N/A'}
Deadline: ${project.deadline || 'Not set'}

Versions (${versions?.length || 0}):
${versions?.map((v: any) => `- v${v.version_number}: ${v.preview_url} (ID: ${v.id})`).join('\n') || 'No versions'}

Feedback (${feedbackWithNames?.length || 0}):
${feedbackWithNames?.map((f: any) => `- [${formatTimestamp(f.timestamp_seconds)}] "${f.comment_text}" by ${f.userName}`).join('\n') || 'No feedback'}
`;
            break;
          }

          case 'get_project_link': {
            const { data: project, error: projError } = await supabase
              .from('projects')
              .select('id, name')
              .eq('id', functionArgs.project_id)
              .eq('created_by', user.id)
              .maybeSingle();

            if (projError) throw projError;
            if (!project) {
              toolResult = 'Project not found or you do not have access to it.';
              break;
            }

            if (functionArgs.version_number) {
              const { data: version } = await supabase
                .from('video_versions')
                .select('*')
                .eq('project_id', functionArgs.project_id)
                .eq('version_number', functionArgs.version_number)
                .maybeSingle();

              if (version) {
                toolResult = `Preview link for ${project.name} v${functionArgs.version_number}: ${version.preview_url}`;
              } else {
                toolResult = `Version ${functionArgs.version_number} not found for this project.`;
              }
            } else {
              const { data: latestVersion } = await supabase
                .from('video_versions')
                .select('version_number, preview_url')
                .eq('project_id', functionArgs.project_id)
                .order('version_number', { ascending: false })
                .limit(1)
                .maybeSingle();

              toolResult = latestVersion?.preview_url
                ? `Latest preview link for ${project.name} (v${latestVersion.version_number}): ${latestVersion.preview_url}`
                : `No versions found for ${project.name}. Add a version first to get a preview link.`;
            }
            break;
          }

          case 'list_versions': {
            const { data: project } = await supabase
              .from('projects')
              .select('id, name')
              .eq('id', functionArgs.project_id)
              .eq('created_by', user.id)
              .maybeSingle();

            if (!project) {
              toolResult = 'Project not found or you do not have access to it.';
              break;
            }

            const { data: versions, error: versionsError } = await supabase
              .from('video_versions')
              .select('*')
              .eq('project_id', functionArgs.project_id)
              .order('version_number', { ascending: false });

            if (versionsError) throw versionsError;
            toolResult = versions && versions.length > 0
              ? `Versions for "${project.name}":\n${versions.map((v: any) => `- v${v.version_number}: ${v.preview_url} (ID: ${v.id}, Notes: ${v.notes || 'None'})`).join('\n')}`
              : 'No versions found for this project.';
            break;
          }

          case 'add_version': {
            const { data: project } = await supabase
              .from('projects')
              .select('id')
              .eq('id', functionArgs.project_id)
              .eq('created_by', user.id)
              .maybeSingle();

            if (!project) {
              toolResult = 'Project not found or you do not have access to it.';
              break;
            }

            const { data: newVersion, error: addVerError } = await supabase
              .from('video_versions')
              .insert({
                project_id: functionArgs.project_id,
                version_number: functionArgs.version_number,
                preview_url: functionArgs.preview_url,
                notes: functionArgs.notes
              })
              .select()
              .single();

            if (addVerError) throw addVerError;
            toolResult = `Successfully added version ${newVersion.version_number} (ID: ${newVersion.id}, Preview: ${newVersion.preview_url})`;
            break;
          }

          case 'add_feedback': {
            const { data: version } = await supabase
              .from('video_versions')
              .select('id, project_id')
              .eq('id', functionArgs.version_id)
              .maybeSingle();

            if (!version) {
              toolResult = 'Video version not found.';
              break;
            }

            const { data: project } = await supabase
              .from('projects')
              .select('id')
              .eq('id', version.project_id)
              .eq('created_by', user.id)
              .maybeSingle();

            if (!project) {
              toolResult = 'Project not found or you do not have access to it.';
              break;
            }

            const { data: newFeedback, error: feedError } = await supabase
              .from('video_feedback')
              .insert({
                version_id: functionArgs.version_id,
                project_id: version.project_id,
                comment_text: functionArgs.comment_text,
                timestamp_seconds: functionArgs.timestamp_seconds,
                user_id: user.id,
                user_name: profileData.full_name || user.email?.split('@')[0] || 'User',
                user_email: profileData.email || user.email
              })
              .select()
              .single();

            if (feedError) throw feedError;
            toolResult = `Feedback added successfully (ID: ${newFeedback.id})`;
            break;
          }

          case 'list_feedback': {
            const { data: project } = await supabase
              .from('projects')
              .select('id, name')
              .eq('id', functionArgs.project_id)
              .eq('created_by', user.id)
              .maybeSingle();

            if (!project) {
              toolResult = 'Project not found or you do not have access to it.';
              break;
            }

            const { data: versions } = await supabase
              .from('video_versions')
              .select('id, version_number')
              .eq('project_id', functionArgs.project_id);

            let allFeedback: any[] = [];
            if (functionArgs.version_id) {
              const { data: feedback, error: listFeedError } = await supabase
                .from('video_feedback')
                .select('*')
                .eq('version_id', functionArgs.version_id)
                .order('created_at', { ascending: false });
              if (listFeedError) throw listFeedError;
              allFeedback = feedback || [];
            } else if (versions && versions.length > 0) {
              const versionIds = versions.map((v: any) => v.id);
              const { data: feedback, error: listFeedError } = await supabase
                .from('video_feedback')
                .select('*')
                .in('version_id', versionIds)
                .order('created_at', { ascending: false });
              if (listFeedError) throw listFeedError;
              allFeedback = feedback || [];
            }

            const feedbackWithNames = await Promise.all(allFeedback.map(async (f: any) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', f.user_id)
                .maybeSingle();
              const ver = versions?.find((v: any) => v.id === f.version_id);
              return { ...f, userName: profile?.full_name || 'Unknown', versionNumber: ver?.version_number || '?' };
            }));

            toolResult = feedbackWithNames && feedbackWithNames.length > 0
              ? `Feedback for "${project.name}":\n${feedbackWithNames.map((f: any) => `- [v${f.versionNumber} @ ${formatTimestamp(f.timestamp_seconds)}] "${f.comment_text}" by ${f.userName}`).join('\n')}`
              : 'No feedback found.';
            break;
          }

          case 'get_editor_worksheet': {
            let query = supabase
              .from('editors')
              .select('*')
              .eq('created_by', user.id);

            if (functionArgs.editor_id) {
              query = query.eq('id', functionArgs.editor_id);
            }

            const { data: editors, error } = await query;
            if (error) throw error;

            if (!editors || editors.length === 0) {
              toolResult = 'No editors found.';
              break;
            }

            const editorWorksheet = await Promise.all(editors.map(async (editor: any) => {
              const { data: projects } = await supabase
                .from('projects')
                .select('id, name, status')
                .eq('editor_id', editor.id);

              return {
                editor,
                projects: projects || []
              };
            }));

            toolResult = `Editor Worksheet:\n${editorWorksheet.map(ew => `
${ew.editor.full_name} (${ew.editor.email})
- Specialty: ${ew.editor.specialty || 'General'}
- Employment: ${ew.editor.employment_type || 'N/A'}
- Salary: ${ew.editor.monthly_salary || 'N/A'}
- Projects: ${ew.projects.length > 0 ? ew.projects.map((p: any) => `${p.name} (${p.status})`).join(', ') : 'None'}
`).join('\n')}`;
            break;
          }

          case 'get_client_worksheet': {
            let query = supabase
              .from('clients')
              .select('*')
              .eq('created_by', user.id);

            if (functionArgs.client_id) {
              query = query.eq('id', functionArgs.client_id);
            }

            const { data: clients, error } = await query;
            if (error) throw error;

            if (!clients || clients.length === 0) {
              toolResult = 'No clients found.';
              break;
            }

            const clientWorksheet = await Promise.all(clients.map(async (client: any) => {
              const { data: projects } = await supabase
                .from('projects')
                .select('id, name, status, deadline')
                .eq('client_id', client.id);

              return {
                client,
                projects: projects || []
              };
            }));

            toolResult = `Client Worksheet:\n${clientWorksheet.map(cw => `
${cw.client.full_name} (${cw.client.email})
- Company: ${cw.client.company || 'N/A'}
- Projects: ${cw.projects.length > 0 ? cw.projects.map((p: any) => `${p.name} (${p.status})`).join(', ') : 'None'}
`).join('\n')}`;
            break;
          }

          default:
            toolResult = 'Unknown function called.';
        }
      } catch (err: any) {
        console.error(`Error in tool ${functionName}:`, err);
        toolResult = `Error executing action: ${err.message}`;
      }

      // Send the tool result back to the model and get next response
      const nextResult = await chat.sendMessage([
        {
          functionResponse: {
            name: functionName,
            response: { result: toolResult }
          }
        }
      ]);

      currentResponse = nextResult.response;
      assistantMessage = currentResponse.text();
    }

    // Save conversation
    let convId = conversationId;
    if (!convId) {
      const { data: newConv } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id, title: message.slice(0, 50) })
        .select()
        .single();
      convId = newConv?.id;
    }

    if (convId) {
      await supabase.from('ai_messages').insert([
        { conversation_id: convId, role: 'user', content: message },
        { conversation_id: convId, role: 'assistant', content: assistantMessage }
      ]);
    }

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        conversationId: convId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Final global error handler:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
