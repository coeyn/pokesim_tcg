// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAieng4284Yg6KEnMY30pSV5WRBkpAIJdo",
  authDomain: "pokesimtcg.firebaseapp.com",
  projectId: "pokesimtcg",
  storageBucket: "pokesimtcg.firebasestorage.app",
  messagingSenderId: "246061902483",
  appId: "1:246061902483:web:502a6bd7cbd4123a693b66",
  measurementId: "G-J3H7LC9ENB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);