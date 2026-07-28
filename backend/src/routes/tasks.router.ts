import { Router } from "express";
import {
  createTask,
  getMemberTasks,
  getMyTaskWindow,
  updateTask,
  deleteTask,
} from "../controllers/tasks.controller";
import { authenticate } from "../middleware/auth.middleware";
import { canManageTask, canViewMemberTasks } from "../middleware/roleCheck";

const router = Router();

router.use(authenticate);

router.post("/", createTask);
// Must stay above "/:userId" or it would be swallowed by the wildcard route.
router.get("/task-window", getMyTaskWindow);
router.get("/member/:userId", canViewMemberTasks, getMemberTasks);
router.get("/:userId",getMemberTasks);
router.patch("/:taskId", canManageTask, updateTask);
router.delete("/:taskId", canManageTask, deleteTask);

export default router;
