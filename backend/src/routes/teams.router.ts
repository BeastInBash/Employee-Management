import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { handleError } from "../middleware/error.middleware";
import {
    addTeamMember,
    createTeam,
    deleteTeam,
    getTeam,
    listTeams,
    removeTeamMember,
    updateTeam,
    updateTeamMember,
} from "../controllers/teams.controller";

const teamsRouter = Router();

teamsRouter.use(authenticate);
teamsRouter.get("/", listTeams);
teamsRouter.post("/", createTeam);
teamsRouter.get("/:teamId", getTeam);
teamsRouter.patch("/:teamId", updateTeam);
teamsRouter.delete("/:teamId", deleteTeam);
teamsRouter.post("/:teamId/members", addTeamMember);
teamsRouter.patch("/:teamId/members/:memberId", updateTeamMember);
teamsRouter.delete("/:teamId/members/:memberId", removeTeamMember);
teamsRouter.use(handleError);

export default teamsRouter;
