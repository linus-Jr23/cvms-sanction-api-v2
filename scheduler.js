const { resolveExpiredSanctions } = require("./src/services/sanction-resolver.service");
const { autoExpireRegistrations } = require("./src/services/registration-maintenance.service");

/**
 * Scheduled task runner for all maintenance jobs
 * This function can be called by external schedulers (cron jobs, Railway cron, etc.)
 * 
 * Runs two maintenance tasks:
 * 1. Auto-expire vehicle registrations when registrationValidUntil deadline is met
 * 2. Auto-clear suspension sanctions when endAt deadline is met
 */
async function runScheduledMaintenanceJobs() {
  console.log("=== Starting Scheduled Maintenance Jobs ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  const results = {
    registrations: null,
    sanctions: null,
  };
  
  try {
    // 1. Auto-expire registrations
    console.log("\n--- Running Registration Expiration ---");
    results.registrations = await autoExpireRegistrations();
    console.log(`Registration expiration completed: ${results.registrations.processed} processed`);
    
    if (results.registrations.details.length > 0) {
      console.log("Expired registrations:");
      results.registrations.details.forEach((detail, index) => {
        console.log(`  ${index + 1}. Vehicle ${detail.vehicleId} (${detail.plateNumber}) - Status: ${detail.previousStatus} → expired`);
      });
    }
    
  } catch (error) {
    console.error("Registration expiration failed:", error);
    // Continue with sanctions even if registration expiration fails
  }
  
  try {
    // 2. Auto-clear suspension sanctions
    console.log("\n--- Running Sanction Resolution ---");
    results.sanctions = await resolveExpiredSanctions();
    console.log(`Sanction resolution completed: ${results.sanctions.processed} processed`);
    
    if (results.sanctions.details.length > 0) {
      console.log("Cleared sanctions:");
      results.sanctions.details.forEach((detail, index) => {
        console.log(`  ${index + 1}. Vehicle ${detail.vehicleId} - ${detail.type} sanction cleared`);
      });
    }
    
  } catch (error) {
    console.error("Sanction resolution failed:", error);
    throw error; // Re-throw if sanctions fail
  }
  
  console.log("\n=== Scheduled Maintenance Jobs Completed ===");
  return results;
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use runScheduledMaintenanceJobs instead
 */
async function runScheduledSanctionResolution() {
  console.warn("runScheduledSanctionResolution is deprecated. Use runScheduledMaintenanceJobs instead.");
  return runScheduledMaintenanceJobs();
}

// Export for external scheduling
module.exports = { 
  runScheduledMaintenanceJobs,
  runScheduledSanctionResolution, // Legacy export for backward compatibility
};

// Also allow direct execution for testing
if (require.main === module) {
  runScheduledMaintenanceJobs()
    .then(() => {
      console.log("=== Scheduled task completed ===");
      process.exit(0);
    })
    .catch((error) => {
      console.error("=== Scheduled task failed ===");
      console.error(error);
      process.exit(1);
    });
}
