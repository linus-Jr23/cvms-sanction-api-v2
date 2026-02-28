require("dotenv").config();

console.log("Starting backend application...");
console.log("Environment variables loaded:", Object.keys(process.env).filter(key => key.includes('FIREBASE')).length, "Firebase vars found");

try {
  const app = require("./src/app");
  const { admin, db } = require("./src/firebase/admin");

  const { resolveSanction } = require("./src/services/sanction.service");

  app.post("/sanctions/from-violation", async (req, res) => {
    try {
      const { violationId, vehicleId, confirmedBy } = req.body;

      if (!violationId || !vehicleId) {
        return res.status(400).json({ error: "Missing data" });
      }

      // 1️ Count confirmed violations for this vehicle
      const violationsSnap = await db
        .collection("violations")
        .where("vehicleId", "==", vehicleId)
        .where("status", "==", "confirmed")
        .get();

      const offenseNumber = violationsSnap.size; // +1 for the violation being confirmed

      // 2️ Decide sanction
      let sanctionType = "warning";
      let vehicleStatus = "warned";
      let endAt = null;

      if (offenseNumber === 2) {
        sanctionType = "suspension";
        vehicleStatus = "suspended";

        // 30 working days (simple version = 42 calendar days)
        endAt = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 42 * 24 * 60 * 60 * 1000)
        );
      }

      if (offenseNumber >= 3) {
        sanctionType = "revocation";
        vehicleStatus = "revoked";
      }

      // 3️ Create sanction record
      const sanctionRef = await db.collection("sanctions").add({
        violationId,
        vehicleId,
        offenseNumber,
        type: sanctionType,
        status: sanctionType === "warning" ? "completed" : "active",
        startAt: admin.firestore.FieldValue.serverTimestamp(),
        endAt,
        createdBy: confirmedBy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4️ Update vehicle status if needed
      if (vehicleStatus !== "active") {
        await db.collection("vehicles").doc(vehicleId).update({
          registrationStatus: vehicleStatus,
          hasActiveSanction: true,
          hasUnresolvedViolation: true,
        });
      }

      // 5️ Mark violation as sanctioned
      const violationRef = db.collection("violations").doc(violationId);
      const violationDoc = await violationRef.get();
      
      if (violationDoc.exists) {
        await violationRef.update({
          sanctionApplied: true,
          sanctionId: sanctionRef.id,
        });
      } else {
        console.warn(`Violation document ${violationId} not found, skipping update`);
      }

      res.json({
        success: true,
        sanctionType,
        offenseNumber,
      });
    } catch (err) {
      console.error("SANCTION ERROR:", err);
      console.error("ERROR DETAILS:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json({
        error: "Sanction processing failed",
        details: err.message,
        stack: err.stack,
      });
    }
  });

  app.post("/sanctions/resolve", async (req, res) => {
    try {
      const { vehicleId } = req.body;

      if (!vehicleId) {
        return res.status(400).json({ error: "Vehicle ID is required" });
      }

      await resolveSanction(vehicleId);

      res.json({
        success: true,
        message: "Sanction resolved successfully",
      });
    } catch (err) {
      console.error("RESOLVE SANCTION ERROR:", err);
      res.status(500).json({
        error: "Failed to resolve sanction",
        details: err.message,
      });
    }
  });
  // Vehicle Renewal API
  app.post("/vehicles/renew", async (req, res) => {
  
    
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
     
      res.status(500).json({
        error: "Failed to renew vehicle",
        details: err.message,
      });
    }
  });
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
  });

} catch (error) {
  console.error("Failed to start application:", error);
  process.exit(1);
}
