import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyB-t2vKwvyJzj_MxNf8h6fVSbvFke586BE',
  authDomain: 'rd-sales-monitoring.firebaseapp.com',
  projectId: 'rd-sales-monitoring',
  storageBucket: 'rd-sales-monitoring.firebasestorage.app',
  messagingSenderId: '418254511966',
  appId: '1:418254511966:web:97f439f2a0d9aef0beb9cf'
});
const auth = getAuth(app);
const db = getFirestore(app);

async function check() {
  await signInWithEmailAndPassword(auth, 'joshua.kimberlin.ne@gmail.com', 'JoshiAO@2001');
  const m = await getDoc(doc(db, 'dashboard_metrics', 'KNE0006'));
  console.log('F09_64202 Placements:', m.data()?.vd30_placements['F09_64202']);
  console.log('F10_30401 Placements:', m.data()?.vd30_placements['F10_30401']);
  process.exit(0);
}
check().catch(e => {
  console.error(e);
  process.exit(1);
});
