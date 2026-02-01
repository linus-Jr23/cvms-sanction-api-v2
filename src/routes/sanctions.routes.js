const express = require("express");
const { 
  resolveExpiredSanctions, 
  getUpcomingExpirations, 
  resolveVehicleSanctions 
} = require("../services/sanction-resolver.service");

const router = express.Router();

/**
 * POST /api/sanctions/resolve-expired
 * Automatically resolve all expired sanctions
 * This endpoint should be called by a scheduler/cron job
 */
router.post("/resolve-expired", async (req, res) => {
  try {
    console.log("Received request to resolve expired sanctions");
    
    const result = await resolveExpiredSanctions();
    
    res.json({
      success: true,
      message: "Expired sanctions resolved successfully",
      ...result
    });
  } catch (error) {
    console.error("Error in resolve-expired endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resolve expired sanctions",
      details: error.message
    });
  }
});

/**
 * GET /api/sanctions/upcoming-expirations
 * Get sanctions that will expire soon
 * Query params: daysAhead (default: 7)
 */
router.get("/upcoming-expirations", async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.daysAhead) || 7;
    
    if (daysAhead < 1 || daysAhead > 30) {
      return res.status(400).json({
        error: "daysAhead must be between 1 and 30"
      });
    }
    
    const result = await getUpcomingExpirations(daysAhead);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Error in upcoming-expirations endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get upcoming expirations",
      details: error.message
    });
  }
});

/**
 * POST /api/sanctions/resolve-vehicle
 * Manually resolve all sanctions for a specific vehicle
 * Body: { vehicleId }
 */
router.post("/resolve-vehicle", async (req, res) => {
  try {
    const { vehicleId } = req.body;
    
    if (!vehicleId) {
      return res.status(400).json({
        error: "Vehicle ID is required"
      });
    }
    
    const result = await resolveVehicleSanctions(vehicleId);
    
    res.json({
      success: true,
      message: "Vehicle sanctions resolved successfully",
      ...result
    });
  } catch (error) {
    console.error("Error in resolve-vehicle endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resolve vehicle sanctions",
      details: error.message
    });
  }
});

module.exports = router;
