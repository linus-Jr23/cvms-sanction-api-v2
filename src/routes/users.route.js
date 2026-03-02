const express = require("express");
const router = express.Router();
const { admin, db } = require("../firebase/admin");

// Delete user from both Firebase Auth and Firestore
router.delete("/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Delete from Firebase Auth
    await admin.auth().deleteUser(uid);

    // Delete from Firestore
    await db.collection("users").doc(uid).delete();

    res.json({
      success: true,
      message: "User successfully deleted from Auth and Firestore",
    });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);

    if (err.code === "auth/user-not-found") {
      // Auth account doesn't exist, just delete Firestore doc
      await db.collection("users").doc(req.params.uid).delete();
      return res.json({
        success: true,
        message: "Firestore record deleted (Auth account was already removed)",
      });
    }

    res.status(500).json({
      error: "Failed to delete user",
      details: err.message,
    });
  }
});

module.exports = router;