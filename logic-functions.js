// logic-functions.js

let map;
let userMarker;       // google.maps.marker.AdvancedMarkerElement
let accuracyCircle;   // google.maps.Circle
let geocoder;
let watchId;

// ----- Helpers -----
const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");

function setError(msg) {
  const box = $("#error-message");
  box.textContent = msg || "";
  if (msg) show(box);
  else hide(box);
}

function updateLocationInfo(text) {
  $("#location-name").textContent = text || "";
  if (text) show($("#location-info-area"));
  else hide($("#location-info-area"));
}

function getLatLngFromPosition(pos) {
  // AdvancedMarkerElement.position can be LatLng or {lat:number,lng:number}
  if (!pos) return null;
  if (typeof pos.lat === "function") return { lat: pos.lat(), lng: pos.lng() };
  return { lat: pos.lat, lng: pos.lng };
}

// ----- Cardballs (pre-populated) -----
const availableCards = [
  { id: "visa", name: "Visa **** 1234" },
  { id: "mc", name: "Mastercard **** 5678" },
  { id: "amex", name: "AmEx **** 9876" },
  { id: "disc", name: "Discover **** 4321" },
];

let wallet = [
  { id: "visa", name: "Visa **** 1234" }, // preloaded
];

function renderWallet() {
  const container = $("#wallet-cards");
  container.innerHTML = "";

  if (wallet.length === 0) {
    container.innerHTML = "<p class='text-sm'>No Cardballs yet.</p>";
    return;
  }

  wallet.forEach((card) => {
    const div = document.createElement("div");
    div.className = "pixel-border p-2 flex justify-between items-center";
    div.innerHTML = `
      <span>${card.name}</span>
      <button class="text-xs underline remove-card" data-id="${card.id}">Remove</button>
    `;
    container.appendChild(div);
  });

  // Remove handlers
  container.querySelectorAll(".remove-card").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      wallet = wallet.filter((c) => c.id !== id);
      renderWallet();
      renderModalCardList();
    });
  });
}

function renderModalCardList() {
  const select = $("#add-card-select");
  select.innerHTML = "";

  const options = availableCards.filter((c) => !wallet.find((w) => w.id === c.id));
  if (options.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "All Cardballs added";
    select.appendChild(opt);
    select.disabled = true;
  } else {
    select.disabled = false;
    options.forEach((card) => {
      const opt = document.createElement("option");
      opt.value = card.id;
      opt.textContent = card.name;
      select.appendChild(opt);
    });
  }
}

// ----- Map / Geolocation -----
function setUserMarker(latLng, accuracyMeters = 50) {
  if (!userMarker) {
    userMarker = new google.maps.marker.AdvancedMarkerElement({
      position: latLng,
      map,
      title: "You are here",
    });
  } else {
    userMarker.position = latLng;
  }

  const radius = Math.min(Math.max(accuracyMeters, 5), 200);
  if (!accuracyCircle) {
    accuracyCircle = new google.maps.Circle({
      map,
      strokeOpacity: 0.2,
      strokeWeight: 1,
      fillOpacity: 0.06,
      center: latLng,
      radius,
    });
  } else {
    accuracyCircle.setCenter(latLng);
    accuracyCircle.setRadius(radius);
  }
}

async function reverseGeocode(latLng) {
  if (!geocoder) geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ location: latLng }, (results, status) => {
      if (status === "OK" && results && results.length) resolve(results[0].formatted_address);
      else resolve("");
    });
  });
}

function onGeoSuccess(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const latLng = { lat: latitude, lng: longitude };

  setError("");
  setUserMarker(latLng, accuracy);

  if (map.getZoom() < 16) map.setZoom(17);
  map.setCenter(latLng);

  reverseGeocode(latLng).then((addr) => {
    updateLocationInfo(addr || `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`);
  });
}

function onGeoError(err) {
  const fallback = { lat: 42.2808, lng: -83.7430 }; // Ann Arbor fallback
  setError(`Geolocation error: ${err.message}. Using a fallback location.`);
  map.setCenter(fallback);
  map.setZoom(13);
  setUserMarker(fallback, 100);
  updateLocationInfo("");
}

function startGeoWatch() {
  if (!navigator.geolocation) {
    setError("Geolocation is not supported by your browser.");
    return;
  }
  const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

  navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, options);
  watchId = navigator.geolocation.watchPosition(onGeoSuccess, onGeoError, {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });
}

// ----- UI -----
function initUI() {
  // Wallet modal
  $("#manage-wallet-btn")?.addEventListener("click", () => {
    renderModalCardList();
    show($("#wallet-modal"));
  });
  $("#close-modal-btn")?.addEventListener("click", () => hide($("#wallet-modal")));

  $("#add-card-btn")?.addEventListener("click", () => {
    const select = $("#add-card-select");
    const id = select.value;
    const card = availableCards.find((c) => c.id === id);
    if (card && !wallet.find((w) => w.id === id)) {
      wallet.push(card);
      renderWallet();
      renderModalCardList();
    }
  });

  // Capture button
  $("#capture-deal-btn")?.addEventListener("click", () => {
    const pos = getLatLngFromPosition(userMarker?.position);
    if (!pos) {
      setError("Can't capture yet — location not available.");
      return;
    }
    setError("");
    alert(`Deal captured at ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
  });

  // Initial wallet render
  renderWallet();
}

// ----- Google Maps entrypoint (called by script callback) -----
window.initMap = async function initMap() {
  try {
    // Ensure required libraries are loaded before use
    const { Map } = await google.maps.importLibrary("maps");
    await google.maps.importLibrary("marker"); // provides google.maps.marker.AdvancedMarkerElement

    map = new Map(document.getElementById("map"), {
      center: { lat: 0, lng: 0 },
      zoom: 3,
      disableDefaultUI: true,
      mapTypeId: "roadmap",
      gestureHandling: "greedy",
    });

    initUI();
    startGeoWatch();
  } catch (e) {
    setError("Failed to load Google Maps. Check your API key and enabled APIs.");
    console.error(e);
  }
};
