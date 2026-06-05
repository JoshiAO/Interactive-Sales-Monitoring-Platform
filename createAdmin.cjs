const admin = require('firebase-admin');

// 1. Download your Service Account Key from Firebase Console:
//    Project Settings -> Service Accounts -> Generate New Private Key
// 2. Save it in the same folder as this script and name it 'serviceAccountKey.json'
// 3. Run this script via terminal: node createAdmin.js

const serviceAccount = require('./secrets/rd-sales-monitoring-firebase-adminsdk-fbsvc-af5ca3dd37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const createFirstAdmin = async () => {
  try {
    console.log("Creating Admin User...");
    
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: 'joshua.kimberlin.ne@gmail.com',
        password: 'JoshiAO@2001',
        displayName: 'Joshua Ocampo',
        emailVerified: true,
      });
      console.log("Successfully created user:", userRecord.uid);
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        console.log("User already exists in Auth. Fetching existing user...");
        userRecord = await admin.auth().getUserByEmail('joshua.kimberlin.ne@gmail.com');
      } else {
        throw authError;
      }
    }

    // Set Custom Claims for Role-Based Access and Company Code
    console.log("Assigning Custom Claims (Admin Role & Company Code)...");
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      companyCode: 'KENEA-JAO-001'
    });

    // Optional: Also save the user document in Firestore so they show up in the Users list
    console.log("Saving user record to Firestore...");
    try {
      const db = admin.firestore();
      await db.collection('users').doc(userRecord.uid).set({
        name: 'Joshua Ocampo',
        email: 'joshua.kimberlin.ne@gmail.com',
        role: 'admin',
        companyCode: 'KENEA-JAO-001',
        salesmanId: '-',
        team: '-',
        salesmanType: '-',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("✅ Admin user creation complete!");
    } catch (fsError) {
      if (fsError.code === 5 || fsError.message.includes('NOT_FOUND')) {
        console.error("\n❌ FIRESTORE NOT FOUND ERROR!");
        console.error("The user is registered and CAN log in, but Firestore Database hasn't been created yet.");
        console.error("Please go to Firebase Console -> Build -> Firestore Database -> Click 'Create Database'.");
        console.error("Then run this script again to add yourself to the Users list.");
      } else {
        throw fsError;
      }
    }

    process.exit(0);

  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
};

createFirstAdmin();
