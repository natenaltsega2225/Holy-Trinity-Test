
// backend/routes/financeReminderSchedules.js

"use strict";

const express = require("express");
const router = express.Router();

const scheduleService = require(
  "../services/domains/finance/financeReminderScheduleService"
);

const financeReminderJob = require(
  "../services/domains/jobs/financeReminderJob"
);

router.get("/", async (req, res) => {
  try {
    const rows = await scheduleService.getSchedules();

    res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error("finance reminder schedules list failed:", err);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to load reminder schedules.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const result = await scheduleService.createSchedule({
      ...req.body,
      created_by: req.user?.id || req.auth?.id || req.body.created_by || null,
    });

    res.json({
      ok: true,
      message: "Schedule created successfully.",
      ...result,
    });
  } catch (err) {
    console.error("finance reminder schedule create failed:", err);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to create schedule.",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    await scheduleService.updateSchedule(req.params.id, req.body);

    res.json({
      ok: true,
      message: "Schedule updated successfully.",
    });
  } catch (err) {
    console.error("finance reminder schedule update failed:", err);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to update schedule.",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    await scheduleService.setScheduleStatus(
      req.params.id,
      req.body.active
    );

    res.json({
      ok: true,
      message: req.body.active ? "Schedule enabled." : "Schedule disabled.",
    });
  } catch (err) {
    console.error("finance reminder schedule status failed:", err);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to update schedule status.",
    });
  }
});

router.post("/:id/run", async (req, res) => {
  try {
    const result =
      await financeReminderJob.runFinanceReminderScheduleById(
        req.params.id,
        { force: true }
      );

    res.json({
      ok: true,
      message: "Reminder campaign executed successfully.",
      ...result,
    });
  } catch (err) {
    console.error("finance reminder schedule run failed:", err);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to execute reminder campaign.",
    });
  }
});

router.get("/:id/history", async (req, res) => {
  try {
    const rows = await scheduleService.getScheduleRuns(req.params.id);

    res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error("finance reminder schedule history failed:", err);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to load schedule history.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await scheduleService.deleteSchedule(req.params.id);

    res.json({
      ok: true,
      message: "Schedule deleted successfully.",
    });
  } catch (err) {
    console.error("finance reminder schedule delete failed:", err);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to delete schedule.",
    });
  }
});

module.exports = router;