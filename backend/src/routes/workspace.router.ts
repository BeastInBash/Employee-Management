import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createWorkspace } from "../controllers/workspace.controller";
import { handleError } from "../middleware/error.middleware";
const workspaceRouter = Router();

workspaceRouter.use(authenticate)
workspaceRouter.post('/create-workspace/:orgId', createWorkspace)
workspaceRouter.use(handleError)

export default workspaceRouter;

