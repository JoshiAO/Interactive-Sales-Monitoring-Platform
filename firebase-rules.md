# Firebase Rules - sales-monitoring

## Project Info
- Name: sales-monitoring
- ID: sales-monitoring
- Number: 22617878462

## Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthenticated() {
      return request.auth != null;
    }
    function isAdmin() {
      return isAuthenticated() && request.auth.token.role == 'admin';
    }
    function isSalesman() {
      return isAuthenticated() && request.auth.token.role == 'salesman';
    }

    match /profile_pictures/{userId}/{fileName} {
      allow read: if isAuthenticated();
      // Salesman can upload/read only their own profile picture
      allow write: if isAdmin() || (isSalesman() && request.auth.uid == userId);
    }
    
    match /data_uploads/{fileName} {
      // Admin can upload .xlsx files for data ingestion
      allow read, write: if isAdmin() && fileName.matches('.*\\.xlsx$');
    }
  }
}
```

## Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    function isAdmin() {
      return isAuthenticated() && request.auth.token.role == 'admin';
    }
    function isManager() {
      return isAuthenticated() && request.auth.token.role == 'manager';
    }
    function isSupervisor() {
      return isAuthenticated() && request.auth.token.role == 'supervisor';
    }
    function isSalesman() {
      return isAuthenticated() && request.auth.token.role == 'salesman';
    }

    match /users/{userId} {
      allow read: if isAdmin() || request.auth.uid == userId;
      allow write: if isAdmin();
    }
    
    match /sales_data/{docId} {
      // Salesman: own data
      // Supervisor: team data
      // Manager: grouped data (supervisor + team)
      // Admin: full access
      allow read: if isAdmin() ||
                     (isManager() && resource.data.managerId == request.auth.uid) ||
                     (isSupervisor() && resource.data.supervisorId == request.auth.uid) ||
                     (isSalesman() && resource.data.salesmanId == request.auth.uid);
      allow write: if isAdmin();
    }

    match /{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
```

## Authentication Rules
Firebase Authentication rules and custom claims are typically enforced via Firebase Admin SDK upon user creation or login validation. 

### Implementation Guide:
1. **Email/Password authentication**: Enabled via Firebase Console > Authentication > Sign-in method.
2. **Require `Company Code` at activation**: Managed within the frontend application flow during the Activation phase. Only users with a valid company code can proceed to create an account or sign in.
3. **Custom claims (`role`, `companyCode`)**: Set through a Cloud Function or Admin script when a user account is provisioned. The frontend retrieves these claims using `getIdTokenResult()` and uses them for role-based access control.
