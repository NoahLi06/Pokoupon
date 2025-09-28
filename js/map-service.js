// js/map-service.js

let map;
let userMarker;
let placesService;

/**
 * This function is now the GLOBAL CALLBACK for the Google Maps script.
 * It must be attached to the window object to be accessible.
 */
window.initMap = () => {
  const annArbor = { lat: 42.2808, lng: -83.743 };

  // Create the map, centered on a default location first
  map = new google.maps.Map(document.getElementById("map"), {
    center: annArbor,
    zoom: 15,
    disableDefaultUI: true, // A cleaner look for our game UI
    styles: [ /* Optional: Add custom map styles here for a retro look */ ]
  });

  // Initialize the Places Service, which we'll use to find businesses
  placesService = new google.maps.places.PlacesService(map);

  // Now, try to get the user's actual location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.setCenter(userLocation);
        // Add a marker at the user's location
        userMarker = new google.maps.Marker({
          position: userLocation,
          map: map,
          title: "You are here!",
        });
      },
      () => {
        // Handle location denial - map is already centered on Ann Arbor
        console.warn("User denied location access.");
      }
    );
  }
};

/**
 * Maps a Google Place Type to our game's internal category system.
 * @param {string[]} types - An array of types from a Google Place result.
 * @returns {string} - Our internal category (e.g., "dining").
 */
const mapGooglePlaceTypeToCategory = (types) => {
  if (types.includes("restaurant") || types.includes("cafe") || types.includes("bar") || types.includes("meal_takeaway")) return "dining";
  if (types.includes("grocery_or_supermarket") || types.includes("supermarket")) return "groceries";
  if (types.includes("gas_station")) return "gas";
  if (types.includes("movie_theater") || types.includes("amusement_park")) return "entertainment";
  return "other";
};

/**
 * Finds the nearest business to the center of the map.
 */
export const fetchBusinessAtLocation = () => {
  return new Promise((resolve, reject) => {
    if (!map || !placesService) return reject("Map or Places service not ready.");

    const request = {
      location: map.getCenter(),
      rankBy: google.maps.places.RankBy.DISTANCE, // Find the absolute closest places
    };

    placesService.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const closestPlace = results[0];
        const business = {
          name: closestPlace.name,
          category: mapGooglePlaceTypeToCategory(closestPlace.types),
        };
        resolve(business);
      } else {
        reject("Could not find any places nearby.");
      }
    });
  });
};