import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import playersRouter from "./players";
import eventsRouter from "./events";
import tasksRouter from "./tasks";
import messagesRouter from "./messages";
import dashboardRouter from "./dashboard";
import memberRouter from "./member";
import calendarRouter from "./calendar";
import authRouter from "./auth";
import notificationsRouter from "./notifications";
import filesRouter from "./files";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(notificationsRouter);
router.use(filesRouter);
router.use(teamsRouter);
router.use(playersRouter);
router.use(eventsRouter);
router.use(tasksRouter);
router.use(messagesRouter);
router.use(dashboardRouter);
router.use(memberRouter);
router.use(calendarRouter);

export default router;
