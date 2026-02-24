import {
  initFirebase,
  isFirebaseEnabled,
  onUserChanged,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
} from "./firebase/storage.js";

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const signInBtn = document.getElementById("signInBtn");
const signUpBtn = document.getElementById("signUpBtn");
const googleBtn = document.getElementById("googleBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatus = document.getElementById("authStatus");
const authMessage = document.getElementById("authMessage");

function setMsg(msg) {
  authMessage.textContent = msg || "";
}

function updateStatus(user) {
  authStatus.textContent = user
    ? `Connecte: ${user.email || user.uid}`
    : "Non connecte";
}

async function run(action) {
  try {
    setMsg("");
    await action();
  } catch (error) {
    setMsg(error?.message || "Erreur");
  }
}

async function boot() {
  await initFirebase();
  if (!isFirebaseEnabled()) {
    setMsg("Firebase non configure. Remplis firebase/config.js");
    return;
  }
  onUserChanged(updateStatus);

  signInBtn.addEventListener("click", () =>
    run(() => signInWithEmail(emailInput.value.trim(), passwordInput.value))
  );
  signUpBtn.addEventListener("click", () =>
    run(() => signUpWithEmail(emailInput.value.trim(), passwordInput.value))
  );
  googleBtn.addEventListener("click", () => run(() => signInWithGoogle()));
  signOutBtn.addEventListener("click", () => run(() => signOutUser()));
}

boot();

