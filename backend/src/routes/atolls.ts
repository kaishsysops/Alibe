import { Router } from "express";
import { prisma } from "../db.js";

export const atollsRouter = Router();

atollsRouter.get("/", async (_req, res) => {
  const atolls = await prisma.atoll.findMany({
    orderBy: { name: "asc" },
    include: { islands: { orderBy: { name: "asc" } } },
  });
  res.json(atolls);
});
