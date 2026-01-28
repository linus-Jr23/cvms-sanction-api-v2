const admin = require("firebase-admin");

console.log("Initializing Firebase with environment variables...");
console.log("Project ID:", process.env.FIREBASE_PROJECT_ID ? "Found" : "Missing");
console.log("Client Email:", process.env.FIREBASE_CLIENT_EMAIL ? "Found" : "Missing");
console.log("Private Key:", process.env.FIREBASE_PRIVATE_KEY ? "Found" : "Missing");

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
console.log("Firebase initialized successfully");

module.exports = { admin, db };
