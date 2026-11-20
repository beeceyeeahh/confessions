import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginMessage = document.querySelector("#loginMessage");
const adminFeed = document.querySelector("#adminFeed");

document.querySelector("#loginButton").addEventListener("click", async () => {
  loginMessage.textContent = "Signing in…"; loginMessage.classList.remove("error");
  const email = document.querySelector("#email").value.trim().toLowerCase();
  const password = document.querySelector("#password").value;
  if (email !== ADMIN_EMAIL.toLowerCase()) {
    loginMessage.textContent = "This account is not authorized."; loginMessage.classList.add("error"); return;
  }
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch (e) { loginMessage.textContent = "Sign-in failed. Check your email and password."; loginMessage.classList.add("error"); }
});
document.querySelector("#logoutButton").addEventListener("click", () => signOut(auth));
onAuthStateChanged(auth, user => {
  const allowed = !!user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  loginPanel.hidden = allowed;
  dashboard.hidden = !allowed;
  if (user && !allowed) signOut(auth);
  if (allowed) { document.querySelector("#signedInAs").textContent = `Signed in as ${user.email}`; loadAdmin(); }
});

const esc = s => String(s ?? "Not available");
function makeMeta(label, value) {
  const el = document.createElement("div"); el.className = "meta-item";
  const b = document.createElement("b"); b.textContent = `${label}: `;
  el.append(b, document.createTextNode(esc(value))); return el;
}
async function loadAdmin() {
  adminFeed.innerHTML = '<div class="empty panel">Loading submissions…</div>';
  try {
    const [confSnap, detailSnap] = await Promise.all([
      getDocs(query(collection(db,"confessions"), orderBy("createdAt","desc"))),
      getDocs(collection(db,"submissionDetails"))
    ]);
    const detailsById = new Map();
    detailSnap.forEach(s => { const d=s.data(); detailsById.set(d.confessionId,d); });
    document.querySelector("#totalCount").textContent = confSnap.size;
    let visible=0, hidden=0;
    confSnap.forEach(s => s.data().status === "published" ? visible++ : hidden++);
    document.querySelector("#visibleCount").textContent = visible;
    document.querySelector("#hiddenCount").textContent = hidden;
    if (confSnap.empty) { adminFeed.innerHTML='<div class="empty panel">No submissions yet.</div>'; return; }
    adminFeed.replaceChildren();
    confSnap.forEach(s => {
      const d=s.data(), extra=detailsById.get(s.id) || {}, tech=extra.details || {};
      const card=document.createElement("article"); card.className="admin-card panel";
      const head=document.createElement("div"); head.className="confession-head";
      const who=document.createElement("span"); who.className="anonymous"; who.textContent="Anonymous";
      const status=document.createElement("span"); status.className="status"; status.textContent=d.status || "unknown";
      head.append(who,status);
      const body=document.createElement("p"); body.className="confession-text"; body.textContent=d.text || "";
      const time=document.createElement("p"); time.className="timestamp"; time.textContent=d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : "Time unavailable";
      const meta=document.createElement("div"); meta.className="admin-meta";
      meta.append(
        makeMeta("Anonymous ID",extra.anonymousId || "Unavailable"),
        makeMeta("Device",tech.deviceType),
        makeMeta("Phone model",tech.model),
        makeMeta("Operating system",tech.os),
        makeMeta("Browser",tech.browser),
        makeMeta("Screen",tech.screen),
        makeMeta("Language",tech.language),
        makeMeta("Time zone",tech.timezone),
        makeMeta("IP address","Not collected")
      );
      const actions=document.createElement("div"); actions.className="admin-actions";
      const toggle=document.createElement("button"); toggle.className="small-button"; toggle.textContent=d.status==="published"?"Hide":"Publish";
      toggle.addEventListener("click",async()=>{ await updateDoc(doc(db,"confessions",s.id),{status:d.status==="published"?"hidden":"published"}); loadAdmin(); });
      const remove=document.createElement("button"); remove.className="small-button danger"; remove.textContent="Delete";
      remove.addEventListener("click",async()=>{
        if(!confirm("Delete this confession and its technical details?")) return;
        await deleteDoc(doc(db,"confessions",s.id));
        const detailQuery=await getDocs(query(collection(db,"submissionDetails"),where("confessionId","==",s.id)));
        await Promise.all(detailQuery.docs.map(x=>deleteDoc(x.ref)));
        loadAdmin();
      });
      actions.append(toggle,remove);
      card.append(head,body,time,meta,actions); adminFeed.append(card);
    });
  } catch(e) {
    console.error(e);
    adminFeed.innerHTML='<div class="empty panel">Could not load admin data. Check Firestore rules and indexes.</div>';
  }
}
document.querySelector("#adminRefresh").addEventListener("click",loadAdmin);
