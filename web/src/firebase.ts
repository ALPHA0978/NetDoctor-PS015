import type {Report} from './diagnostics';
import { output } from './diagnostics';
const cfg = {apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID};
export const firebaseConfigured=Boolean(cfg.apiKey&&cfg.authDomain&&cfg.projectId&&cfg.appId);
export async function savePrivateReport(report:Report) {
 if(!firebaseConfigured)throw new Error('Set up your own Firebase project first.');
 const [app,auth,db]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/firestore')]);
 const fb=app.getApps().find(a=>a.name==='netdoctor')??app.initializeApp(cfg,'netdoctor');
 const a=auth.getAuth(fb);
 await a.authStateReady();
 const user=a.currentUser??(await auth.signInAnonymously(a)).user;
 const privateCopy=JSON.parse(output(report));
 await db.setDoc(db.doc(db.getFirestore(fb),'users',user.uid,'reports',report.id),privateCopy);
}

