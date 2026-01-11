import { Router } from "express";
import { getHome } from "../controllers/home.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authMiddleware, getHome);

export default router;
