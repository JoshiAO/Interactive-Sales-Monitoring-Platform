import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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

async function run() {
  const docRef = doc(db, 'reference_channels', 'all');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    console.log("Channels Data Size:", Object.keys(data).length);
    console.log("Sample Keys:", Object.keys(data).slice(0, 5));
    if (Object.keys(data).length > 0) {
      const firstKey = Object.keys(data)[0];
      console.log("Sample Value:", data[firstKey]);
    }
  } else {
    console.log("reference_channels/all DOES NOT EXIST");
  }
  process.exit(0);
}

run().catch(console.error);
