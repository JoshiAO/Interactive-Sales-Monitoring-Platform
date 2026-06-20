const admin = require('firebase-admin');

// Load the existing service account key you already have
const serviceAccount = require('./secrets/rd-sales-monitoring-firebase-adminsdk-fbsvc-af5ca3dd37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const changePassword = async () => {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error("❌ Usage: node changePassword.cjs <email> <newPassword>");
    process.exit(1);
  }

  const email = args[0];
  const newPassword = args[1];

  try {
    console.log(`Looking up user by email: ${email}...`);
    const userRecord = await admin.auth().getUserByEmail(email);
    
    console.log(`User found! UID: ${userRecord.uid}`);
    console.log(`Updating password...`);
    
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword
    });

    console.log(`✅ Success! Password for ${email} has been updated.`);
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ Error: No user found with the email "${email}".`);
    } else {
      console.error("❌ Error updating password:", error);
    }
    process.exit(1);
  }
};

changePassword();
