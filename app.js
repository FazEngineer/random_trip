const WEATHER_API_KEY = "ceb427425e0440f2d74b38e75d4ec4d3";
const slider = document.getElementById("slider");
const selectValue = document.getElementById("selectValue");
const searchBtn = document.getElementById("search-btn");
const resetBtn = document.getElementById("reset-btn");
const locationInput = document.getElementById("search");
const tripResults = document.getElementById("trip-results");
const heroImage = document.getElementById("hero-image");
const mapContainer = document.getElementById("map-container");

const cache = {
  weather: new Map(),
  settlements: new Map()
};

slider.addEventListener("input", () => selectValue.textContent = slider.value);
selectValue.textContent = slider.value;

// Leaflet map
let map;
function initMap(lat, lon, zoom = 8) {
  if (!map) {
    mapContainer.innerHTML = "<div id='map'></div>";
    map = L.map('map', {
      center: [lat, lon],
      zoom: zoom,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1
    }).addTo(map);

    // Force a resize after initialization
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  } else {
    map.setView([lat, lon], zoom);
    // Force a resize after view change
    map.invalidateSize();
  }
}

// Haversine
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Detect location
function detectLocation() {
  return new Promise((res, rej) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), rej);
    } else rej(new Error("Geolocation not supported."));
  });
}

// Nominatim geocode
async function geocode(q) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { 'User-Agent': 'RandomTrip' } }); const j = await r.json();
  if (!j.length) throw new Error("Place not found.");
  return { lat: parseFloat(j[0].lat), lon: parseFloat(j[0].lon) };
}

// Overpass settlements query
async function settlementsAround(lat, lon, km) {
  // Remove the radius cap
  const radius = km * 1000; // Convert km to meters

  const query = `[out:json][timeout:180];  // Increased timeout for larger searches
  (
    node(around:${radius},${lat},${lon})[place~"city|town|village"];
    way(around:${radius},${lat},${lon})[place~"city|town|village"];
  );
  out center;`;

  try {
    const url = "https://overpass-api.de/api/interpreter";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query
    });

    if (!res.ok) {
      throw new Error(`Search failed. Please try again.`);
    }

    const data = await res.json();

    if (!data.elements || data.elements.length === 0) {
      throw new Error(`No places found within ${km} km. Try a different location or radius.`);
    }

    const places = data.elements
      .filter(n => n.tags && n.tags.name)
      .map(n => ({
        name: n.tags.name,
        lat: n.lat || n.center.lat,
        lon: n.lon || n.center.lon,
        dist: haversine(lat, lon, n.lat || n.center.lat, n.lon || n.center.lon)
      }))
      .filter(place => place.dist <= km) // Keep only places within requested distance
      .sort((a, b) => b.dist - a.dist); // Sort by distance, furthest first

    if (places.length === 0) {
      throw new Error(`No destinations found within ${km} km. Try a different radius.`);
    }

    // Take a random place from the full range of distances
    return places;
  } catch (error) {
    console.error('Settlement search error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }
}

// Update weather function with caching
async function weather(lat, lon) {
  const key = `${lat},${lon}`;
  const cacheTime = 5 * 60 * 1000; // 5 minutes

  // Check cache
  if (cache.weather.has(key)) {
    const cached = cache.weather.get(key);
    if (Date.now() - cached.timestamp < cacheTime) {
      return cached.data;
    }
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`;
  const data = await fetch(url).then(r => r.json());

  // Store in cache
  cache.weather.set(key, {
    timestamp: Date.now(),
    data: data
  });

  return data;
}

// Reset UI
function resetUI() {
  heroImage.classList.remove("d-none");
  mapContainer.classList.add("d-none");
  document.getElementById("initial-menu").classList.remove("d-none");
  document.getElementById("results-menu").classList.add("d-none");
  tripResults.innerHTML = "";
}

function showLoading() {
  tripResults.innerHTML = `
    <div class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Finding your random destination...</p>
    </div>
  `;
}

async function retry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 1.5);
  }
}

// Search handler
searchBtn.addEventListener("click", async () => {
  searchBtn.disabled = true;
  showLoading();

  try {
    // Get location
    let origin;
    try {
      const q = locationInput.value.trim();
      if (!q) throw new Error("Please enter a location.");
      origin = await geocode(q);
    } catch (e) {
      throw new Error(`Location error: ${e.message}`);
    }

    const km = parseInt(slider.value);

    // Initialize map first
    heroImage.classList.add("d-none");
    mapContainer.classList.remove("d-none");

    // Initialize the map with the origin location
    if (!map) {
      initMap(origin.lat, origin.lon, 8);
    } else {
      map.setView([origin.lat, origin.lon], 8);
    }

    // Get settlements
    const places = await settlementsAround(origin.lat, origin.lon, km);

    if (!places.length) {
      throw new Error(`No destinations found within ${km} km. Try a different radius.`);
    }

    // Pick a truly random destination from all available places
    const dest = places[Math.floor(Math.random() * places.length)];

    // Get weather and update UI
    const w = await weather(dest.lat, dest.lon);

    // Update map view and add marker
    map.setView([dest.lat, dest.lon], 10);
    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    L.marker([dest.lat, dest.lon]).addTo(map).bindPopup(dest.name).openPopup();

    // Switch menus
    document.getElementById("initial-menu").classList.add("d-none");
    document.getElementById("results-menu").classList.remove("d-none");

    // Update results
    tripResults.innerHTML = `
      <p><strong>Destination:</strong> ${dest.name}</p>
      <p><strong>Distance:</strong> ${dest.dist.toFixed(1)} km</p>
      <p><strong>Weather:</strong> ${w.weather ? w.weather[0].description : "N/A"}, ${w.main ? w.main.temp + "°C" : "--"}</p>
    `;

    // Ensure map is properly sized
    map.invalidateSize();

  } catch (e) {
    tripResults.innerHTML = `
      <div class="alert alert-danger" role="alert">
        ${e.message}
      </div>
    `;
    // Reset UI on error
    heroImage.classList.remove("d-none");
    mapContainer.classList.add("d-none");
  } finally {
    searchBtn.disabled = false;
  }
});

// Reset button
resetBtn.addEventListener("click", resetUI);
