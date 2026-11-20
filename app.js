import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const textBox = document.querySelector("#confession");
const postButton = document.querySelector("#postButton");
const message = document.querySelector("#formMessage");
const feed = document.querySelector("#feed");
const counter = document.querySelector("#counter");

textBox.addEventListener("input", () => counter.textContent = `${textBox.value.length} / 1000`);
const say = (text, error=false) => { message.textContent = text; message.classList.toggle("error", error); };

function getDeviceDetails() {
  const ua = navigator.userAgent || "";
  const platform = navigator.userAgentData?.platform || navigator.platform || "Unknown";
  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/CriOS|Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : platform;
  const details = {
    deviceType: /Mobi|Android|iPhone/i.test(ua) ? "Mobile" : "Desktop / tablet",
    browser, os,
    screen: `${screen.width} × ${screen.height}`,
    language: navigator.language || "Unknown",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
    model: "Not exposed by browser"
  };
  // Model is collected only when the browser voluntarily exposes it via UA Client Hints.
  if (navigator.userAgentData?.getHighEntropyValues) {
    return navigator.userAgentData.getHighEntropyValues(["model"]).then(v => {
      details.model = v.model || "Not exposed by browser";
      return details;
    }).catch(() => details);
  }
  return Promise.resolve(details);
}

function safeDate(value) {
  if (!value?.toDate) return "Just now";
  return value.toDate().toLocaleString([], {dateStyle:"medium", timeStyle:"short"});
}

async function loadFeed() {
  feed.innerHTML = '<div class="empty panel">Loading confessions…</div>';
  try {
    const q = query(collection(db, "confessions"), where("status", "==", "published"), orderBy("createdAt", "desc"), limit(100));
    const snap = await getDocs(q);
    if (snap.empty) {
      feed.innerHTML = '<div class="empty panel">No confessions yet. Be the first to post.</div>';
      return;
    }
    feed.replaceChildren();
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const card = document.createElement("article");
      card.className = "confession panel";
      const head = document.createElement("div"); head.className = "confession-head";
      const who = document.createElement("span"); who.className = "anonymous"; who.textContent = "Anonymous";
      const time = document.createElement("time"); time.className = "timestamp"; time.textContent = safeDate(d.createdAt);
      head.append(who,time);
      const body = document.createElement("p"); body.className = "confession-text"; body.textContent = d.text || "";
      card.append(head,body); feed.append(card);
    });
  } catch (e) {
    console.error(e);
    feed.innerHTML = '<div class="empty panel">Could not load confessions. Check Firebase setup and Firestore rules.</div>';
  }
}

postButton.addEventListener("click", async () => {
  const text = textBox.value.trim();
  if (text.length < 3) return say("Please write at least 3 characters.", true);
  if (text.length > 1000) return say("Your confession is too long.", true);
  postButton.disabled = true; say("Posting…");
  try {
    const details = await getDeviceDetails();
    const confessionRef = await addDoc(collection(db, "confessions"), {
      text, status: "published", createdAt: serverTimestamp()
    });
    // Private technical details are stored separately and are never readable by the public.
    await addDoc(collection(db, "submissionDetails"), {
      confessionId: confessionRef.id,
      anonymousId: crypto.randomUUID ? crypto.randomUUID() : `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      details, createdAt: serverTimestamp()
    });
    textBox.value = ""; counter.textContent = "0 / 1000";
    say("Your confession has been posted.");
    await loadFeed();
  } catch (e) {
    console.error(e);
    say("Couldn't post. Please try again later.", true);
  } finally { postButton.disabled = false; }
});

document.querySelector("#refreshButton").addEventListener("click", loadFeed);
loadFeed();
