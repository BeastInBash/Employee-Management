import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { handleError } from "../middleware/error.middleware";
import { getReport } from "../controllers/reports.controller";

const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.get("/", getReport);
reportsRouter.use(handleError);

export default reportsRouter;
