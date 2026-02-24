import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

let app = null;
let auth = null;
let db = null;
let initialized = false;
let enabled = false;

const isConfigValid = () =>
  firebaseConfig &&
  typeof firebaseConfig.apiKey === "string" &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("YOUR_");

export async function initFirebase() {
  if (initialized) {
    return { enabled, auth, db };
  }
  initialized = true;
  enabled = isConfigValid();
  if (!enabled) {
    return { enabled, auth: null, db: null };
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  return { enabled, auth, db };
}

export function isFirebaseEnabled() {
  return enabled;
}

export function onUserChanged(handler) {
  if (!auth) {
    handler(null);
    return () => {};
  }
  return onAuthStateChanged(auth, handler);
}

export function getCurrentUser() {
  return auth?.currentUser || null;
}

export async function signUpWithEmail(email, password) {
  if (!auth) throw new Error("Firebase not initialized");
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email, password) {
  if (!auth) throw new Error("Firebase not initialized");
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase not initialized");
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signOutUser() {
  if (!auth) return;
  await firebaseSignOut(auth);
}

const userDoc = (uid) => doc(db, "users", uid);

export async function loadUserData(uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function saveUserData(uid, patch) {
  if (!db || !uid) return;
  await setDoc(
    userDoc(uid),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

