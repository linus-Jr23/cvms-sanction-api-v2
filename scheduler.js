const { resolveExpiredSanctions } = require("./src/services/sanction-resolver.service");

/**
 * Scheduled task runner for sanction resolution
 * This function can be called by external schedulers (cron jobs, Railway cron, etc.)
 */
async function runScheduledSanctionResolution() {
  console.log("=== Starting Scheduled Sanction Resolution ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  try {
    const result = await resolveExpiredSanctions();
    
    console.log("Scheduled sanction resolution completed successfully");
    console.log(`Processed: ${result.processed} sanctions`);
    
    if (result.details.length > 0) {
      console.log("Details:");
      result.details.forEach((detail, index) => {
        console.log(`  ${index + 1}. Vehicle ${detail.vehicleId} - ${detail.type} sanction completed`);
      });
    }
    
    return result;
    
  } catch (error) {
    console.error(" Scheduled sanction resolution failed:", error);
    throw error;
  }
}

// Export for external scheduling
module.exports = { runScheduledSanctionResolution };

// Also allow direct execution for testing
if (require.main === module) {
  runScheduledSanctionResolution()
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
