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
import { AppShell } from "./components/layout/AppShell";
import { MotionConfig } from "framer-motion";
import { Suspense } from "react";
import { pages } from "./lib/pages";
import { ScreenFallback } from "./components/layout/PageFallback";
import { TaskProvider } from "./contexts/TaskContext";
import { ProjectProvider } from "./contexts/ProjectContext";

// Every page is its own chunk (see lib/pages.ts). Public pages wait on the
// full-screen fallback below; signed-in pages wait inside AppShell, so the
// sidebar stays on screen.
const Landing = pages.Landing.Component;
const Login = pages.Login.Component;
const ForgotPassword = pages.ForgotPassword.Component;
const ResetPassword = pages.ResetPassword.Component;
const AuthCallback = pages.AuthCallback.Component;
const VerifyEmail = pages.VerifyEmail.Component;
const NotFound = pages.NotFound.Component;
const Home = pages.Home.Component;
const Dashboard = pages.Dashboard.Component;
const MemberDetail = pages.MemberDetail.Component;
const TaskDetails = pages.TaskDetails.Component;
const Attendance = pages.Attendance.Component;
const AdminAttendance = pages.AdminAttendance.Component;
const Projects = pages.Projects.Component;
const ProjectDetail = pages.ProjectDetail.Component;
const Teams = pages.Teams.Component;
const TeamDetail = pages.TeamDetail.Component;
const Reports = pages.Reports.Component;

// const queryClient = new QueryClient();

const App = () => (
  // <QueryClientProvider client={queryClient}>
  <MotionConfig reducedMotion="user">
    <ThemeProvider defaultTheme="light" storageKey="crewly-theme">
      <TooltipProvider>
        <AuthProvider>
          <OrgProvider>
            <MemberProvider>
              <TaskProvider>
                <ProjectProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <Suspense fallback={<ScreenFallback />}>
                      <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/verify-email" element={<VerifyEmail />} />

                        <Route element={<ProtectedRoute />}>
                          <Route element={<AppShell />}>
                            <Route path="/home" element={<Home />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/attendance" element={<Attendance />} />

                            {/* Admin views a specific member's attendance */}
                            <Route path="/dashboard/member/:memberId/attendance" element={<Attendance />} />
                            <Route path="/admin/attendance" element={<AdminAttendance />} />
                            <Route path="/member/:memberId" element={<MemberDetail />} />
                            <Route path="/todos/:memberId" element={<TaskDetails />} />
                            <Route path="/projects" element={<Projects />} />
                            <Route path="/projects/:projectId" element={<ProjectDetail />} />
                            <Route path="/teams" element={<Teams />} />
                            <Route path="/teams/:teamId" element={<TeamDetail />} />
                            <Route path="/reports" element={<Reports />} />
                          </Route>
                        </Route>

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </BrowserRouter>
                </ProjectProvider>
              </TaskProvider>
            </MemberProvider>
          </OrgProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </MotionConfig>
  // </QueryClientProvider>
);

export default App;
