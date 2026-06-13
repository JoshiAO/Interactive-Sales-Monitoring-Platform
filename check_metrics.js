import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "kenea-back-office"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const snap = await getDoc(doc(db, 'dashboard_metrics', 'all'));
  if (snap.exists()) {
    const data = snap.data();
    const firstKey = Object.keys(data)[0];
    console.log(firstKey, data[firstKey]);
  }
}

check().then(() => process.exit(0));
