// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Users, DollarSign, FileText, BarChart3, LogOut, Settings, MessageSquare, Database } from "lucide-react";
import { toast } from "sonner";
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Profile {
  id: string;
  full_name: string;
  email: string;
  user_category: string;
  subscription_tier: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Load profile directly from Supabase
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Load projects directly from Supabase
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('created_by', session.user.id);
      setProjects(projectsData || []);

      // Load payments directly from Supabase
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', session.user.id);
      setPayments(paymentsData || []);

    } catch (error: any) {
      console.error('🔧 Dashboard: Error loading dashboard data:', error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to sign out");
      console.error(error);
    }
  };

  // Calculate pending projects (all projects that are not approved or completed)
  const draftProjects = projects.filter(p => p.status === 'draft');
  const inReviewProjects = projects.filter(p => p.status === 'in_review');
  const correctionsProjects = projects.filter(p => p.status === 'corrections');
  const inProgressProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'pending');

  const pendingProjects = projects.filter(p =>
    p.status === 'draft' ||
    p.status === 'in_review' ||
    p.status === 'corrections' ||
    p.status === 'pending' ||
    p.status === 'in_progress'
  ).length;

  const completedProjects = projects.filter(p =>
    p.status === 'completed' ||
    p.status === 'approved'
  );

  const projectStatusData = {
    labels: ['Draft', 'In Review', 'Corrections', 'In Progress', 'Completed'],
    datasets: [{
      data: [
        draftProjects.length,
        inReviewProjects.length,
        correctionsProjects.length,
        inProgressProjects.length,
        completedProjects.length,
      ],
      backgroundColor: ['#94a3b8', '#3b82f6', '#ef4444', '#f59e0b', '#22c55e'],
      hoverOffset: 4,
    }]
  };

  const paymentData = {
    labels: ['Pending', 'Paid', 'Overdue'],
    datasets: [{
      label: 'Payments',
      data: [
        (payments || []).filter(p => p.status === 'pending').length,
        (payments || []).filter(p => p.status === 'paid').length,
        (payments || []).filter(p => p.status === 'overdue').length,
      ],
      backgroundColor: ['#f59e0b', '#25D366', '#ef4444'],
    }]
  };

  // Calculate role-based revenue/expense
  // Editor: Shows editor_fee as revenue (what they earn)
  // Client: Shows client_fee as expense (what they pay)
  // Agency: Shows both client_fee (income) and editor_fee (expense) with margin
  const calculateFinancials = () => {
    const userCategory = profile?.user_category;

    if (userCategory === 'editor') {
      // Editor sees their revenue
      const revenue = (projects || []).reduce((sum, p) => {
        return sum + parseFloat(p.editor_fee || p.fee || 0);
      }, 0);
      return {
        label: 'Total Revenue',
        amount: revenue,
        description: 'Your earnings',
        type: 'revenue'
      };
    } else if (userCategory === 'client') {
      // Client sees their expense
      const expense = (projects || []).reduce((sum, p) => {
        return sum + parseFloat(p.client_fee || p.fee || 0);
      }, 0);
      return {
        label: 'Total Expense',
        amount: expense,
        description: 'Your spending',
        type: 'expense'
      };
    } else if (userCategory === 'agency') {
      // Agency sees both revenue and expense
      const clientRevenue = (projects || []).reduce((sum, p) => {
        return sum + parseFloat(p.client_fee || p.fee || 0);
      }, 0);
      const editorExpense = (projects || []).reduce((sum, p) => {
        return sum + parseFloat(p.editor_fee || p.fee || 0);
      }, 0);
      const margin = clientRevenue - editorExpense;

      return {
        label: 'Total Revenue',
        amount: clientRevenue,
        description: `Margin: ₹${margin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        type: 'agency',
        margin: margin,
        expense: editorExpense
      };
    }

    // Default fallback
    return {
      label: 'Total Revenue',
      amount: (projects || []).reduce((sum, p) => sum + parseFloat(p.fee || 0), 0),
      description: 'From all projects',
      type: 'revenue'
    };
  };

  const financials = calculateFinancials();

  // Calculate completion rate based on completed projects vs total projects
  const completionRate = projects.length > 0
    ? Math.round((completedProjects.length / projects.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background">
          {/* Header */}
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <Video className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Xrozen Workflow</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground capitalize truncate">
                    {profile?.user_category} • {profile?.subscription_tier}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                <NotificationBell />
              </div>
            </div>
          </header>

          <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Welcome back, {profile?.full_name || 'User'}!</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Here's an overview of your workflow</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
              <Card className="shadow-elegant hover:shadow-glow transition-smooth cursor-pointer"
                onClick={() => navigate("/projects")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pending Projects</CardTitle>
                  <Video className="w-4 h-4 text-warning flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold text-warning">{pendingProjects}</div>
                  <p className="text-xs text-muted-foreground mt-1">Draft, In Review & Corrections</p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant hover:shadow-glow transition-smooth">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">{financials.label}</CardTitle>
                  <DollarSign className={`w-4 h-4 flex-shrink-0 ${financials.type === 'expense' ? 'text-warning' : 'text-success'}`} />
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold">
                    ₹{financials.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{financials.description}</p>
                  {financials.type === 'agency' && (
                    <p className="text-xs text-success mt-1">
                      Editor Cost: ₹{financials.expense?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-elegant hover:shadow-glow transition-smooth cursor-pointer"
                onClick={() => navigate("/projects")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Completed Projects</CardTitle>
                  <FileText className="w-4 h-4 text-success flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold text-success">
                    {completedProjects.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Approved & Completed</p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant hover:shadow-glow transition-smooth">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Completion Rate</CardTitle>
                  <BarChart3 className="w-4 h-4 text-primary flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold">
                    {completionRate}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{completedProjects.length} of {projects.length} completed</p>
                </CardContent>
              </Card>
            </div>

            {/* Corrections Alert Card */}
            {correctionsProjects.length > 0 && (
              <Card className="shadow-elegant border-destructive/50 bg-destructive/5 mb-4 sm:mb-6 lg:mb-8">
                <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-destructive">
                    <FileText className="w-5 h-5" />
                    Projects Requiring Corrections
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {correctionsProjects.length} project{correctionsProjects.length > 1 ? 's' : ''} need{correctionsProjects.length === 1 ? 's' : ''} your attention
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="space-y-2">
                    {correctionsProjects.slice(0, 5).map((project: any) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3 bg-background rounded-lg border border-destructive/20 hover:border-destructive/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/project/${project.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{project.name || project.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.project_type || 'General'} •
                            {project.deadline ? ` Due: ${new Date(project.deadline).toLocaleDateString()}` : ' No deadline'}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="ml-2 flex-shrink-0">
                          Fix Now
                        </Button>
                      </div>
                    ))}
                    {correctionsProjects.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{correctionsProjects.length - 5} more project{correctionsProjects.length - 5 > 1 ? 's' : ''} requiring corrections
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts and Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
              <Card className="shadow-elegant">
                <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-base sm:text-lg">Project Status Distribution</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {correctionsProjects.length > 0 && (
                      <span className="text-destructive font-medium">
                        {correctionsProjects.length} project{correctionsProjects.length > 1 ? 's' : ''} need corrections
                      </span>
                    )}
                    {correctionsProjects.length === 0 && "All projects are on track"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="h-[250px] sm:h-[300px]">
                    <Doughnut
                      data={projectStatusData}
                      options={{
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          tooltip: {
                            callbacks: {
                              label: function (context: any) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                let projectsList: any[] = [];

                                // Get projects based on status
                                switch (label) {
                                  case 'Draft':
                                    projectsList = draftProjects;
                                    break;
                                  case 'In Review':
                                    projectsList = inReviewProjects;
                                    break;
                                  case 'Corrections':
                                    projectsList = correctionsProjects;
                                    break;
                                  case 'In Progress':
                                    projectsList = inProgressProjects;
                                    break;
                                  case 'Completed':
                                    projectsList = completedProjects;
                                    break;
                                }

                                const projectNames = projectsList.slice(0, 5).map(p => p.name || p.title).join(', ');
                                const moreCount = projectsList.length > 5 ? ` +${projectsList.length - 5} more` : '';

                                return [
                                  `${label}: ${value} project${value !== 1 ? 's' : ''}`,
                                  projectsList.length > 0 ? `Projects: ${projectNames}${moreCount}` : ''
                                ];
                              }
                            }
                          },
                          legend: {
                            position: 'bottom' as const,
                            labels: {
                              padding: 15,
                              usePointStyle: true,
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-base sm:text-lg">Payment Overview</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Payment status breakdown</CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="h-[250px] sm:h-[300px]">
                    <Bar data={paymentData} options={{
                      maintainAspectRatio: false,
                      responsive: true,
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { stepSize: 1 }
                        }
                      }
                    }} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity and Deadlines Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
              <RecentActivity />
              <UpcomingDeadlines />
            </div>

            {/* Quick Actions */}
            <Card className="shadow-elegant">
              <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
                <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Get started with common tasks</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 px-4 sm:px-6">
                <Button
                  className="h-auto py-3 sm:py-4 flex-col gap-2 text-sm sm:text-base"
                  variant="outline"
                  onClick={() => navigate("/projects")}
                >
                  <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>Manage Projects</span>
                </Button>
                <Button
                  className="h-auto py-3 sm:py-4 flex-col gap-2 text-sm sm:text-base"
                  variant="outline"
                  onClick={() => navigate("/chat")}
                >
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>Messages</span>
                </Button>
                <Button
                  className="h-auto py-3 sm:py-4 flex-col gap-2 text-sm sm:text-base"
                  variant="outline"
                  onClick={() => navigate("/profile")}
                >
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>Settings</span>
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
