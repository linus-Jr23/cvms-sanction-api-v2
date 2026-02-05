const express = require("express");
const { runScheduledMaintenanceJobs } = require("../../scheduler");
const { autoExpireRegistrations } = require("../services/registration-maintenance.service");
const { resolveExpiredSanctions } = require("../services/sanction-resolver.service");

const router = express.Router();

/**
 * POST /api/maintenance/run-all
 * Manually trigger all maintenance jobs
 * Useful for testing or admin override
 */
router.post("/run-all", async (req, res) => {
  try {
    console.log("Manual trigger: Running all maintenance jobs");
    
    const results = await runScheduledMaintenanceJobs();
    
    res.json({
      success: true,
      message: "Maintenance jobs completed successfully",
      ...results
    });
  } catch (error) {
    console.error("Error in maintenance/run-all endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run maintenance jobs",
      details: error.message
    });
  }
});

/**
 * POST /api/maintenance/expire-registrations
 * Manually trigger registration expiration only
 */
router.post("/expire-registrations", async (req, res) => {
  try {
    console.log("Manual trigger: Running registration expiration");
    
    const result = await autoExpireRegistrations();
    
    res.json({
      success: true,
      message: "Registration expiration completed",
      ...result
    });
  } catch (error) {
    console.error("Error in maintenance/expire-registrations endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to expire registrations",
      details: error.message
    });
  }
});

/**
 * POST /api/maintenance/clear-sanctions
 * Manually trigger sanction clearing only
 */
router.post("/clear-sanctions", async (req, res) => {
  try {
    console.log("Manual trigger: Running sanction clearing");
    
    const result = await resolveExpiredSanctions();
    
    res.json({
      success: true,
      message: "Sanction clearing completed",
      ...result
    });
  } catch (error) {
    console.error("Error in maintenance/clear-sanctions endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear sanctions",
      details: error.message
    });
  }
});

module.exports = router;
