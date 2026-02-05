const { admin, db } = require("../firebase/admin");

/**
 * Automatically resolves expired sanctions and updates vehicle status
 * This service should be run periodically (e.g., daily via cron job)
 */
async function resolveExpiredSanctions() {
  console.log("Starting expired sanctions resolution process...");

  try {
    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

    // Get all active suspension sanctions that have expired
    const expiredSanctionsSnap = await db
      .collection("sanctions")
      .where("type", "==", "suspension")
      .where("status", "==", "active")
      .where("endAt", "<=", nowTimestamp)
      .get();

    console.log(
      `Found ${expiredSanctionsSnap.size} expired sanctions to process`,
    );

    if (expiredSanctionsSnap.empty) {
      console.log("No expired sanctions found");
      return { processed: 0, details: [] };
    }

    const batch = db.batch();
    const processedDetails = [];

    for (const sanctionDoc of expiredSanctionsSnap.docs) {
      const sanction = sanctionDoc.data();
      const { vehicleId, violationId, type } = sanction;

      console.log(
        `Processing expired sanction for vehicle: ${vehicleId}, type: ${type}`,
      );

      // 1. Update sanction status to cleared
      batch.update(sanctionDoc.ref, {
        status: "cleared",
        lastEvaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        clearedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2. Update vehicle status to cleared
      const vehicleRef = db.collection("vehicles").doc(vehicleId);
      batch.update(vehicleRef, {
        registrationStatus: "cleared",
        hasActiveSanction: false,
        hasUnresolvedViolation: false,
      });

      // 3. Update related violations to mark sanction as no longer applied
      const relatedViolationsSnap = await db
        .collection("violations")
        .where("vehicleId", "==", vehicleId)
        .where("sanctionId", "==", sanctionDoc.id)
        .get();

      relatedViolationsSnap.forEach((violationDoc) => {
        batch.update(violationDoc.ref, {
          sanctionApplied: false,
        });
      });

      processedDetails.push({
        sanctionId: sanctionDoc.id,
        vehicleId,
        violationId,
        type,
        clearedAt: now.toISOString(),
      });
    }

    // Commit all updates in a single batch
    await batch.commit();

    console.log(
      `Successfully processed ${expiredSanctionsSnap.size} expired sanctions`,
    );

    return {
      processed: expiredSanctionsSnap.size,
      details: processedDetails,
      processedAt: now.toISOString(),
    };
  } catch (error) {
    console.error("Error resolving expired sanctions:", error);
    throw error;
  }
}

/**
 * Get statistics about sanctions that will expire soon
 * Useful for monitoring and notifications
 */
async function getUpcomingExpirations(daysAhead = 7) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const futureTimestamp = admin.firestore.Timestamp.fromDate(futureDate);

  const upcomingExpirationsSnap = await db
    .collection("sanctions")
    .where("status", "==", "active")
    .where("endAt", "<=", futureTimestamp)
    .where("endAt", ">", admin.firestore.Timestamp.fromDate(now))
    .get();

  const upcomingExpirations = upcomingExpirationsSnap.docs.map((doc) => ({
    sanctionId: doc.id,
    ...doc.data(),
    expiresAt: doc.data().endAt.toDate().toISOString(),
  }));

  return {
    count: upcomingExpirations.length,
    daysAhead,
    sanctions: upcomingExpirations,
  };
}

/**
 * Manual trigger for resolving a specific vehicle's sanctions
 * Useful for admin override or testing
 */
async function resolveVehicleSanctions(vehicleId) {
  console.log(`Manually resolving sanctions for vehicle: ${vehicleId}`);

  try {
    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

    // Get all active suspension sanctions for this vehicle
    const activeSanctionsSnap = await db
      .collection("sanctions")
      .where("vehicleId", "==", vehicleId)
      .where("type", "==", "suspension")
      .where("status", "==", "active")
      .get();

    if (activeSanctionsSnap.empty) {
      console.log(`No active sanctions found for vehicle: ${vehicleId}`);
      return { processed: 0, message: "No active sanctions found" };
    }

    const batch = db.batch();

    for (const sanctionDoc of activeSanctionsSnap.docs) {
      // Update sanction status
      batch.update(sanctionDoc.ref, {
        status: "cleared",
        lastEvaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        clearedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update related violations
      const relatedViolationsSnap = await db
        .collection("violations")
        .where("sanctionId", "==", sanctionDoc.id)
        .get();

      relatedViolationsSnap.forEach((violationDoc) => {
        batch.update(violationDoc.ref, {
          sanctionApplied: false,
        });
      });
    }

    // Update vehicle status
    const vehicleRef = db.collection("vehicles").doc(vehicleId);
    batch.update(vehicleRef, {
      registrationStatus: "cleared",
      hasActiveSanction: false,
      hasUnresolvedViolation: false,
    });

    await batch.commit();

    console.log(
      `Successfully resolved ${activeSanctionsSnap.size} sanctions for vehicle: ${vehicleId}`,
    );

    return {
      processed: activeSanctionsSnap.size,
      vehicleId,
      resolvedAt: now.toISOString(),
    };
  } catch (error) {
    console.error(`Error resolving sanctions for vehicle ${vehicleId}:`, error);
    throw error;
  }
}

module.exports = {
  resolveExpiredSanctions,
  getUpcomingExpirations,
  resolveVehicleSanctions,
};
