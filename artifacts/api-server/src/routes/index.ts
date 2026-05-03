import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import playersRouter from "./players";
import eventsRouter from "./events";
import tasksRouter from "./tasks";
import messagesRouter from "./messages";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teamsRouter);
router.use(playersRouter);
router.use(eventsRouter);
router.use(tasksRouter);
router.use(messagesRouter);
router.use(dashboardRouter);

export default router;
