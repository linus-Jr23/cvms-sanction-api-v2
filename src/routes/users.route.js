const express = require("express");
const router = express.Router();
const { admin, db } = require("../firebase/admin");

// Delete single user from both Firebase Auth and Firestore
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

// Bulk delete users
router.delete("/", async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds array is required" });
    }

    const results = await Promise.allSettled(
      userIds.map(async (uid) => {
        await admin.auth().deleteUser(uid);
        await db.collection("users").doc(uid).delete();
        return uid;
      })
    );

    const succeeded = results.filter(r => r.status === "fulfilled").map(r => r.value);
    const failed = results.filter(r => r.status === "rejected").map((r, i) => ({
      uid: userIds[i],
      reason: r.reason?.message,
    }));

    res.json({
      success: true,
      deleted: succeeded.length,
      failed: failed.length > 0 ? failed : undefined,
      message: `${succeeded.length} user(s) successfully deleted`,
    });
  } catch (err) {
    console.error("BULK DELETE ERROR:", err);
    res.status(500).json({ error: "Failed to bulk delete users", details: err.message });
  }
});

module.exports = router;