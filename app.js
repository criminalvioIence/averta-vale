const $ = id => document.getElementById(id);

let timer = null, done = 0, target = 0;

const alertAudio = new Audio("./assets/alert-tone.mp3");
alertAudio.preload = "auto";

const PUSH_SERVER = "https://shopify-push.austinmhanzel.workers.dev";

let firstNames = [];
let lastNames = [];
const recentNames = [];

async function loadNameList(file) {
  const response = await fetch(`./${file}`);

  if (!response.ok) {
    throw new Error(`Could not load ${file}`);
  }

  const csv = await response.text();

  return csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(1)
    .map(name => name.trim())
    .filter(Boolean);
}

async function loadNames() {
  const [first, last] = await Promise.all([
    loadNameList("first_names.csv"),
    loadNameList("last_names.csv")
  ]);

  firstNames = first;
  lastNames = last;

  console.log(
    `Loaded ${firstNames.length} first names and ${lastNames.length} last names.`
  );
}

const namesReady = loadNames();

function generateName() {
  if (firstNames.length === 0 || lastNames.length === 0) {
    throw new Error("Name lists are empty.");
  }

  let name;
  let attempts = 0;

  do {
    const first =
      firstNames[Math.floor(Math.random() * firstNames.length)];

    const last =
      lastNames[Math.floor(Math.random() * lastNames.length)];

    name = `${first} ${last}`;
    attempts++;

  } while (
    recentNames.includes(name) &&
    attempts < 100
  );

  recentNames.push(name);

  if (recentNames.length > 25) {
    recentNames.shift();
  }

  return name;
}

const money = c =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(c / 100);

function status(on) {
  $("statusDot").classList.toggle("on", on);
  $("status").textContent = on
    ? `Running · ${done}/${target}`
    : `Stopped · ${done} generated`;
}

function decodeKey(key) {
  const padding = "=".repeat((4 - key.length % 4) % 4);
  const base64 = (key + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  return Uint8Array.from(
    atob(base64),
    c => c.charCodeAt(0)
  );
}

async function enablePush() {
  if (!("serviceWorker" in navigator) ||
      !("PushManager" in window)) {
    throw new Error("Push notifications are not supported here.");
  }

  const registration =
    await navigator.serviceWorker.register("./sw.js");

  const permission = await Notification.requestPermission();

  
if (permission !== "granted") {
  alert("Permission check failed: " + permission);
  throw new Error("Notification permission was not granted.");
}

  const keyResponse = await fetch(
    `${PUSH_SERVER}/vapid-public`
  );

  if (!keyResponse.ok) {
    throw new Error("Could not retrieve the push key.");
  }

  const { publicKey } = await keyResponse.json();


let subscription;

try {
  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeKey(publicKey)
  });

} catch (error) {
  alert("Subscription error: " + error.name + "\n" + error.message);
  throw error;
}

  const response = await fetch(`${PUSH_SERVER}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(subscription)
  });


  if (!response.ok) {
    throw new Error("Could not save the push subscription.");
  }

  return true;
}

function addOne() {
  const lo = Math.round(Number($("min").value) * 100);
  const hi = Math.round(Number($("max").value) * 100);

  const cents = lo + Math.floor(Math.random() * (hi - lo + 1));

  const items = 1 + Math.floor(Math.random() * 3);

  const name = generateName();

  const source = Math.random() < 0.82
    ? "Online Store"
    : "Social";

  const now = new Date();

  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
  
  const row = document.createElement("div");
  row.className = "item";

  const bag = document.createElement("div");
  bag.className = "bag";
  bag.textContent = "▱";

  const details = document.createElement("div");
  details.className = "details";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = "Shopify";

  const meta = document.createElement("div");
  meta.className = "meta";

  meta.textContent =
    `${name} · ${items} ${items === 1 ? "item" : "items"} · ${time} · ${source}`;

  details.append(title, meta);

  const total = document.createElement("div");
  total.className = "total";
  total.textContent = money(cents);

  row.append(bag, details, total);

  $("feed").prepend(row);

  $("feed").querySelector(".empty")?.remove();

if ("Notification" in window &&
    Notification.permission === "granted") {
  try {
    new Notification("Shopify", {
      body: `${name} has a new order for ${items} ${items === 1 ? "item" : "items"} totaling ${money(cents)} from Online Store.`,
      icon: "./icon.svg"
    });
  } catch (e) {
    console.error("Notification error:", e);
  }
}

  done++;
  status(true);

  if (document.visibilityState === "visible") {
    alertAudio.currentTime = 0;
    alertAudio.play().catch(() => {});
  }

  if (done >= target) stop();
}

function stop() {
  if (timer !== null) clearTimeout(timer);

  timer = null;

  $("start").disabled = false;
  $("stop").disabled = true;

  status(false);
}

function next() {
  if (timer === null) return;

  addOne();

  if (timer !== null) {
    timer = setTimeout(
      next,
      Number($("speed").value) * 1000
    );
  }
}

$("start").addEventListener("click", async () => {
  const n = Number($("count").value);
  const a = Number($("min").value);
  const b = Number($("max").value);

  if (!Number.isInteger(n) || n < 1 || n > 100) {
    alert("Choose 1–100 alerts.");
    return;
  }

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    a <= 0 ||
    b > 360 ||
    a > b
  ) {
    alert("Set a valid range, with a maximum of $360.00.");
    return;
  }

  try {
    await namesReady;
  } catch (error) {
    console.error("Name loading error:", error);
    alert("Could not load the name lists. Please refresh the app.");
    return;
  }

  try {
    if ("Notification" in window) {
      await enablePush();
    }
  } catch (error) {
    console.error("Push setup:", error);
    alert("Push setup failed: " + error.message);
    return;
  }

  done = 0;
  target = n;

  $("feed").innerHTML = "";

  $("start").disabled = true;
  $("stop").disabled = false;

  status(true);

  timer = setTimeout(next, 450);
});
