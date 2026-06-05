import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB-t2vKwvyJzj_MxNf8h6fVSbvFke586BE",
  authDomain: "rd-sales-monitoring.firebaseapp.com",
  projectId: "rd-sales-monitoring",
  storageBucket: "rd-sales-monitoring.firebasestorage.app",
  messagingSenderId: "418254511966",
  appId: "1:418254511966:web:97f439f2a0d9aef0beb9cf"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const metric = await getDoc(doc(db, 'dashboard_metrics', 'KNE0006'));
  const target = await getDoc(doc(db, 'vd30_targets', 'KNE0006'));
  
  console.log("KNE0006 Metrics (act):", metric.exists() ? metric.data().vd30_placements : null);
  console.log("KNE0006 Targets (tgt):", target.exists() ? target.data() : null);
}

check().then(() => process.exit(0)).catch(console.error);
