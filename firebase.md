# 📝 Gemini 3.1 Pro Prompt

**Task:** Create a `.md` file that defines Firebase rules for the following services:
- Storage
- Firestore
- Authentication

**Project Metadata:**
- Project name: `sales-monitoring`
- Project ID: `sales-monitoring`
- Project number: `22617878462`

---

## 🔧 Instructions for Gemini
1. Generate a Markdown file named `firebase-rules.md`.
2. Inside the file, include:
   - A header section with project metadata.
   - Firebase **Storage rules**:
     - Salesman can upload/read only their own profile picture.
     - Admin can upload `.xlsx` files for data ingestion.
   - Firebase **Firestore rules**:
     - Salesman can read only their own sales data.
     - Supervisor can read team data.
     - Manager can read grouped data (supervisor + team).
     - Admin has full read/write access, including user management.
   - Firebase **Authentication rules**:
     - Enable Email/Password authentication.
     - Require `Company Code` at activation.
     - Assign custom claims (`role`, `companyCode`) for access control.
3. Ensure rules are written in Firebase’s `rules_version = '2'` syntax.
4. Output the complete `.md` file content.

---

## 📂 Expected Output Structure
```markdown
# Firebase Rules - sales-monitoring

## Project Info
- Name: sales-monitoring
- ID: sales-monitoring
- Number: 22617878462

## Storage Rules
```javascript
// storage rules here
