import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createOrganization, getMyOrganization, getOrgById } from "../controllers/organization.controller";
import { createWorkspace } from "../controllers/workspace.controller";
import { handleError } from "../middleware/error.middleware";

const orgRouter = Router()

orgRouter.use(authenticate)

orgRouter.post('/createOrganization', createOrganization)
orgRouter.get('/getMyOrgs', getMyOrganization)
orgRouter.get("/getOrg", getOrgById)
orgRouter.post('/:orgId/workspaces', createWorkspace)
orgRouter.use(handleError)

export default orgRouter;
