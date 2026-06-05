import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
  const snap = await getDocs(collection(db, 'reference_vd30'));
  let map = {};
  snap.forEach(d => {
    let r = d.data();
    let code = r.vd30_code;
    if (!map[code]) map[code] = [];
    map[code].push(r.product_code);
  });
  console.log('F09_64202:', map['F09_64202']);
  console.log('F10_30401:', map['F10_30401']);
  console.log('F18_7506:', map['F18_7506']);
  console.log('F24_64100:', map['F24_64100']);
  console.log('F26_47501:', map['F26_47501']);
  process.exit(0);
}
check().catch(e => {
  console.error(e);
  process.exit(1);
});
