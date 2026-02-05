const { admin, db } = require("../firebase/admin");

/**
 * Automatically expires vehicle registrations when registrationValidUntil deadline is met
 * This service should be run periodically (e.g., hourly via cron job)
 */
async function autoExpireRegistrations() {
  console.log("Starting registration expiration process...");

  try {
    const now = admin.firestore.Timestamp.now();

    // Find vehicles whose registration period has ended but are not yet marked expired
    // We check for vehicles with registrationValidUntil <= now and status not already expired
    const expiredRegistrationsSnap = await db
      .collection("vehicles")
      .where("registrationValidUntil", "<=", now)
      .get();

    console.log(
      `Found ${expiredRegistrationsSnap.size} vehicles with expired registration dates`,
    );

    if (expiredRegistrationsSnap.empty) {
      console.log("No expired registrations found");
      return { processed: 0, details: [] };
    }

    const batch = db.batch();
    const processedDetails = [];

    for (const vehicleDoc of expiredRegistrationsSnap.docs) {
      const vehicle = vehicleDoc.data();
      const { registrationStatus, registrationValidUntil } = vehicle;

      // Only update if not already expired (avoid unnecessary writes)
      if (registrationStatus !== "expired") {
        console.log(
          `Expiring registration for vehicle: ${vehicleDoc.id}, current status: ${registrationStatus}`,
        );

        batch.update(vehicleDoc.ref, {
          registrationStatus: "expired",
        });

        processedDetails.push({
          vehicleId: vehicleDoc.id,
          plateNumber: vehicle.plateNumber || "N/A",
          previousStatus: registrationStatus,
          expiredAt: now.toDate().toISOString(),
        });
      }
    }

    if (processedDetails.length > 0) {
      // Commit all updates in a single batch
      await batch.commit();

      console.log(
        `Successfully expired ${processedDetails.length} vehicle registrations`,
      );
    } else {
      console.log("All vehicles with expired dates already marked as expired");
    }

    return {
      processed: processedDetails.length,
      details: processedDetails,
      processedAt: now.toDate().toISOString(),
    };
  } catch (error) {
    console.error("Error expiring registrations:", error);
    throw error;
  }
}

module.exports = {
  autoExpireRegistrations,
};
