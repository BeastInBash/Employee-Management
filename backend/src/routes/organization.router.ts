import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createOrganization } from "../controllers/organization.controller";
import { handleError } from "../middleware/error.middleware";

const orgRouter = Router()

orgRouter.post('/createOrganization', authenticate, handleError, createOrganization)

export default orgRouter
