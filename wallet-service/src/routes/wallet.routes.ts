import express from "express";
import {
  handleCredit,
  handleDebit,
  handleLock,
  handleRelease,
  handleBalance,
  handleSettle,
} from "../controller/wallet.controller";

export const router = express.Router();

router.post("/credit", async (req, res) => {
  await handleCredit(req, res);
});

router.post("/debit", async (req, res) => {
  await handleDebit(req, res);
});

router.post("/lock", async (req, res) => {
  await handleLock(req, res);
});

router.post("/release", async (req, res) => {
  await handleRelease(req, res);
});

router.get("/balance/:userId", async (req, res) => {
  await handleBalance(req, res);
});

router.post("/settle", async (req, res) => {
  await handleSettle(req, res);
});
