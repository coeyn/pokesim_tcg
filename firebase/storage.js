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
  onSnapshot,
  deleteField,
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
const roomDoc = (roomId) => doc(db, "rooms", roomId);

function randomRoomId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let roomId = "";
  for (let index = 0; index < length; index += 1) {
    roomId += chars[Math.floor(Math.random() * chars.length)];
  }
  return roomId;
}

function userPresence(user) {
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email || user.uid,
    joinedAt: new Date().toISOString(),
  };
}

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

export async function createRoom(user, payload = {}) {
  if (!db || !user?.uid) throw new Error("Firebase not initialized");
  const roomId = randomRoomId();
  const roomRef = roomDoc(roomId);
  const player = userPresence(user);
  await setDoc(roomRef, {
    roomId,
    hostUid: user.uid,
    createdBy: user.uid,
    status: "waiting",
    players: { [user.uid]: player },
    gameState: payload.gameState || null,
    deckId: payload.deckId || "",
    lang: payload.lang || "fr",
    lastActionBy: user.uid,
    lastActionId: payload.actionId || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return roomId;
}

export async function joinRoom(roomId, user) {
  if (!db || !user?.uid) throw new Error("Firebase not initialized");
  const trimmed = String(roomId || "").trim().toUpperCase();
  if (!trimmed) throw new Error("Room ID required");
  const ref = roomDoc(trimmed);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Room not found");
  await setDoc(
    ref,
    {
      roomId: trimmed,
      players: { [user.uid]: userPresence(user) },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return trimmed;
}

export function subscribeRoom(roomId, handler) {
  if (!db || !roomId) return () => {};
  return onSnapshot(roomDoc(roomId), (snap) => {
    handler(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function updateRoom(roomId, patch) {
  if (!db || !roomId) throw new Error("Firebase not initialized");
  await setDoc(
    roomDoc(roomId),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function leaveRoom(roomId, user) {
  if (!db || !roomId || !user?.uid) return;
  await setDoc(
    roomDoc(roomId),
    {
      players: { [user.uid]: deleteField() },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
