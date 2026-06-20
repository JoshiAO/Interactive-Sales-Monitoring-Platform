"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeUserPassword = void 0;
const functions = require("firebase-functions/v2");
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
//# sourceMappingURL=index.js.map