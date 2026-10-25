import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { handleError } from "../middleware/error.middleware";
import {
    addProjectMember,
    assignProjectTeam,
    createProject,
    createProjectTask,
    deleteProject,
    getProject,
    listProjects,
    listProjectTasks,
    removeProjectMember,
    unassignProjectTeam,
    updateProject,
    updateProjectMember,
} from "../controllers/projects.controller";

const projectsRouter = Router();

projectsRouter.use(authenticate);
projectsRouter.get("/", listProjects);
projectsRouter.post("/", createProject);
projectsRouter.get("/:projectId", getProject);
projectsRouter.patch("/:projectId", updateProject);
projectsRouter.delete("/:projectId", deleteProject);
projectsRouter.post("/:projectId/members", addProjectMember);
projectsRouter.patch("/:projectId/members/:memberId", updateProjectMember);
projectsRouter.delete("/:projectId/members/:memberId", removeProjectMember);
projectsRouter.post("/:projectId/teams", assignProjectTeam);
projectsRouter.delete("/:projectId/teams/:teamId", unassignProjectTeam);
projectsRouter.get("/:projectId/tasks", listProjectTasks);
projectsRouter.post("/:projectId/tasks", createProjectTask);
projectsRouter.use(handleError);

export default projectsRouter;
