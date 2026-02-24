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
const userSummary = document.getElementById("userSummary");
const authFields = document.getElementById("authFields");
const authActions = document.getElementById("authActions");
const actionButtons = [signInBtn, signUpBtn, googleBtn, signOutBtn];

function setBusy(busy) {
  actionButtons.forEach((btn) => {
    btn.disabled = busy;
  });
}

function setMsg(msg, type = "") {
  authMessage.textContent = msg || "";
  authMessage.classList.remove("error", "success");
  if (type) {
    authMessage.classList.add(type);
  }
}

function updateStatus(user) {
  const connected = Boolean(user);
  authStatus.textContent = user
    ? `Connecte: ${user.email || user.uid}`
    : "Non connecte";
  authStatus.classList.toggle("connected", connected);
  document.body.classList.toggle("auth-connected", connected);
  signInBtn.hidden = connected;
  signUpBtn.hidden = connected;
  googleBtn.hidden = connected;
  signOutBtn.hidden = !user;
  if (authFields) {
    authFields.hidden = connected;
  }
  if (authActions) {
    authActions.classList.toggle("signed-in", connected);
  }
  if (user) {
    userSummary.hidden = false;
    userSummary.textContent = `UID: ${user.uid} - ${user.email || "Compte sans email"}`;
  } else {
    userSummary.hidden = true;
    userSummary.textContent = "";
  }
}

async function run(action) {
  try {
    setBusy(true);
    setMsg("");
    await action();
    setMsg("Operation reussie.", "success");
  } catch (error) {
    setMsg(error?.message || "Erreur", "error");
  } finally {
    setBusy(false);
  }
}

async function boot() {
  await initFirebase();
  if (!isFirebaseEnabled()) {
    setMsg("Firebase non configure. Remplis firebase/config.js", "error");
    setBusy(true);
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
