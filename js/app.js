document.addEventListener("DOMContentLoaded", function () {
    const searchBtn = document.getElementById("search-btn");
    const locationInput = document.getElementById("search");
    const tripResults = document.getElementById("trip-results");
    const searchForm = document.getElementById("search-form"); // Grabs the search form
    const tripTitle = document.querySelector(".trip-container h1"); // Grabs "Random Trip"
    const tripSubtitle = document.querySelector(".trip-container p.find-place"); // Grabs "Find a place to visit"
    const imageContainer = document.querySelector(".image-container"); // Grabs the background image container

    // Ensure tripResults element exists
    if (!tripResults) {
        console.error("tripResults element not found in the document.");
        return;
    }

    // ✅ Ensures the floating menu stays visible
    setTimeout(() => {
        document.querySelector(".overlay-container").style.opacity = "1";
    }, 300);

    // Function to handle search
    function handleSearch() {
        let manualLocation = locationInput.value.trim().toLowerCase();

        fetch("data/states.json")
            .then(response => response.json())
            .then(states => {
                let userState = states.find(state =>
                    state.name.toLowerCase() === manualLocation || state.abbr.toLowerCase() === manualLocation
                );

                if (!userState) {
                    tripResults.innerHTML = `<p class='text-danger mt-2'>Please enter a valid location!</p>`;
                    return;
                }

                // ✅ Hide search form and title/subtitle
                searchForm.style.display = "none"; 
                tripTitle.style.display = "none";
                tripSubtitle.style.display = "none";

                // ✅ Display location details inside the floating menu
                tripResults.innerHTML = `
                    <h2>Your Random Trip</h2>
                    <div class="trip-details">
                        <p><strong>State:</strong> ${userState.name}</p>
                        <p><strong>Capital:</strong> ${userState.capital}</p>
                        <p><strong>Latitude:</strong> ${userState.lat}</p>
                        <p><strong>Longitude:</strong> ${userState.long}</p>
                    </div>
                    <button id="restart-btn" class="btn btn-secondary mt-3">Search Again</button>
                `;

                // ✅ Replace the background image with a map
                imageContainer.innerHTML = `
                    <iframe width="100%" height="400px" style="border-radius: 10px; border: none;"
                        src="https://www.openstreetmap.org/export/embed.html?bbox=${userState.long - 0.05},${userState.lat - 0.05},${userState.long + 0.05},${userState.lat + 0.05}&layer=mapnik&marker=${userState.lat},${userState.long}">
                    </iframe>
                `;

                // ✅ Allow user to search again (Restart Button)
                document.getElementById("restart-btn").addEventListener("click", function () {
                    searchForm.style.display = "block"; // Show the form again
                    tripTitle.style.display = "block"; // Show title
                    tripSubtitle.style.display = "block"; // Show subtitle
                    tripResults.innerHTML = ""; // Clear previous results
                    locationInput.value = ""; // Reset input

                    // ✅ Restore the background image when resetting search
                    imageContainer.innerHTML = `
                        <img class="img-fluid rounded-3 background-image" src="assets/steven-lewis-r4He4Btlsro-unsplash.jpg"
                            alt="Travel scene">
                    `;
                });
            })
            .catch(error => {
                console.error("Error loading locations:", error);
                tripResults.innerHTML = `<p class='text-danger'>Failed to load locations.</p>`;
            });
    }

    // Enable pressing "Enter" to trigger search
    locationInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            handleSearch();
        }
    });

    searchBtn.addEventListener("click", handleSearch);
});
