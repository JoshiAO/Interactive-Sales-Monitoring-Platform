"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncUserRoleClaims = exports.changeUserPassword = void 0;
const functions = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
exports.changeUserPassword = functions.https.onCall(async (request) => {
    // 1. Check if user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // 2. Check if the caller is an Admin
    if (request.auth.token.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can change passwords.');
    }
    const { uid, newPassword } = request.data;
    if (!uid || typeof uid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid uid.');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid newPassword (min 6 characters).');
    }
    try {
        await admin.auth().updateUser(uid, {
            password: newPassword
        });
        return { success: true, message: 'Password updated successfully' };
    }
    catch (error) {
        console.error('Error changing password for uid:', uid, error);
        throw new functions.https.HttpsError('internal', error.message || 'Error updating password.');
    }
});
// Sync Firestore role to Firebase Auth custom claims
exports.syncUserRoleClaims = (0, firestore_1.onDocumentWritten)("users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const userId = event.params.userId;
    // If document was deleted
    if (!snapshot.after.exists) {
        console.log(`User ${userId} deleted. Cannot update custom claims for deleted user.`);
        return;
    }
    const data = snapshot.after.data();
    if (!data)
        return;
    const role = data.role;
    try {
        const userRecord = await admin.auth().getUser(userId);
        const currentClaims = userRecord.customClaims || {};
        if (currentClaims.role !== role) {
            await admin.auth().setCustomUserClaims(userId, Object.assign(Object.assign({}, currentClaims), { role: role }));
            console.log(`Successfully synced role '${role}' to custom claims for user ${userId}.`);
        }
        else {
            console.log(`User ${userId} already has role '${role}' in custom claims. Skipping update.`);
        }
    }
    catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.warn(`User ${userId} not found in Firebase Auth.`);
        }
        else {
            console.error(`Error syncing custom claims for user ${userId}:`, error);
        }
    }
});
//# sourceMappingURL=index.js.map