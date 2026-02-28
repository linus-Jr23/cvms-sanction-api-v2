const express = require("express");
const { admin, db } = require("../firebase/admin");

const router = express.Router();

// Vehicle Renewal API
router.post("/renew", async (req, res) => {
  try {
    const { 
      vehicleId, 
      extensionDays, 
      yearLevel, 
      semester, 
      academicYear,
      renewedBy 
    } = req.body;

    if (!vehicleId || !yearLevel || !semester || !academicYear || !renewedBy) {
      return res.status(400).json({ 
        error: "Missing required fields: vehicleId, yearLevel, semester, academicYear, renewedBy" 
      });
    }

    // Get vehicle data for validation
    const vehicleDoc = await db.collection("vehicles").doc(vehicleId).get();
    if (!vehicleDoc.exists) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const vehicleData = vehicleDoc.data();
    
    const renewalDate = admin.firestore.FieldValue.serverTimestamp();
    const newExpiryDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + (extensionDays || 365) * 24 * 60 * 60 * 1000)
    );

    // Update vehicle document
    await db.collection("vehicles").doc(vehicleId).update({
      registrationValidFrom: renewalDate,
      registrationValidUntil: newExpiryDate,
      registrationStatus: "active",
      hasActiveSanction: false,
      hasUnresolvedViolation: false,
      yearLevel,
      semester,
      academicYear,
    });

    // Clear all violations for this vehicle
    const violationsSnap = await db
      .collection("violations")
      .where("vehicleId", "==", vehicleId)
      .where("status", "==", "confirmed")
      .get();

    const violationBatch = db.batch();
    violationsSnap.forEach((violationDoc) => {
      const violationRef = db.collection("violations").doc(violationDoc.id);
      violationBatch.update(violationRef, {
        status: "cleared",
        clearedAt: renewalDate,
        clearedBy: renewedBy,
      });
    });

    // Clear all sanctions for this vehicle
    const sanctionsSnap = await db
      .collection("sanctions")
      .where("vehicleId", "==", vehicleId)
      .where("status", "==", "active")
      .get();

    sanctionsSnap.forEach((sanctionDoc) => {
      const sanctionRef = db.collection("sanctions").doc(sanctionDoc.id);
      violationBatch.update(sanctionRef, {
        status: "cleared",
        endAt: renewalDate,
        endedBy: renewedBy,
      });
    });

    // Commit all updates
    await violationBatch.commit();

    const responseData = {
      success: true,
      message: "Vehicle renewed successfully",
      data: {
        newExpiryDate,
        violationsCleared: violationsSnap.size,
        sanctionsCleared: sanctionsSnap.size,
      }
    };

    res.json(responseData);

  } catch (err) {
    console.error("VEHICLE RENEWAL ERROR:", err);
    res.status(500).json({
      error: "Failed to renew vehicle",
      details: err.message,
    });
  }
});

module.exports = router;
