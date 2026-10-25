import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrgProvider } from "./contexts/OrgContext";
import { MemberProvider } from "./contexts/MemberContext";
import { ThemeProvider } from "./components/theme-provider";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MemberDetail from "./pages/MemberDetail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
// import AdminDashboard from "./pages/AdminDashboard";
// import Invitations from "./pages/Invitations";
import NotFound from "./pages/NotFound";
import TaskDetails from "./pages/TaskDetails";
import { TaskProvider } from "./contexts/TaskContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import MemberDashboard from "./pages/MembersDashboard";
import AdminAttendancePanel from "./pages/AdminPanel";

// const queryClient = new QueryClient();

const App = () => (
    // <QueryClientProvider client={queryClient}>
    < ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" >
        <TooltipProvider>
            <AuthProvider>
                <OrgProvider>
                    <MemberProvider>
                        <TaskProvider>
                          <ProjectProvider>
                            <Toaster />
                            <Sonner />
                            <BrowserRouter>
                                <Routes>
                                    <Route path="/" element={<Landing />} />
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/forgot-password" element={<ForgotPassword />} />
                                    <Route path="/reset-password" element={<ResetPassword />} />

                                    <Route element={<ProtectedRoute />}>

                                        <Route path="/dashboard" element={<Dashboard />} />
                                        <Route path="/attendance" element={<MemberDashboard />} />

                                        {/* Admin views a specific member's attendance */}
                                        <Route path="/dashboard/member/:memberId/attendance" element={<MemberDashboard />} />
                                        <Route path="/admin/attendance" element={<AdminAttendancePanel />} />
                                        <Route path="/member/:memberId" element={<MemberDetail />} />
                                        <Route path="/todos/:memberId" element={<TaskDetails />} />
                                        <Route path="/projects" element={<Projects />} />
                                        <Route path="/projects/:projectId" element={<ProjectDetail />} />
                                        <Route path="/teams" element={<Teams />} />
                                        <Route path="/teams/:teamId" element={<TeamDetail />} />
                                    </Route>

                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </BrowserRouter>
                          </ProjectProvider>
                        </TaskProvider>
                    </MemberProvider>
                </OrgProvider>
            </AuthProvider>
        </TooltipProvider>
    </ThemeProvider >
    // </QueryClientProvider>
);

export default App;
