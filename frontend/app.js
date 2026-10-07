"use strict";

/*
============================================================
VOYARA FRONTEND
============================================================
*/


// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE = "https://voyara-backend-cwik.onrender.com";


// ============================================================
// APPLICATION STATE
// ============================================================

let currentItinerary = "";
let currentProfile = {};
let lastTripRequest = null;
let mapInstance = null;


// ============================================================
// DOM HELPERS
// ============================================================

function $(id) {
  return document.getElementById(id);
}

function showElement(element) {
  if (element) {
    element.classList.remove("hidden");
  }
}

function hideElement(element) {
  if (element) {
    element.classList.add("hidden");
  }
}

function setText(id, text) {
  const element = $(id);

  if (element) {
    element.textContent = text;
  }
}


// ============================================================
// LOCAL STORAGE
// ============================================================

function getSavedJourneys() {
  try {
    return JSON.parse(
      localStorage.getItem("voyaraJourneys") || "[]"
    );
  } catch (error) {
    console.error("Could not read saved journeys:", error);
    return [];
  }
}

function saveJourneys(journeys) {
  localStorage.setItem(
    "voyaraJourneys",
    JSON.stringify(journeys)
  );
}

function getMemories() {
  try {
    return JSON.parse(
      localStorage.getItem("voyaraMemories") || "[]"
    );
  } catch (error) {
    return [];
  }
}

function saveMemories(memories) {
  localStorage.setItem(
    "voyaraMemories",
    JSON.stringify(memories)
  );
}


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initializeVoyara();
});

function initializeVoyara() {
  bindNavigation();
  bindWelcomeScreen();
  bindPlanner();
  bindItineraryActions();
  bindProfileMenu();
  bindExploreFinal();
  bindRecommendationsFinal();
  bindScrapbook();
  bindTrips();
  bindGlobalButtons();

  renderSavedJourneys();
  renderTrips();
  renderScrapbook();
  updateHomeStats();

  const savedName = localStorage.getItem("voyaraUserName");

  if (savedName) {
    showApplication();
  } else {
    showWelcomeScreen();
  }
}


// ============================================================
// WELCOME SCREEN
// ============================================================

function bindWelcomeScreen() {
  const nameForm = $("nameForm");

  if (nameForm) {
    nameForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const nameInput = $("nameInput");
      const name = nameInput
        ? nameInput.value.trim()
        : "";

      if (!name) {
        alert("Please enter your name.");
        return;
      }

      const emailInput = $("emailInput");
      const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("Please enter a valid email address.");
        return;
      }
      if (typeof voyaraLoadAccountData === "function") voyaraLoadAccountData(email, name);
      localStorage.setItem("voyaraUserName", name);
      if (email) localStorage.setItem("voyaraUserEmail", email);
      showApplication();
    });
  }

  const googleSignInButton = $("googleSignInBtn");

  if (googleSignInButton) {
    googleSignInButton.addEventListener("click", () => {
      const name = prompt(
        "Enter your name to continue with Voyara:"
      );

      if (name && name.trim()) {
        localStorage.setItem(
          "voyaraUserName",
          name.trim()
        );

        showApplication();
      }
    });
  }
}

function showWelcomeScreen() {
  const welcomeScreen = $("welcomeScreen");
  const application = $("app");

  showElement(welcomeScreen);
  hideElement(application);
}

function showApplication() {
  const welcomeScreen = $("welcomeScreen");
  const application = $("app");

  hideElement(welcomeScreen);
  showElement(application);

  const name = localStorage.getItem("voyaraUserName");

  if (name) {
    setText("profileName", name);
    setText("profileInitial", name.charAt(0).toUpperCase());
    setText("userGreeting", name);
    setText("homeUserName", name);
  }

  showSection("home");
  updateHomeStats();
}


// ============================================================
// NAVIGATION
// ============================================================

function bindNavigation() {
  document.addEventListener("click", (event) => {
    // Support both the top navigation (data-section) and homepage cards (data-target).
    const navigationButton = event.target.closest(
      "[data-section], [data-target]"
    );

    if (!navigationButton) {
      return;
    }

    const sectionName =
      navigationButton.dataset.section ||
      navigationButton.dataset.target;

    if (!sectionName) {
      return;
    }

    event.preventDefault();
    showSection(sectionName);
  });
}

function showSection(sectionName) {
  const sections = document.querySelectorAll(
    ".page-section"
  );

  sections.forEach((section) => {
    section.classList.remove("active-section");
  });

  const targetSection = $(
    `section-${sectionName}`
  );

  if (targetSection) {
    targetSection.classList.add("active-section");
  }

  const navigationButtons = document.querySelectorAll(
    "[data-section]"
  );

  navigationButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.section === sectionName
    );
  });

  if (sectionName === "trips") {
    renderTrips();
  }

  if (sectionName === "scrapbook") {
    renderScrapbook();
  }

  if (sectionName === "explore") {
    initializeMap();
  }
}


// ============================================================
// GLOBAL BUTTONS
// ============================================================

function bindGlobalButtons() {
  const newJourneyButton = $("newJourneyBtn");

  if (newJourneyButton) {
    newJourneyButton.addEventListener("click", () => {
      resetPlanner();
      showSection("planner");
    });
  }

  const heroPlanButton = $("heroPlanBtn");

  if (heroPlanButton) {
    heroPlanButton.addEventListener("click", () => {
      showSection("planner");
    });
  }

  const startPlanningButton = $("startPlanningBtn");

  if (startPlanningButton) {
    startPlanningButton.addEventListener("click", () => {
      showSection("planner");
    });
  }
}


// ============================================================
// PLANNER
// ============================================================

function bindPlanner() {
  const tripForm = $("tripForm");

  if (tripForm) {
    tripForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      await createItinerary();
    });
  }

  const quickIdeaButtons = document.querySelectorAll(
    "[data-preference], [data-prompt]"
  );

  quickIdeaButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const preferences = $("preferences");

      if (preferences) {
        preferences.value =
          button.dataset.preference ||
          button.dataset.prompt ||
          button.textContent.trim();
        preferences.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });
}

function getPlannerFormData() {
  return {
    destination: $("destination")
      ? $("destination").value.trim()
      : "",

    startingLocation: $("startingLocation")
      ? $("startingLocation").value.trim()
      : "",

    days: $("days") && $("days").value
      ? `${$("days").value} ${$("durationUnit")?.value || "days"}`
      : "",

    people: $("people") && $("people").value
      ? `${$("people").value} ${Number($("people").value) === 1 ? "person" : "people"}`
      : "",

    budget: $("budget")
      ? $("budget").value.trim()
      : "",

    travelMonth: $("travelMonth")
      ? $("travelMonth").value
      : "",

    preferences: $("preferences")
      ? $("preferences").value.trim()
      : ""
  };
}

function validateTripData(data) {
  if (!data.destination) {
    alert("Please enter a destination.");
    return false;
  }

  if (!data.days) {
    alert("Please select the trip duration.");
    return false;
  }

  return true;
}

function createUserPrompt(data) {
  return `
Plan a trip to ${data.destination}.

Starting location: ${
    data.startingLocation || "Not specified"
  }

Duration: ${data.days}
Travellers: ${data.people || "Not specified"}
Approximate budget: ${
    data.budget || "Not specified"
  }
Travel month: ${
    data.travelMonth || "Not specified"
  }

Preferences:
${data.preferences || "General sightseeing, food, and relaxation"}

Create a practical itinerary with food, transport, approximate costs, and useful travel tips. If the duration is in hours, organise the plan into concise time blocks; if it is in days, organise it day by day.
`;
}

async function createItinerary() {
  const data = getPlannerFormData();

  if (!validateTripData(data)) {
    return;
  }

  const prompt = createUserPrompt(data);

  lastTripRequest = data;
  currentProfile = data;

  const submitButton = $("tripForm")
    ? $("tripForm").querySelector(
        'button[type="submit"]'
      )
    : null;

  const plannerStatus = $("plannerStatus");
  const plannerLoading = $("plannerLoading");
  const itineraryContainer = $("itineraryContainer");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Creating itinerary...";
  }

  if (plannerStatus) {
    plannerStatus.textContent =
      "Voyara is creating your itinerary...";
    showElement(plannerStatus);
  }

  showElement(plannerLoading);

  if (itineraryContainer) {
    hideElement(itineraryContainer);
  }

  try {
    let result = null;
    let lastError = null;

    // Render can take a moment to wake the free backend. Give the first
    // request enough time, then retry once instead of immediately showing
    // "Failed to fetch".
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      try {
        const response = await fetch(
          `${API_BASE}/api/plan`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              message: prompt,
              ...data
            }),
            signal: controller.signal
          }
        );

        clearTimeout(timeout);
        const dataResult = await response.json();

        if (!response.ok || !dataResult.success) {
          throw new Error(
            dataResult.error ||
            "Unable to create the itinerary."
          );
        }

        result = dataResult;
        break;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (attempt === 1) {
          if (plannerStatus) {
            plannerStatus.textContent =
              "Waking Voyara's travel engine and trying again...";
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    if (!result) {
      throw lastError || new Error("Unable to reach the Voyara backend.");
    }

    currentItinerary = result.itinerary || "";
    currentProfile = result.profile || data;

    displayItinerary(currentItinerary);

    if (plannerStatus) {
      plannerStatus.textContent =
        "Your itinerary is ready.";
    }

  } catch (error) {
    console.error("Itinerary error:", error);

    if (plannerStatus) {
      plannerStatus.textContent =
        error.message ||
        "Something went wrong. Please try again.";
    }

    alert(
      error.message ||
      "Unable to create itinerary."
    );

  } finally {
    hideElement(plannerLoading);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        "Create my itinerary  →";
    }
  }
}

function voyaraInlineFormat(text) {
  let value = escapeHtml(text || "");
  value = value.replace(/\\([#*_\-])/g, "$1");
  value = value.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/__(.+?)__/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
  return value;
}

function renderVoyaraItinerary(markdown) {
  const source = String(markdown || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^```(?:markdown|md|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/\\([#*_\-])/g, "$1");
  const lines = source.split("\n");
  const html = [];
  let listType = null;

  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  const cleanHeading = (value) => value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^#{1,6}([^#\s])/, "$1")
    .replace(/\s*#+\s*$/, "")
    .replace(/^[*_]+\s*/, "")
    .replace(/\s*[*_]+$/, "")
    .trim();

  const isSectionHeading = (value) => {
    const clean = cleanHeading(value).replace(/\s+/g, " ").trim();
    return /^(trip overview|quick summary|day[- ]by[- ]day itinerary|time-block itinerary|local food to try|food to try|getting around & where to stay|transport and stay|useful tips|important tips|packing|budget|notes)$/i.test(clean)
      || /^[A-Z][A-Z &'/-]{4,}$/.test(clean);
  };

  for (const raw of lines) {
    let line = raw.trim();
    if (!line || /^[-_]{3,}$/.test(line)) { closeList(); continue; }

    line = line.replace(/^#{1,6}\s*/, "").replace(/^#{1,6}([^#\s])/, "$1").trim();
    const dayMatch = line.match(/^[*_\s]*(?:day|Day)\s*(\d+)\s*(?:[:—-]\s*)?(.*?)[*_\s]*$/i);
    if (dayMatch) {
      closeList();
      const title = dayMatch[2] ? `Day ${dayMatch[1]} — ${cleanHeading(dayMatch[2])}` : `Day ${dayMatch[1]}`;
      html.push(`<h3 class="voyara-day-heading">${voyaraInlineFormat(title)}</h3>`);
      continue;
    }

    const cleaned = cleanHeading(line);
    if (/^day\s*\d+/i.test(cleaned)) {
      const match = cleaned.match(/^day\s*(\d+)\s*(?:[:—-]\s*)?(.*)$/i);
      closeList();
      html.push(`<h3 class="voyara-day-heading">${voyaraInlineFormat(match[2] ? `Day ${match[1]} — ${match[2]}` : `Day ${match[1]}`)}</h3>`);
      continue;
    }

    const headingWasPresent = /^#{1,6}/.test(raw.trim()) || /^[*_]{2}[^*_]+[*_]$/.test(raw.trim());
    if (headingWasPresent || isSectionHeading(cleaned)) {
      closeList();
      html.push(`<h3 class="voyara-section-heading">${voyaraInlineFormat(cleaned)}</h3>`);
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      if (listType !== "ul") { closeList(); html.push("<ul>"); listType = "ul"; }
      html.push(`<li>${voyaraInlineFormat(bullet[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      if (listType !== "ol") { closeList(); html.push("<ol>"); listType = "ol"; }
      html.push(`<li>${voyaraInlineFormat(ordered[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${voyaraInlineFormat(line)}</p>`);
  }
  closeList();
  return html.join("\n");
}

function displayItinerary(itinerary) {
  const itineraryContainer = $("itineraryContainer");
  const itineraryText = $("itineraryText");
  const itineraryPreview = $("itineraryPreview");
  const rendered = renderVoyaraItinerary(itinerary);

  if (itineraryText) itineraryText.innerHTML = rendered;
  if (itineraryPreview) itineraryPreview.innerHTML = rendered;
  if (itineraryContainer) showElement(itineraryContainer);

  const plannerSection = $("section-planner");
  if (plannerSection) plannerSection.classList.add("active-section");

  setTimeout(() => {
    itineraryContainer?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}


// ============================================================
// ITINERARY ACTIONS
// ============================================================

function bindItineraryActions() {
  const saveTripButton = $("saveTripBtn");

  if (saveTripButton) {
    saveTripButton.addEventListener("click", () => {
      saveCurrentTrip();
    });
  }

  const regenerateButton = $("regenerateBtn");

  if (regenerateButton) {
    regenerateButton.addEventListener(
      "click",
      async () => {
        await regenerateItinerary();
      }
    );
  }

  const modifyButton = $("modifyBtn");

  if (modifyButton) {
    modifyButton.addEventListener(
      "click",
      async () => {
        await modifyItinerary();
      }
    );
  }

  const downloadButton = $("downloadItineraryBtn");

  if (downloadButton) {
    downloadButton.addEventListener("click", () => {
      downloadItinerary();
    });
  }
}

async function modifyItinerary() {
  const modificationInput = $("modifyInput");

  if (!modificationInput) {
    return;
  }

  const modification = modificationInput.value.trim();

  if (!modification) {
    alert("Please describe what you want to change.");
    return;
  }

  if (!currentItinerary) {
    alert("Create an itinerary first.");
    return;
  }

  const modifyButton = $("modifyBtn");

  if (modifyButton) {
    modifyButton.disabled = true;
    modifyButton.textContent = "Updating...";
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/modify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          itinerary: currentItinerary,
          modification: modification,
          profile: currentProfile
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error ||
        "Unable to modify itinerary."
      );
    }

    currentItinerary = result.itinerary;
    displayItinerary(currentItinerary);

    modificationInput.value = "";

  } catch (error) {
    console.error("Modify error:", error);

    alert(
      error.message ||
      "Unable to modify itinerary."
    );

  } finally {
    if (modifyButton) {
      modifyButton.disabled = false;
      modifyButton.textContent = "Apply change";
    }
  }
}

async function regenerateItinerary() {
  if (!currentItinerary) {
    alert("Create an itinerary first.");
    return;
  }

  const regenerateButton = $("regenerateBtn");

  if (regenerateButton) {
    regenerateButton.disabled = true;
    regenerateButton.textContent = "Regenerating...";
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/regenerate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          itinerary: currentItinerary,
          profile: currentProfile
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error ||
        "Unable to regenerate itinerary."
      );
    }

    currentItinerary = result.itinerary;
    displayItinerary(currentItinerary);

  } catch (error) {
    console.error("Regenerate error:", error);

    alert(
      error.message ||
      "Unable to regenerate itinerary."
    );

  } finally {
    if (regenerateButton) {
      regenerateButton.disabled = false;
      regenerateButton.textContent = "Regenerate";
    }
  }
}

function saveCurrentTrip() {
  if (!currentItinerary) {
    alert("Create an itinerary first.");
    return;
  }

  const journeys = getSavedJourneys();

  const trip = {
    id: Date.now(),
    destination:
      currentProfile.destination ||
      "My journey",
    days:
      currentProfile.days ||
      "",
    people:
      currentProfile.people ||
      "",
    budget:
      currentProfile.budget ||
      "",
    travelMonth:
      currentProfile.travelMonth ||
      "",
    preferences:
      currentProfile.preferences ||
      "",
    itinerary: currentItinerary,
    createdAt: new Date().toISOString()
  };

  journeys.unshift(trip);
  saveJourneys(journeys);

  renderSavedJourneys();
  renderTrips();
  updateHomeStats();

  alert("Journey saved successfully.");
}

function ensureItineraryEditControls() {
  const actions = $("itineraryActions");
  if (!actions || $("voyaraEditItineraryBtn")) return;
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.id = "voyaraEditItineraryBtn";
  editButton.className = "secondary-button";
  editButton.textContent = "Edit itinerary";
  const printButton = document.createElement("button");
  printButton.type = "button";
  printButton.id = "voyaraPrintItineraryBtn";
  printButton.className = "secondary-button";
  printButton.textContent = "Print / Save as PDF";
  const editor = document.createElement("div");
  editor.id = "voyaraItineraryEditor";
  editor.className = "voyara-itinerary-editor hidden";
  editor.innerHTML = `<label for="voyaraItineraryEditText">Edit the itinerary text. You can move activities between days and change timings here.</label><textarea id="voyaraItineraryEditText" rows="16"></textarea><div class="voyara-post-actions"><button type="button" class="primary-button" id="voyaraSaveItineraryEdit">Save edits</button><button type="button" class="secondary-button" id="voyaraCancelItineraryEdit">Cancel</button></div>`;
  actions.append(editButton, printButton);
  actions.after(editor);
  editButton.addEventListener("click", () => {
    $("voyaraItineraryEditText").value = currentItinerary || "";
    editor.classList.remove("hidden");
    $("voyaraItineraryEditText").focus();
  });
  $("voyaraCancelItineraryEdit").addEventListener("click", () => editor.classList.add("hidden"));
  $("voyaraSaveItineraryEdit").addEventListener("click", () => {
    const updated = $("voyaraItineraryEditText").value.trim();
    if (!updated) { alert("The itinerary cannot be empty."); return; }
    currentItinerary = updated;
    displayItinerary(updated);
    editor.classList.add("hidden");
    voyaraToast("Itinerary edits saved. Save the trip to keep them in My Trips.");
  });
  printButton.addEventListener("click", printItinerary);
}

function printItinerary() {
  if (!currentItinerary) {
    alert("Create an itinerary first.");
    return;
  }
  showSection("planner");
  displayItinerary(currentItinerary);
  document.body.classList.add("voyara-printing");
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove("voyara-printing"), 500);
  }, 120);
}

function downloadItinerary() {
  printItinerary();
}

function resetPlanner() {
  const tripForm = $("tripForm");

  if (tripForm) {
    tripForm.reset();
  }

  currentItinerary = "";
  currentProfile = {};
  lastTripRequest = null;

  hideElement($("itineraryContainer"));
  hideElement($("plannerLoading"));

  setText(
    "plannerStatus",
    ""
  );
}


// ============================================================
// SAVED JOURNEYS SIDEBAR
// ============================================================

function renderSavedJourneys() {
  const container = $("savedJourneysList");

  if (!container) {
    return;
  }

  const journeys = getSavedJourneys();

  const countElement = $("savedJourneysCount");

  if (countElement) {
    countElement.textContent = journeys.length;
  }

  if (journeys.length === 0) {
    container.innerHTML = `
      <div class="empty-journeys">
        <span>✦</span>
        <p>No saved journeys yet.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = journeys
    .slice(0, 5)
    .map((journey) => `
      <button
        class="saved-journey-item"
        data-journey-id="${journey.id}"
        type="button"
      >
        <strong>${escapeHtml(
          journey.destination
        )}</strong>
        <small>${escapeHtml(
          journey.days || ""
        )} days</small>
      </button>
    `)
    .join("");

  container
    .querySelectorAll("[data-journey-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const journey = journeys.find(
          (item) =>
            String(item.id) ===
            String(button.dataset.journeyId)
        );

        if (journey) {
          loadJourney(journey);
        }
      });
    });
}

function loadJourney(journey) {
  currentItinerary = journey.itinerary;
  currentProfile = journey;

  if ($("destination")) {
    $("destination").value =
      journey.destination || "";
  }

  if ($("days")) {
    const durationMatch = String(journey.days || "").match(/(\d+(?:\.\d+)?)\s*(hours?|days?)/i);
    $("days").value = durationMatch ? durationMatch[1] : "";
    if ($("durationUnit")) $("durationUnit").value = durationMatch ? (durationMatch[2].toLowerCase().startsWith("hour") ? "hours" : "days") : "";
  }

  if ($("people")) {
    const peopleMatch = String(journey.people || "").match(/\d+/);
    $("people").value = peopleMatch ? peopleMatch[0] : "";
  }

  if ($("budget")) {
    $("budget").value =
      journey.budget || "";
  }

  if ($("travelMonth")) {
    $("travelMonth").value =
      journey.travelMonth || "";
  }

  if ($("preferences")) {
    $("preferences").value =
      journey.preferences || "";
  }

  showSection("planner");
  displayItinerary(currentItinerary);
}


// ============================================================
// TRIPS PAGE
// ============================================================

function bindTrips() {
  const tripGrid = $("tripGrid");

  if (tripGrid) {
    tripGrid.addEventListener("click", (event) => {
      const deleteButton = event.target.closest(
        "[data-delete-trip]"
      );

      if (deleteButton) {
        deleteTrip(deleteButton.dataset.deleteTrip);
      }

      const openButton = event.target.closest(
        "[data-open-trip]"
      );

      if (openButton) {
        const journey = getSavedJourneys().find(
          (trip) =>
            String(trip.id) ===
            String(openButton.dataset.openTrip)
        );

        if (journey) {
          loadJourney(journey);
        }
      }
    });
  }
}

function renderTrips() {
  const tripGrid = $("tripGrid");

  if (!tripGrid) {
    return;
  }

  const journeys = getSavedJourneys();

  if (journeys.length === 0) {
    tripGrid.innerHTML = `
      <div class="empty-state">
        <h3>No saved trips yet</h3>
        <p>Create and save your first journey.</p>
        <button
          type="button"
          class="primary-button"
          data-section="planner"
        >
          Plan a trip
        </button>
      </div>
    `;

    return;
  }

  tripGrid.innerHTML = journeys
    .map((journey) => `
      <article class="trip-card">
        <div class="trip-card-content">
          <span class="trip-card-label">SAVED JOURNEY</span>
          <h3>${escapeHtml(
            journey.destination
          )}</h3>
          <p>
            ${escapeHtml(
              voyaraFormatDuration(journey.days)
            )}
            ${
              journey.people
                ? ` · ${escapeHtml(journey.people)} travellers`
                : ""
            }
          </p>
        </div>

        <div class="trip-card-actions">
          <button
            type="button"
            class="secondary-button"
            data-open-trip="${journey.id}"
          >
            Open
          </button>

          <button
            type="button"
            class="text-button danger"
            data-delete-trip="${journey.id}"
          >
            Delete
          </button>
        </div>
      </article>
    `)
    .join("");
}

function deleteTrip(id) {
  const confirmed = confirm(
    "Delete this saved journey?"
  );

  if (!confirmed) {
    return;
  }

  const journeys = getSavedJourneys().filter(
    (journey) =>
      String(journey.id) !== String(id)
  );

  saveJourneys(journeys);

  renderSavedJourneys();
  renderTrips();
  updateHomeStats();
}


// ============================================================
// PROFILE MENU
// ============================================================

function bindProfileMenu() {
  const profileButton = $("profileButton");
  const profileMenu = $("profileMenu");

  if (profileButton && profileMenu) {
    profileButton.addEventListener("click", (event) => {
      event.stopPropagation();
      profileMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
      profileMenu.classList.add("hidden");
    });

    profileMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  const logoutButton = $("logoutBtn");

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      voyaraSaveCurrentAccountData();
      ["voyaraUserName", "voyaraUserEmail", "voyaraUserPhone", "voyaraUserIdentifier"].forEach(key => localStorage.removeItem(key));
      voyaraClearActiveAccountData();
      showWelcomeScreen();
    });
  }
}


// ============================================================
// EXPLORE PAGE
// ============================================================

const exploreDestinations = [
  {
    name: "Munnar",
    image: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=900&q=85",
    state: "Kerala",
    description: "Tea gardens, misty hills, and peaceful nature.",
    emoji: "🌿",
    latitude: 10.0889,
    longitude: 77.0595
  },
  {
    name: "Goa",
    image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=85",
    state: "India",
    description: "Beaches, local food, and relaxed coastal experiences.",
    emoji: "🌊",
    latitude: 15.2993,
    longitude: 74.124
  },
  {
    name: "Jaipur",
    image: "https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=900&q=85",
    state: "Rajasthan",
    description: "Forts, colourful markets, and rich history.",
    emoji: "🏰",
    latitude: 26.9124,
    longitude: 75.7873
  },
  {
    name: "Coorg",
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=85",
    state: "Karnataka",
    description: "Coffee plantations, waterfalls, and green landscapes.",
    emoji: "☕",
    latitude: 12.3375,
    longitude: 75.8069
  }
];

function bindExplore() {
  const searchButton = $("exploreSearchBtn");
  const searchInput = $("exploreSearch");

  if (searchButton) {
    searchButton.addEventListener("click", () => {
      renderExploreDestinations(
        searchInput ? searchInput.value : ""
      );
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderExploreDestinations(
        searchInput.value
      );
    });
  }

  renderExploreDestinations("");
}

function renderExploreDestinations(searchTerm) {
  const grid = $("destinationGrid");

  if (!grid) {
    return;
  }

  const term = searchTerm
    .trim()
    .toLowerCase();

  const filtered = exploreDestinations.filter(
    (destination) =>
      destination.name
        .toLowerCase()
        .includes(term) ||
      destination.state
        .toLowerCase()
        .includes(term)
  );

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No destinations found</h3>
        <p>Try searching for another place.</p>
      </div>
    `;

    return;
  }

  grid.innerHTML = filtered
    .map((destination) => `
      <article
        class="destination-card"
        data-destination="${escapeHtml(
          destination.name
        )}"
      >
        <div class="destination-card-image">
          <img src="${destination.image}" alt="${escapeHtml(destination.name)} travel destination" loading="lazy" onerror="this.style.display='none'">
        </div>

        <div class="destination-card-body">
          <span>${escapeHtml(
            destination.state
          )}</span>
          <h3>${escapeHtml(
            destination.name
          )}</h3>
          <p>${escapeHtml(
            destination.description
          )}</p>

          <button
            type="button"
            class="text-button"
            data-plan-destination="${escapeHtml(
              destination.name
            )}"
          >
            Plan this trip →
          </button>
        </div>
      </article>
    `)
    .join("");

  grid.querySelectorAll(
    "[data-plan-destination]"
  ).forEach((button) => {
    button.addEventListener("click", () => {
      const destination = button.dataset.planDestination;

      if ($("destination")) {
        $("destination").value = destination;
      }

      showSection("planner");
    });
  });
}

function initializeMap() {
  const mapElement = $("travelMap");

  if (!mapElement) {
    return;
  }

  if (typeof L === "undefined") {
    return;
  }

  if (mapInstance) {
    return;
  }

  mapInstance = L.map(mapElement).setView(
    [20.5937, 78.9629],
    5
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; OpenStreetMap contributors'
    }
  ).addTo(mapInstance);

  exploreDestinations.forEach((destination) => {
    L.marker([
      destination.latitude,
      destination.longitude
    ])
      .addTo(mapInstance)
      .bindPopup(
        `<div class="voyara-map-popup"><strong>${escapeHtml(destination.name)}</strong><br>${escapeHtml(destination.description)}<br><button type="button" onclick="window.voyaraPlanDestination('${escapeHtml(destination.name)}')">Plan this trip</button></div>`
      );
  });
}


// ============================================================
// RECOMMENDATIONS PAGE
// ============================================================

function bindRecommendations() {
  const recommendationGrid = $("recommendationGrid");

  if (!recommendationGrid) {
    return;
  }

  const recommendations = [
    {
      title: "Nature escapes",
      description:
        "Peaceful hills, forests, waterfalls, and green landscapes.",
      emoji: "🌿"
    },
    {
      title: "Food journeys",
      description:
        "Explore local dishes, cafés, markets, and regional flavours.",
      emoji: "🍜"
    },
    {
      title: "Budget-friendly trips",
      description:
        "Simple travel ideas for keeping costs under control.",
      emoji: "💰"
    },
    {
      title: "Culture and history",
      description:
        "Discover forts, museums, heritage sites, and traditions.",
      emoji: "🏛️"
    }
  ];

  recommendationGrid.innerHTML = recommendations
    .map((item) => `
      <article class="recommendation-card">
        <div class="recommendation-icon">
          ${item.emoji}
        </div>
        <h3>${escapeHtml(
          item.title
        )}</h3>
        <p>${escapeHtml(
          item.description
        )}</p>
        <button
          type="button"
          class="text-button"
          data-section="planner"
        >
          Explore trips →
        </button>
      </article>
    `)
    .join("");
}


// ============================================================
// SCRAPBOOK
// ============================================================

function bindScrapbook() {
  const saveMemoryButton = $("saveTextMemoryBtn");
  const cancelMemoryButton = $("cancelTextMemoryBtn");
  const addMemoryButton = $("addMemoryBtn");
  const memoryModal = $("memoryModal");

  if (addMemoryButton && memoryModal) {
    addMemoryButton.addEventListener("click", () => {
      showElement(memoryModal);
    });
  }

  if (cancelMemoryButton && memoryModal) {
    cancelMemoryButton.addEventListener("click", () => {
      hideElement(memoryModal);
    });
  }

  if (saveMemoryButton) {
    saveMemoryButton.addEventListener("click", () => {
      const titleInput = $("memoryTitle");
      const textInput = $("memoryText");

      const title = titleInput
        ? titleInput.value.trim()
        : "";

      const text = textInput
        ? textInput.value.trim()
        : "";

      if (!text) {
        alert("Please write a memory first.");
        return;
      }

      const memories = getMemories();

      memories.unshift({
        id: Date.now(),
        title: title || "Travel memory",
        text: text,
        createdAt: new Date().toISOString()
      });

      saveMemories(memories);

      if (titleInput) {
        titleInput.value = "";
      }

      if (textInput) {
        textInput.value = "";
      }

      hideElement(memoryModal);
      renderScrapbook();
      updateHomeStats();
    });
  }

  const closeMemoryButton = $("closeMemoryModal");

  if (closeMemoryButton && memoryModal) {
    closeMemoryButton.addEventListener("click", () => {
      hideElement(memoryModal);
    });
  }
}

function renderScrapbook() {
  const scrapbookGrid = $("scrapbookGrid");

  if (!scrapbookGrid) {
    return;
  }

  const memories = getMemories();

  if (memories.length === 0) {
    scrapbookGrid.innerHTML = `
      <div class="empty-state">
        <h3>Your scrapbook is empty</h3>
        <p>Add notes and memories from your journeys.</p>
      </div>
    `;

    return;
  }

  scrapbookGrid.innerHTML = memories
    .map((memory) => `
      <article class="memory-card">
        <span class="memory-card-icon">✦</span>
        <h3>${escapeHtml(
          memory.title
        )}</h3>
        <p>${escapeHtml(
          memory.text
        )}</p>
        <button
          type="button"
          class="text-button danger"
          data-delete-memory="${memory.id}"
        >
          Delete
        </button>
      </article>
    `)
    .join("");

  scrapbookGrid
    .querySelectorAll("[data-delete-memory]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const memories = getMemories().filter(
          (memory) =>
            String(memory.id) !==
            String(button.dataset.deleteMemory)
        );

        saveMemories(memories);
        renderScrapbook();
        updateHomeStats();
      });
    });
}


// ============================================================
// HOME STATS
// ============================================================

function updateHomeStats() {
  const journeys = getSavedJourneys();
  const memories = getMemories();

  setText(
    "savedTripsStat",
    String(journeys.length)
  );

  setText(
    "memoryStat",
    String(memories.length)
  );

  setText(
    "destinationStat",
    String(exploreDestinations.length)
  );

  setText(
    "savedJourneysCount",
    String(journeys.length)
  );
}


// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ============================================================
   VOYARA COMPLETE UPGRADE LAYER
   Additive enhancements; original trip planner remains intact.
============================================================ */

const VOYARA_POSTS_KEY = "voyaraCommunityPosts";
const VOYARA_SAVED_PLACES_KEY = "voyaraSavedPlaces";
const VOYARA_PACKING_KEY = "voyaraPackingChecklist";
const VOYARA_BUDGET_KEY = "voyaraBudgetOverrides";
let voyaraChatHistory = [];

function voyaraGetJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (_) { return fallback; }
}
function voyaraSetJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function voyaraCurrentDestination() {
  const input = $("destination");
  if (input && input.value.trim()) return input.value.trim();
  const profile = lastTripRequest || {};
  return profile.destination || profile.location || "Goa";
}
function voyaraCurrentPreferences() {
  const input = $("preferences");
  return input ? input.value.trim() : "";
}
function voyaraToast(message) {
  if (typeof showToast === "function") showToast(message);
  else alert(message);
}
window.voyaraPlanDestination = function(destination) {
  const input = $("destination");
  if (input) input.value = destination;
  showSection("planner");
  if (input) input.focus();
};

function enhanceExplore() {
  const grid = $("destinationGrid");
  if (!grid) return;
  const searchBar = document.querySelector(".explore-search-bar");
  if (searchBar && !$("searchAnywhereBtn")) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.id = "searchAnywhereBtn"; btn.className = "secondary-button";
    btn.textContent = "Find any city"; searchBar.appendChild(btn);
    btn.addEventListener("click", searchAnyCity);
  }
  // Re-render cards with image data after original renderer has run.
  if (typeof renderExploreDestinations === "function") renderExploreDestinations($("exploreSearch")?.value || "");
}

async function searchAnyCity() {
  const input = $("exploreSearch");
  const query = input ? input.value.trim() : "";
  if (!query) { voyaraToast("Enter a city or destination first."); return; }
  const known = exploreDestinations.find(d => d.name.toLowerCase() === query.toLowerCase());
  if (known) { window.voyaraPlanDestination(known.name); return; }
  const button = $("searchAnywhereBtn");
  if (button) { button.disabled = true; button.textContent = "Searching…"; }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Search service unavailable");
    const results = await response.json();
    if (!results.length) { voyaraToast("No matching place found. Try a city name, such as Hyderabad."); return; }
    const place = results[0];
    const name = place.name || query;
    const lat = Number(place.lat), lon = Number(place.lon);
    const destination = {name, state: place.display_name?.split(",").slice(1,3).join(",").trim() || "Search result", description: place.display_name || `Explore ${name}.`, latitude:lat, longitude:lon, image:"https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=85", emoji:"📍", searched:true};
    if (mapInstance) {
      mapInstance.setView([lat,lon], 11);
      L.marker([lat,lon]).addTo(mapInstance).bindPopup(`<div class="voyara-map-popup"><strong>${escapeHtml(name)}</strong><br>${escapeHtml(place.display_name || "") }<br><button type="button" onclick="window.voyaraPlanDestination('${escapeHtml(name)}')">Plan this trip</button></div>`).openPopup();
    }
    const grid = $("destinationGrid");
    grid.innerHTML = `<article class="destination-card"><div class="destination-card-image"><img src="${destination.image}" alt="${escapeHtml(name)}" loading="lazy"></div><div class="destination-card-body"><span>${escapeHtml(destination.state)}</span><h3>${escapeHtml(name)}</h3><p>${escapeHtml(destination.description)}</p><button type="button" class="text-button" onclick="window.voyaraPlanDestination('${escapeHtml(name)}')">Plan this trip →</button><p class="voyara-muted">Map result from OpenStreetMap.</p></div></article>`;
    if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 100);
  } catch (error) {
    voyaraToast("Could not search right now. Check your internet connection and try again.");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Find any city"; }
  }
}

function ensureRecommendationUI() {
  const section = $("section-recommendations");
  if (!section || $("voyaraCommunityToolbar")) return;
  const intro = section.querySelector(".recommendation-intro-card");
  const toolbar = document.createElement("div");
  toolbar.id = "voyaraCommunityToolbar";
  toolbar.innerHTML = `
    <div class="voyara-enhance-toolbar">
      <input id="communitySearch" type="search" placeholder="Search cafes, beaches, markets, or destinations…" aria-label="Search recommendations">
      <select id="communityCategory" aria-label="Filter category"><option value="all">All categories</option><option>Food & cafés</option><option>Beaches & nature</option><option>Markets & shopping</option><option>Culture & history</option><option>Hidden gems</option></select>
      <button type="button" class="primary-button" id="addRecommendationBtn">＋ Share a recommendation</button>
    </div>
    <p class="voyara-muted" id="communityContext"></p>
    <form id="communityPostForm" class="voyara-form hidden">
      <h3>Share a place worth visiting</h3>
      <div class="voyara-form-row"><div><label for="postPlace">Place name</label><input id="postPlace" required placeholder="e.g. Palolem Beach"></div><div><label for="postDestination">City / destination</label><input id="postDestination" required placeholder="e.g. Goa"></div></div>
      <div class="voyara-form-row"><div><label for="postCategory">Category</label><select id="postCategory"><option>Food & cafés</option><option>Beaches & nature</option><option>Markets & shopping</option><option>Culture & history</option><option>Hidden gems</option></select></div><div><label for="postRating">Your rating</label><select id="postRating"><option value="5">★★★★★ — Loved it</option><option value="4">★★★★☆ — Worth visiting</option><option value="3">★★★☆☆ — It was okay</option><option value="2">★★☆☆☆ — Not for me</option><option value="1">★☆☆☆☆ — Would skip</option></select></div></div>
      <label for="postReview">Your experience and practical tips</label><textarea id="postReview" required maxlength="1200" placeholder="What did you like? Best time to visit? Any useful tips?"></textarea>
      <label for="postImage">Photo URL (optional)</label><input id="postImage" type="url" placeholder="https://…">
      <div class="voyara-post-actions"><button type="submit" class="primary-button">Publish recommendation</button><button type="button" class="secondary-button" id="cancelPostBtn">Cancel</button></div>
      <p class="voyara-muted">Prototype note: posts are stored in this browser. A shared online community needs a hosted database and user authentication.</p>
    </form>
    <div id="communityPosts" class="voyara-post-grid"></div>`;
  if (intro) intro.after(toolbar); else section.prepend(toolbar);
  $("addRecommendationBtn").addEventListener("click", () => {
    const form = $("communityPostForm"); form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) { $("postDestination").value = voyaraCurrentDestination(); $("postPlace").focus(); }
  });
  $("cancelPostBtn").addEventListener("click", () => $("communityPostForm").classList.add("hidden"));
  $("communityPostForm").addEventListener("submit", event => {
    event.preventDefault();
    const posts = voyaraGetJSON(VOYARA_POSTS_KEY, []);
    posts.unshift({id:Date.now(), place:$('postPlace').value.trim(), destination:$('postDestination').value.trim(), category:$('postCategory').value, rating:Number($('postRating').value), review:$('postReview').value.trim(), image:$('postImage').value.trim(), author:localStorage.getItem('voyaraUserName') || 'Voyara traveller', createdAt:new Date().toISOString(), likes:0});
    voyaraSetJSON(VOYARA_POSTS_KEY, posts);
    event.target.reset(); event.target.classList.add('hidden'); renderCommunityPosts(); voyaraToast('Your recommendation was saved in this browser.');
  });
  $("communitySearch").addEventListener("input", renderCommunityPosts);
  $("communityCategory").addEventListener("change", () => { if (voyaraForYouResults.length) searchForYouPlaces(); else renderCommunityPosts(); });
  renderCommunityPosts();
}

const VOYARA_GUIDES = [
  {id:'guide-palolem',place:'Palolem Beach',destination:'Goa',category:'Beaches & nature',rating:5,review:'A scenic crescent-shaped beach for a relaxed day. Go early for a quieter walk, and confirm boat-trip safety and weather locally.',image:'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=85',author:'Voyara guide',guide:true,likes:18},
  {id:'guide-fontainhas',place:'Fontainhas',destination:'Goa',category:'Culture & history',rating:5,review:'Colourful heritage streets and small cafés make this a lovely slow walk. Be respectful around homes and check café hours before visiting.',image:'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=900&q=85',author:'Voyara guide',guide:true,likes:14},
  {id:'guide-munnar',place:'Tea Garden Viewpoints',destination:'Munnar',category:'Beaches & nature',rating:5,review:'Visit in the morning for misty hills and scenic views. Carry a light jacket and use marked viewpoints.',image:'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=900&q=85',author:'Voyara guide',guide:true,likes:12},
  {id:'guide-jaipur',place:'Johari Bazaar',destination:'Jaipur',category:'Markets & shopping',rating:4,review:'A colourful market for jewellery and textiles. Compare prices, check product quality, and ask permission before photographing people.',image:'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=900&q=85',author:'Voyara guide',guide:true,likes:9},
  {id:'guide-coorg',place:'Coffee Estate Walk',destination:'Coorg',category:'Hidden gems',rating:5,review:'A guided estate walk can be a calm way to learn about local coffee. Ask the estate about access and timings in advance.',image:'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=85',author:'Voyara guide',guide:true,likes:11},
  {id:'guide-alleppey',place:'Alleppey Backwaters',destination:'Alleppey',category:'Beaches & nature',rating:4,review:'A slower-paced backwater experience. Compare boat operators, confirm inclusions, and choose operators with appropriate safety equipment.',image:'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=85',author:'Voyara guide',guide:true,likes:7}
];

function renderCommunityPosts() {
  const grid=$("communityPosts");
  if(!grid)return;
  const query=($('communitySearch')?.value||'').trim().toLowerCase();
  const category=$('communityCategory')?.value||'all';
  const destination=($('communityDestination')?.value||'').trim().toLowerCase();
  const saved=voyaraGetJSON(VOYARA_SAVED_PLACES_KEY,[]);
  const results=voyaraForYouResults.filter(item=>(category==='all'||item.category===category)&&(!query||`${item.name} ${item.type} ${item.address}`.toLowerCase().includes(query))&&(!destination||String(item.destination||'').toLowerCase().includes(destination)));
  grid.classList.add('voyara-place-grid');
  const cardMarkup=(item)=>{
    const isSaved=saved.some(place=>place.id===item.id||(place.name===item.name&&String(place.destination).toLowerCase()===String(item.destination).toLowerCase()));
    const rating=item.rating!==null&&item.rating!==undefined?`<span class="voyara-place-rating">★ ${Number(item.rating).toFixed(1)}${item.ratingCount?` <small>(${Number(item.ratingCount).toLocaleString()} ratings)</small>`:''}</span>`:`<span class="voyara-place-rating unavailable">Rating unavailable</span>`;
    return `<article class="voyara-place-card"><div class="voyara-place-card-body"><span class="voyara-place-type">${voyaraEscapeAttr(item.type||item.category)}</span><h4>${voyaraEscapeAttr(item.name)}</h4>${rating}<p>${voyaraEscapeAttr(item.address||item.destination)}</p><p class="voyara-source-note">Source: ${voyaraEscapeAttr(item.source||'Place directory')}${item.source==='Google Places'?' · Google rating':' · No rating supplied'}</p><div class="voyara-place-actions"><a href="${voyaraEscapeAttr(item.mapUrl)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a><button type="button" data-save-place="${voyaraEscapeAttr(item.id)}" class="${isSaved?'is-saved':''}">${isSaved?'✓ Saved':'♡ Wishlist'}</button><button type="button" data-add-place="${voyaraEscapeAttr(item.id)}">Add to trip</button></div></div></article>`;
  };
  if(!results.length){
    grid.innerHTML=`<div class="empty-state"><h3>Ready to discover somewhere?</h3><p>Enter a destination and select Search places to find recommendations.</p></div>`;
  } else if(category==='all') {
    const grouped=VOYARA_FOR_YOU_CATEGORIES.map(cat=>({cat,items:results.filter(item=>item.category===cat).slice(0,4)})).filter(group=>group.items.length);
    grid.innerHTML=grouped.map(group=>`<section class="voyara-category-results"><div class="voyara-category-results-heading"><h3>${voyaraEscapeAttr(group.cat)}</h3><span>${group.items.length} recommendations</span></div><div class="voyara-category-results-grid">${group.items.map(cardMarkup).join('')}</div></section>`).join('');
  } else {
    grid.innerHTML=results.slice(0,4).map(cardMarkup).join('');
  }
  grid.querySelectorAll('[data-save-place]').forEach(button=>button.addEventListener('click',()=>{
    const item=voyaraForYouResults.find(place=>String(place.id)===button.dataset.savePlace); if(!item)return;
    let places=voyaraGetJSON(VOYARA_SAVED_PLACES_KEY,[]);
    const index=places.findIndex(place=>String(place.id)===String(item.id)||(place.name===item.name&&String(place.destination).toLowerCase()===String(item.destination).toLowerCase()));
    if(index>=0){places.splice(index,1);voyaraToast('Removed from your wishlist.');}
    else{places.push({...item,savedAt:new Date().toISOString()});if(typeof voyaraRememberExplored==='function')voyaraRememberExplored({name:item.destination});voyaraToast('Added to your wishlist.');}
    voyaraSetJSON(VOYARA_SAVED_PLACES_KEY,places);updateHomeStats();renderCommunityPosts();
  }));
  grid.querySelectorAll('[data-add-place]').forEach(button=>button.addEventListener('click',()=>{
    const item=voyaraForYouResults.find(place=>String(place.id)===button.dataset.addPlace);if(!item)return;
    window.voyaraPlanDestination(item.destination);
    const preferences=$('preferences');
    if(preferences)preferences.value=`${preferences.value?preferences.value+'; ':''}Include ${item.name}`;
    voyaraToast(`${item.name} added to your trip preferences.`);
  }));
  const localContainer=$('voyaraLocalCommunityPosts');
  if(localContainer){
    const posts=voyaraGetJSON(VOYARA_POSTS_KEY,[]).filter(post=>(!destination||String(post.destination||'').toLowerCase().includes(destination))&&(category==='all'||post.category===category)&&(!query||`${post.place} ${post.review}`.toLowerCase().includes(query)));
    localContainer.innerHTML=posts.length?`<h4>Traveller notes</h4>`+posts.map(post=>`<article class="voyara-place-card"><div class="voyara-place-card-body"><span class="voyara-place-type">Community note · ${voyaraEscapeAttr(post.category)}</span><h4>${voyaraEscapeAttr(post.place)}</h4><p>${voyaraEscapeAttr(post.destination)} · ${voyaraEscapeAttr(post.rating||'—')}/5 self-reported</p><p>${voyaraEscapeAttr(post.review)}</p><p class="voyara-source-note">Shared in this browser; not independently verified.</p></div></article>`).join(''):`<p class="voyara-muted">No traveller notes match this search yet.</p>`;
  }
}

function voyaraSaveCurrentAccountData() {
  const identifier=String(localStorage.getItem("voyaraUserIdentifier")||localStorage.getItem("voyaraUserEmail")||localStorage.getItem("voyaraUserPhone")||"").toLowerCase();
  const name=localStorage.getItem("voyaraUserName")||"guest";const data={};
  VOYARA_ACCOUNT_KEYS.forEach(key=>{const value=localStorage.getItem(key);if(value!==null)data[key]=value;});
  const key=identifier?`voyaraAccountData:${identifier}`:`voyaraLegacyAccountData:${name.toLowerCase()}`;
  localStorage.setItem(key,JSON.stringify(data));
}


/* ============================================================
   VOYARA FINAL CLEAN UI LAYER
   - No floating theme circle.
   - Ask Voyara stays bottom-right in the sidebar green.
   - Structured scrapbook with albums, photos, notes and collage editor.
============================================================ */

const VOYARA_ALBUMS_KEY = "voyaraAlbumsV2";
const VOYARA_COLLAGE_DRAFT_KEY = "voyaraCollageDraftV2";

function voyaraAlbums() { return voyaraGetJSON(VOYARA_ALBUMS_KEY, []); }
function voyaraSaveAlbums(albums) { voyaraSetJSON(VOYARA_ALBUMS_KEY, albums); }
function voyaraId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function voyaraAlbumById(id) { return voyaraAlbums().find(a => String(a.id) === String(id)); }
function voyaraCurrentAlbumId() { return localStorage.getItem("voyaraOpenAlbumId") || ""; }
function voyaraSetCurrentAlbumId(id) { if (id) localStorage.setItem("voyaraOpenAlbumId", id); else localStorage.removeItem("voyaraOpenAlbumId"); }

function voyaraSyncTripAlbums() {
  const albums = voyaraAlbums();
  const journeys = getSavedJourneys();
  journeys.forEach(trip => {
    const existing = albums.find(a => String(a.tripId) === String(trip.id));
    if (!existing) {
      albums.push({
        id: `trip-${trip.id}`,
        tripId: trip.id,
        name: trip.destination || "My Journey",
        destination: trip.destination || "",
        photos: [], notes: [], collages: [],
        createdAt: trip.createdAt || new Date().toISOString()
      });
    } else {
      existing.name = existing.name || trip.destination || "My Journey";
      existing.destination = existing.destination || trip.destination || "";
    }
  });
  voyaraSaveAlbums(albums);
  return albums;
}

function voyaraEnsureScrapbookShell() {
  const section = $("section-scrapbook");
  if (!section) return null;
  if ($("voyaraScrapbookV2")) return section;

  section.innerHTML = `
    <div id="voyaraScrapbookV2" class="voyara-scrapbook-v2">
      <div class="voyara-scrapbook-header">
        <div>
          <span class="eyebrow">KEEP YOUR MEMORIES</span>
          <h2>Scrapbook</h2>
          <p>Keep your travel photos and notes together, then turn your favourite photos into a simple collage.</p>
        </div>
        <button type="button" class="primary-button" id="voyaraCreateAlbumBtn">＋ Create album</button>
      </div>

      <div class="voyara-scrapbook-howto">
        <div class="voyara-scrapbook-howto-icon">♡</div>
        <div>
          <h3>How your scrapbook works</h3>
          <p><strong>1.</strong> Create or open an album. <strong>2.</strong> Add photos one by one. <strong>3.</strong> Add notes if you want. <strong>4.</strong> Choose photos and create a collage.</p>
        </div>
      </div>

      <div id="voyaraCreateAlbumForm" class="voyara-create-album-form hidden">
        <div>
          <h3>Create a new album</h3>
          <p class="voyara-muted">Give your album a simple name, such as “Goa Trip” or “College Travel Memories”.</p>
        </div>
        <div class="voyara-scrapbook-form-grid">
          <label>Album name<input id="voyaraAlbumName" placeholder="e.g. Goa Trip" maxlength="60"></label>
          <label>Destination (optional)<input id="voyaraAlbumDestination" placeholder="e.g. Goa" maxlength="60"></label>
        </div>
        <div class="voyara-post-actions"><button type="button" class="primary-button" id="voyaraSaveAlbumBtn">Create album</button><button type="button" class="secondary-button" id="voyaraCancelAlbumBtn">Cancel</button></div>
      </div>

      <div class="voyara-scrapbook-block">
        <div class="voyara-scrapbook-block-heading"><div><span class="eyebrow">YOUR ALBUMS</span><h3>My Albums</h3></div><span id="voyaraAlbumCount" class="voyara-muted"></span></div>
        <div id="voyaraAlbumList" class="voyara-album-list"></div>
      </div>

      <div id="voyaraAlbumDetail" class="voyara-album-detail hidden"></div>
      <div id="voyaraCollageEditor" class="voyara-collage-editor hidden"></div>
    </div>`;
  return section;
}

function voyaraBindScrapbookV2() {
  const section = voyaraEnsureScrapbookShell();
  if (!section || section.dataset.v2Bound === "true") return;
  section.dataset.v2Bound = "true";
  section.addEventListener("click", event => {
    const target = event.target.closest("button");
    if (!target) return;
    const albumId = target.dataset.albumId;
    if (target.id === "voyaraCreateAlbumBtn") { $("voyaraCreateAlbumForm")?.classList.remove("hidden"); $("voyaraAlbumName")?.focus(); }
    else if (target.id === "voyaraCancelAlbumBtn") { $("voyaraCreateAlbumForm")?.classList.add("hidden"); }
    else if (target.id === "voyaraSaveAlbumBtn") voyaraCreateAlbum();
    else if (target.dataset.openAlbum) voyaraOpenAlbum(target.dataset.openAlbum);
    else if (target.dataset.addPhoto) voyaraAddPhotos(target.dataset.addPhoto);
    else if (target.dataset.addNote) voyaraShowNoteForm(target.dataset.addNote);
    else if (target.dataset.createCollage) voyaraOpenCollageEditor(target.dataset.createCollage);
    else if (target.dataset.deleteAlbum) voyaraDeleteAlbum(target.dataset.deleteAlbum);
    else if (target.dataset.deletePhoto) voyaraDeletePhoto(target.dataset.deletePhoto, target.dataset.photoId);
    else if (target.dataset.deleteNote) voyaraDeleteNote(target.dataset.deleteNote, target.dataset.noteId);
    else if (target.dataset.deleteCollage) voyaraDeleteCollage(target.dataset.deleteCollage, target.dataset.collageId);
    else if (target.dataset.exportCollage) voyaraExportSavedCollage(target.dataset.exportCollage, target.dataset.collageId);
    else if (target.id === "voyaraCancelCollageBtn") { $("voyaraCollageEditor")?.classList.add("hidden"); }
    else if (target.id === "voyaraSaveCollageBtn") voyaraSaveCollage(false);
    else if (target.id === "voyaraExportCollageBtn") voyaraSaveCollage(true);
    else if (target.dataset.cancelNote) voyaraOpenAlbum(target.dataset.cancelNote);
    else if (target.dataset.saveNote) voyaraSaveNote(target.dataset.saveNote);
  });
  section.addEventListener("change", event => {
    if (event.target.id === "voyaraCollageLayout" || event.target.id === "voyaraCollageTheme" || event.target.matches("[data-collage-photo]")) {
      voyaraRenderCollagePreview();
      voyaraSaveCollageDraft();
    }
  });
  section.addEventListener("input", event => {
    if (event.target.id === "voyaraCollageTitle" || event.target.id === "voyaraCollageCaption") { voyaraRenderCollagePreview(); voyaraSaveCollageDraft(); }
  });
}

function voyaraCreateAlbum() {
  const name = $("voyaraAlbumName")?.value.trim();
  const destination = $("voyaraAlbumDestination")?.value.trim() || "";
  if (!name) { alert("Please enter an album name."); return; }
  const albums = voyaraAlbums();
  const album = { id: voyaraId("album"), name, destination, photos: [], notes: [], collages: [], createdAt: new Date().toISOString() };
  albums.unshift(album); voyaraSaveAlbums(albums); voyaraSetCurrentAlbumId(album.id);
  $("voyaraAlbumName").value = ""; $("voyaraAlbumDestination").value = ""; $("voyaraCreateAlbumForm")?.classList.add("hidden");
  renderScrapbook(); voyaraToast("Album created.");
}

function voyaraOpenAlbum(id) { voyaraSetCurrentAlbumId(id); renderScrapbook(); setTimeout(() => $("voyaraAlbumDetail")?.scrollIntoView({behavior:"smooth",block:"start"}), 60); }

function voyaraAddPhotos(albumId) {
  const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true; input.hidden = true; document.body.appendChild(input);
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []); if (!files.length) { input.remove(); return; }
    const albums = voyaraAlbums(); const album = albums.find(a => String(a.id) === String(albumId)); if (!album) { input.remove(); return; }
    let remaining = files.length;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        album.photos.push({id:voyaraId("photo"), src:reader.result, name:file.name, caption:"", addedAt:new Date().toISOString()});
        remaining -= 1;
        if (remaining === 0) { voyaraSaveAlbums(albums); renderScrapbook(); updateHomeStats(); voyaraToast(`${files.length} photo${files.length===1?'':'s'} added to the album.`); }
      };
      reader.readAsDataURL(file);
    });
    input.remove();
  });
  input.click();
}

function voyaraShowNoteForm(albumId) {
  const detail = $("voyaraAlbumDetail"); if (!detail) return;
  detail.querySelector(".voyara-note-form")?.remove();
  const form = document.createElement("div"); form.className = "voyara-note-form";
  form.innerHTML = `<h4>Add a memory note</h4><label>Title<input id="voyaraNoteTitle" placeholder="e.g. Sunset at the beach"></label><label>Note<textarea id="voyaraNoteText" rows="4" placeholder="Write a short memory, tip, or moment you want to keep."></textarea></label><div class="voyara-post-actions"><button type="button" class="primary-button" data-save-note="${escapeHtml(albumId)}">Save note</button><button type="button" class="secondary-button" data-cancel-note="${escapeHtml(albumId)}">Cancel</button></div>`;
  detail.prepend(form); $("voyaraNoteText")?.focus();
}

function voyaraSaveNote(albumId) {
  const text = $("voyaraNoteText")?.value.trim(); if (!text) { alert("Please write a note first."); return; }
  const title = $("voyaraNoteTitle")?.value.trim() || "Travel memory";
  const albums = voyaraAlbums(); const album = albums.find(a => String(a.id) === String(albumId)); if (!album) return;
  album.notes.unshift({id:voyaraId("note"),title,text,createdAt:new Date().toISOString()}); voyaraSaveAlbums(albums); renderScrapbook(); updateHomeStats(); voyaraToast("Memory note saved.");
}

function voyaraDeleteAlbum(id) {
  if (!confirm("Delete this album and the photos stored inside it? This cannot be undone.")) return;
  voyaraSaveAlbums(voyaraAlbums().filter(a => String(a.id) !== String(id))); if (voyaraCurrentAlbumId() === String(id)) voyaraSetCurrentAlbumId(""); renderScrapbook(); updateHomeStats();
}

function voyaraDeletePhoto(albumId, photoId) {
  const albums=voyaraAlbums(); const album=albums.find(a=>String(a.id)===String(albumId)); if(!album)return;
  album.photos=album.photos.filter(p=>String(p.id)!==String(photoId)); voyaraSaveAlbums(albums); renderScrapbook(); updateHomeStats();
}
function voyaraDeleteNote(albumId,noteId){const albums=voyaraAlbums();const album=albums.find(a=>String(a.id)===String(albumId));if(!album)return;album.notes=album.notes.filter(n=>String(n.id)!==String(noteId));voyaraSaveAlbums(albums);renderScrapbook();updateHomeStats();}
function voyaraDeleteCollage(albumId,collageId){const albums=voyaraAlbums();const album=albums.find(a=>String(a.id)===String(albumId));if(!album)return;album.collages=album.collages.filter(c=>String(c.id)!==String(collageId));voyaraSaveAlbums(albums);renderScrapbook();}

function voyaraOpenCollageEditor(albumId) {
  const album=voyaraAlbumById(albumId); if(!album){return;}
  if(!album.photos.length){alert("Add at least one photo before creating a collage.");return;}
  const editor=$("voyaraCollageEditor"); if(!editor)return;
  const draft=voyaraGetJSON(VOYARA_COLLAGE_DRAFT_KEY,{});
  const selected=Array.isArray(draft.selected)?draft.selected.filter(id=>album.photos.some(p=>String(p.id)===String(id))):album.photos.slice(0,4).map(p=>p.id);
  editor.innerHTML=`<div class="voyara-collage-editor-heading"><div><span class="eyebrow">CREATE A PAGE</span><h3>Create a collage</h3><p class="voyara-muted">Choose the photos you want, then pick a layout and theme. Your original photos stay in the album.</p></div><button type="button" class="secondary-button" id="voyaraCancelCollageBtn">Close</button></div><div class="voyara-collage-fields"><label>Page title<input id="voyaraCollageTitle" value="${escapeHtml(draft.title||album.name)}" maxlength="60"></label><label>Layout<select id="voyaraCollageLayout"><option value="grid">Clean grid</option><option value="polaroid">Polaroid</option><option value="film">Film strip</option></select></label><label>Theme<select id="voyaraCollageTheme"><option value="sage">Sage</option><option value="coastal">Coastal</option><option value="night">Night</option><option value="terracotta">Warm</option></select></label></div><div><h4>Select photos</h4><div class="voyara-collage-photo-picker">${album.photos.map(p=>`<label class="voyara-collage-pick"><img src="${p.src}" alt=""><input type="checkbox" data-collage-photo value="${p.id}" ${selected.includes(p.id)?'checked':''}><span>${escapeHtml(p.name||'Photo')}</span></label>`).join('')}</div></div><label class="voyara-collage-caption-label">Caption (optional)<input id="voyaraCollageCaption" placeholder="A short line about this memory" value="${escapeHtml(draft.caption||'')}"></label><div id="voyaraCollagePreview" class="voyara-collage-preview"></div><div class="voyara-post-actions"><button type="button" class="primary-button" id="voyaraSaveCollageBtn">Save collage</button><button type="button" class="secondary-button" id="voyaraExportCollageBtn">Export as image</button></div>`;
  editor.classList.remove("hidden");
  if(draft.layout) $("voyaraCollageLayout").value=draft.layout;
  if(draft.theme) $("voyaraCollageTheme").value=draft.theme;
  voyaraSetCurrentAlbumId(albumId); voyaraRenderCollagePreview(); editor.scrollIntoView({behavior:"smooth",block:"start"});
}

function voyaraSelectedCollagePhotos() { const album=voyaraAlbumById(voyaraCurrentAlbumId()); if(!album)return []; return Array.from(document.querySelectorAll("[data-collage-photo]:checked")).map(x=>album.photos.find(p=>String(p.id)===String(x.value))).filter(Boolean); }
function voyaraSaveCollageDraft(){const data={title:$("voyaraCollageTitle")?.value||"",caption:$("voyaraCollageCaption")?.value||"",layout:$("voyaraCollageLayout")?.value||"grid",theme:$("voyaraCollageTheme")?.value||"sage",selected:Array.from(document.querySelectorAll("[data-collage-photo]:checked")).map(x=>x.value)};voyaraSetJSON(VOYARA_COLLAGE_DRAFT_KEY,data);}
function voyaraRenderCollagePreview(){const preview=$("voyaraCollagePreview");if(!preview)return;const photos=voyaraSelectedCollagePhotos();const layout=$("voyaraCollageLayout")?.value||"grid";const theme=$("voyaraCollageTheme")?.value||"sage";const title=$("voyaraCollageTitle")?.value.trim()||"Travel memories";const caption=$("voyaraCollageCaption")?.value.trim()||"";preview.dataset.layout=layout;preview.dataset.theme=theme;preview.innerHTML=`<div class="voyara-collage-preview-title">${escapeHtml(title)}</div><div class="voyara-collage-preview-grid">${photos.length?photos.map((p,i)=>`<figure><img src="${p.src}" alt=""><figcaption>${escapeHtml(p.caption||p.name||`Memory ${i+1}`)}</figcaption></figure>`).join(''):'<p class="voyara-muted">Select at least one photo to preview the page.</p>'}</div>${caption?`<div class="voyara-collage-preview-caption">${escapeHtml(caption)}</div>`:''}`;}

async function voyaraBuildCollageDataUrl(albumId, collage) {
  const album=voyaraAlbumById(albumId); if(!album)return null;
  const photos=collage.photos.map(id=>album.photos.find(p=>String(p.id)===String(id))).filter(Boolean); if(!photos.length)return null;
  const width=1200, pad=70, gap=24, titleH=120, cellW=530, cellH=360, cols=2, rows=Math.ceil(photos.length/cols), height=titleH+pad*2+rows*cellH+(rows-1)*gap+80;
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height; const ctx=canvas.getContext('2d');
  const backgrounds={sage:'#e2f0eb',coastal:'#e8f1f5',night:'#172b26',terracotta:'#f4e6da'}; const text=collage.theme==='night'?'#f4f5ed':'#153844'; ctx.fillStyle=backgrounds[collage.theme]||backgrounds.sage; ctx.fillRect(0,0,width,height);
  ctx.fillStyle=text; ctx.font='700 42px Georgia'; ctx.fillText(collage.title||album.name, pad, 72);
  const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
  for(let i=0;i<photos.length;i++){const img=await loadImage(photos[i].src);const col=i%cols,row=Math.floor(i/cols);const x=pad+col*(cellW+gap),y=titleH+row*(cellH+gap);ctx.fillStyle='#ffffff';ctx.fillRect(x,y,cellW,cellH);const scale=Math.max(cellW/img.width,(cellH-45)/img.height);const dw=img.width*scale,dh=img.height*scale;ctx.save();ctx.beginPath();ctx.rect(x,y,cellW,cellH-45);ctx.clip();ctx.drawImage(img,x+(cellW-dw)/2,y+(cellH-45-dh)/2,dw,dh);ctx.restore();ctx.fillStyle='#53625a';ctx.font='18px Arial';ctx.fillText(photos[i].caption||photos[i].name||`Photo ${i+1}`,x+12,y+cellH-28);}
  if(collage.caption){ctx.fillStyle=text;ctx.font='italic 24px Georgia';ctx.fillText(collage.caption,pad,height-35);}
  return canvas.toDataURL('image/png');
}

async function voyaraSaveCollage(exportOnly) {
  const albumId=voyaraCurrentAlbumId(); const photos=voyaraSelectedCollagePhotos(); if(!photos.length){alert("Select at least one photo for the collage.");return;}
  const collage={id:voyaraId("collage"),title:$("voyaraCollageTitle")?.value.trim()||"Travel memories",caption:$("voyaraCollageCaption")?.value.trim()||"",layout:$("voyaraCollageLayout")?.value||"grid",theme:$("voyaraCollageTheme")?.value||"sage",photos:photos.map(p=>p.id),createdAt:new Date().toISOString()};
  const dataUrl=await voyaraBuildCollageDataUrl(albumId,collage); if(!dataUrl)return;
  if(exportOnly){const a=document.createElement('a');a.href=dataUrl;a.download=`voyara-collage-${Date.now()}.png`;a.click();voyaraToast('Collage exported as an image.');return;}
  const albums=voyaraAlbums();const album=albums.find(a=>String(a.id)===String(albumId));if(!album)return;collage.dataUrl=dataUrl;album.collages.unshift(collage);voyaraSaveAlbums(albums);localStorage.removeItem(VOYARA_COLLAGE_DRAFT_KEY);renderScrapbook();voyaraToast('Collage saved to the album.');
}
async function voyaraExportSavedCollage(albumId,collageId){const album=voyaraAlbumById(albumId);const collage=album?.collages.find(c=>String(c.id)===String(collageId));if(!collage)return;if(collage.dataUrl){const a=document.createElement('a');a.href=collage.dataUrl;a.download=`voyara-collage-${Date.now()}.png`;a.click();return;}const data=await voyaraBuildCollageDataUrl(albumId,collage);if(data){const a=document.createElement('a');a.href=data;a.download=`voyara-collage-${Date.now()}.png`;a.click();}}

function renderScrapbook() {
  const section=voyaraEnsureScrapbookShell(); if(!section)return; voyaraSyncTripAlbums(); const albums=voyaraAlbums();
  const list=$("voyaraAlbumList"), count=$("voyaraAlbumCount"), detail=$("voyaraAlbumDetail"), editor=$("voyaraCollageEditor");
  if(count)count.textContent=`${albums.length} album${albums.length===1?'':'s'}`;
  if(list){
    list.innerHTML=albums.length?albums.map(a=>`<article class="voyara-album-card"><div class="voyara-album-card-cover">${a.photos[0]?`<img src="${a.photos[0].src}" alt="">`:'<span>♡</span>'}</div><div class="voyara-album-card-body"><h4>${escapeHtml(a.name)}</h4><p>${escapeHtml(a.destination||'Personal memories')}</p><small>${a.photos.length} photo${a.photos.length===1?'':'s'} · ${a.notes.length} note${a.notes.length===1?'':'s'}</small><button type="button" class="secondary-button" data-open-album="${escapeHtml(a.id)}">Open album</button></div></article>`).join(''):`<div class="voyara-scrapbook-empty"><div class="voyara-scrapbook-empty-icon">♡</div><h3>No albums yet</h3><p>Create your first album to keep photos and memories together. Saved journeys can also get their own album automatically.</p><button type="button" class="primary-button" id="voyaraCreateAlbumBtn">Create my first album</button></div>`;
  }
  const current=voyaraAlbumById(voyaraCurrentAlbumId());
  if(!current){detail?.classList.add('hidden');editor?.classList.add('hidden');return;}
  if(detail){detail.classList.remove('hidden');detail.innerHTML=`<div class="voyara-album-detail-heading"><div><span class="eyebrow">OPEN ALBUM</span><h3>${escapeHtml(current.name)}</h3><p>${escapeHtml(current.destination||'Personal memories')}</p></div><div class="voyara-post-actions"><button type="button" class="primary-button" data-add-photo="${escapeHtml(current.id)}">＋ Add photos</button><button type="button" class="secondary-button" data-add-note="${escapeHtml(current.id)}">＋ Add note</button><button type="button" class="secondary-button" data-create-collage="${escapeHtml(current.id)}">Create collage</button><button type="button" class="text-button danger" data-delete-album="${escapeHtml(current.id)}">Delete album</button></div></div><div class="voyara-photo-panel"><div class="voyara-photo-panel-heading"><div><h4>Photo gallery</h4><p class="voyara-muted">Your original photos stay here. Add as many as you like.</p></div><span>${current.photos.length} photo${current.photos.length===1?'':'s'}</span></div><div class="voyara-album-photo-grid">${current.photos.length?current.photos.map(p=>`<article class="voyara-album-photo"><img src="${p.src}" alt="${escapeHtml(p.name||'Travel photo')}"><div class="voyara-photo-actions"><button type="button" class="text-button danger" data-delete-photo="${escapeHtml(current.id)}" data-photo-id="${escapeHtml(p.id)}">Delete</button></div></article>`).join(''):`<div class="voyara-inline-empty"><strong>No photos yet.</strong><span>Click “Add photos” above to add your first travel photos.</span></div>`}</div></div><div class="voyara-memory-notes"><div class="voyara-photo-panel-heading"><div><h4>Memory notes</h4><p class="voyara-muted">Short notes help you remember the story behind your photos.</p></div></div>${current.notes.length?current.notes.map(n=>`<article class="voyara-note-card"><div><h5>${escapeHtml(n.title)}</h5><p>${escapeHtml(n.text)}</p></div><button type="button" class="text-button danger" data-delete-note="${escapeHtml(current.id)}" data-note-id="${escapeHtml(n.id)}">Delete</button></article>`).join(''):`<div class="voyara-inline-empty"><strong>No notes yet.</strong><span>Add a note only when you have something you want to remember.</span></div>`}</div><div class="voyara-scrapbook-pages"><div class="voyara-photo-panel-heading"><div><h4>Saved collages</h4><p class="voyara-muted">Finished scrapbook pages are saved here.</p></div></div><div class="voyara-saved-pages-grid">${current.collages.length?current.collages.map(c=>`<article class="voyara-saved-page"><img src="${c.dataUrl}" alt="${escapeHtml(c.title)}"><strong>${escapeHtml(c.title)}</strong><small>${new Date(c.createdAt).toLocaleDateString()}</small><div class="voyara-photo-actions"><button type="button" class="secondary-button" data-export-collage="${escapeHtml(current.id)}" data-collage-id="${escapeHtml(c.id)}">Export</button><button type="button" class="text-button danger" data-delete-collage="${escapeHtml(current.id)}" data-collage-id="${escapeHtml(c.id)}">Delete</button></div></article>`).join(''):`<div class="voyara-inline-empty"><strong>No collages yet.</strong><span>Choose “Create collage” after adding photos.</span></div>`}</div></div>`;}
  if(editor)editor.classList.add('hidden');
}

function updateHomeStats() {
  const journeys=getSavedJourneys(); const albums=voyaraAlbums(); const memoryCount=getMemories().length + albums.reduce((sum,a)=>sum+(a.photos?.length||0)+(a.notes?.length||0),0);
  setText("savedTripsStat",String(journeys.length)); setText("memoryStat",String(memoryCount)); setText("destinationStat",String(new Set([...exploreDestinations.map(d=>d.name),...journeys.map(j=>j.destination).filter(Boolean)]).size)); setText("savedJourneysCount",String(journeys.length));
}

function addChatbot() {
  if ($("voyaraChatLauncher")) return;
  const launcher=document.createElement("button"); launcher.id="voyaraChatLauncher"; launcher.type="button"; launcher.className="voyara-chat-launcher"; launcher.textContent="✦ Ask Voyara"; launcher.setAttribute("aria-label","Ask Voyara");
  const panel=document.createElement("section"); panel.id="voyaraChatPanel"; panel.className="voyara-chat-panel hidden"; panel.setAttribute("aria-label","Voyara AI assistant");
  panel.innerHTML=`<div class="voyara-chat-head"><div><strong>Voyara Assistant</strong><span>Your travel companion</span></div><button type="button" id="voyaraChatClose" aria-label="Close">×</button></div><div id="voyaraChatMessages" class="voyara-chat-messages"><div class="voyara-chat-message bot">Hi! I’m Voyara. Ask me about your trip, itinerary, budget, packing, or how to use the website.</div></div><form id="voyaraChatForm" class="voyara-chat-form"><input id="voyaraChatInput" placeholder="Ask Voyara anything…" autocomplete="off" required><button type="submit">Send</button></form>`;
  document.body.append(launcher,panel);
  launcher.addEventListener("click",()=>panel.classList.toggle("hidden")); $("voyaraChatClose")?.addEventListener("click",()=>panel.classList.add("hidden"));
  $("voyaraChatForm")?.addEventListener("submit",async e=>{e.preventDefault();const input=$("voyaraChatInput");const message=input.value.trim();if(!message)return;input.value="";const box=$("voyaraChatMessages");const user=document.createElement("div");user.className="voyara-chat-message user";user.textContent=message;box.appendChild(user);const loading=document.createElement("div");loading.className="voyara-chat-message bot";loading.textContent="Thinking…";box.appendChild(loading);box.scrollTop=box.scrollHeight;try{const response=await fetch(`${API_BASE}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,history:[],context:{section:document.querySelector('.page-section.active-section')?.id||'home',destination:$("destination")?.value||"",hasItinerary:Boolean(currentItinerary)}})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||"Assistant unavailable");loading.textContent=data.reply;}catch(error){loading.textContent="I can’t reach the AI service right now. Make sure Terminal 1 is running and check http://127.0.0.1:5000/api/health."}box.scrollTop=box.scrollHeight;});
}

function voyaraRemoveFloatingThemeButton(){ document.getElementById("voyaraThemeBtn")?.remove(); document.querySelectorAll('[id*="themeBtn"],.floating-theme-button').forEach(el=>{ if(el.id!=="voyaraThemeBtn") el.remove(); }); }

document.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{voyaraRemoveFloatingThemeButton();voyaraEnsureScrapbookShell();voyaraBindScrapbookV2();renderScrapbook();addChatbot();updateHomeStats();},80);});


/* ============================================================
   VOYARA FINAL DESTINATION DISCOVERY + FOR YOU PASS
   Locked requirements: 4 default Explore destinations, arbitrary
   destination details, Plan this trip, five For You categories,
   destination-specific place search, no fake/unavailable ratings.
============================================================ */

const VOYARA_FOR_YOU_CATEGORIES = [
  "Food & Cafés",
  "Attractions & Culture",
  "Nature & Outdoors",
  "Experiences & Activities",
  "Shopping & Local Markets"
];

const VOYARA_EXPLORE_DESTINATIONS_FINAL = [
  { name:"Munnar", state:"Kerala, India", description:"Tea gardens, misty hills and peaceful nature.", image:"https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=900&q=85", latitude:10.0889, longitude:77.0595 },
  { name:"Goa", state:"India", description:"Beaches, local food and relaxed coastal experiences.", image:"https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=85", latitude:15.2993, longitude:74.124 },
  { name:"Jaipur", state:"Rajasthan, India", description:"Forts, colourful markets and rich history.", image:"https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=900&q=85", latitude:26.9124, longitude:75.7873 },
  { name:"Coorg", state:"Karnataka, India", description:"Coffee plantations, waterfalls and green landscapes.", image:"https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=85", latitude:12.3375, longitude:75.8069 }
];

let voyaraExploreSearchRequest = 0;
let voyaraForYouResults = [];

function voyaraExploreCard(destination, searched=false) {
  return `<article class="destination-card ${searched ? 'destination-card-searched' : ''}">
    <div class="destination-card-image"><img src="${escapeHtml(destination.image || 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=85')}" alt="${escapeHtml(destination.name)} travel destination" loading="lazy"></div>
    <div class="destination-card-body">
      <span>${escapeHtml(destination.state || 'Destination')}</span>
      <h3>${escapeHtml(destination.name)}</h3>
      <p>${escapeHtml(destination.description || `Discover ${destination.name}.`)}</p>
      <div class="destination-card-actions">
        <button type="button" class="secondary-button" data-explore-details="${escapeHtml(destination.name)}">See details</button>
        <button type="button" class="primary-button" data-plan-destination="${escapeHtml(destination.name)}">Plan this trip</button>
      </div>
    </div>
  </article>`;
}

async function voyaraSearchDestination(query) {
  const term = String(query || "").trim();
  if (!term) { renderExploreDestinationsFinal(""); return; }
  const requestId = ++voyaraExploreSearchRequest;
  const grid = $("destinationGrid");
  if (grid) grid.innerHTML = `<div class="explore-search-state"><strong>Searching for ${escapeHtml(term)}...</strong><span>Finding the destination and preparing its travel details.</span></div>`;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(term)}`, { headers:{"Accept-Language":"en"} });
    if (!response.ok) throw new Error("Search service unavailable");
    const results = await response.json();
    if (requestId !== voyaraExploreSearchRequest) return;
    if (!results.length) {
      if (grid) grid.innerHTML = `<div class="explore-search-state"><strong>No matching destination found.</strong><span>Try a city, state, country or a more specific place name.</span></div>`;
      return;
    }
    const exact = results.find(r => String(r.display_name||"").toLowerCase().startsWith(term.toLowerCase())) || results[0];
    const address = exact.address || {};
    const destination = {
      name: exact.name || term,
      state: [address.state, address.country].filter(Boolean).join(", ") || exact.display_name || "Search result",
      description: exact.display_name || `Explore ${term}.`,
      latitude:Number(exact.lat), longitude:Number(exact.lon),
      image:"https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=85",
      searched:true,
      location:exact.display_name || ""
    };
    if (grid) grid.innerHTML = voyaraExploreCard(destination, true);
    if (mapInstance) {
      mapInstance.setView([destination.latitude,destination.longitude], 10);
      mapInstance.eachLayer(layer => { if (layer instanceof L.Marker) mapInstance.removeLayer(layer); });
      L.marker([destination.latitude,destination.longitude]).addTo(mapInstance).bindPopup(`<div class="voyara-map-popup"><strong>${escapeHtml(destination.name)}</strong><br>${escapeHtml(destination.location)}<br><button type="button" onclick="window.voyaraPlanDestination('${escapeHtml(destination.name)}')">Plan this trip</button></div>`).openPopup();
      setTimeout(()=>mapInstance.invalidateSize(),100);
    }
    if ($("mapPlaces")) $("mapPlaces").innerHTML = `<span>Showing ${escapeHtml(destination.name)} on the map.</span>`;
  } catch (error) {
    if (grid) grid.innerHTML = `<div class="explore-search-state"><strong>We couldn't search right now.</strong><span>Please check your internet connection and try again.</span></div>`;
  }
}

function renderExploreDestinationsFinal(searchTerm="") {
  const grid=$("destinationGrid"); if(!grid) return;
  const term=String(searchTerm||"").trim().toLowerCase();
  if (!term) {
    grid.innerHTML = VOYARA_EXPLORE_DESTINATIONS_FINAL.map(d=>voyaraExploreCard(d)).join("");
    if ($("mapPlaces")) $("mapPlaces").innerHTML = "Four suggested destinations are shown on the map. Search any other place above.";
    return;
  }
  const known=VOYARA_EXPLORE_DESTINATIONS_FINAL.filter(d => `${d.name} ${d.state}`.toLowerCase().includes(term));
  if(known.length){
    grid.innerHTML=known.map(d=>voyaraExploreCard(d)).join("");
    if ($("mapPlaces")) $("mapPlaces").innerHTML = `Showing ${escapeHtml(known[0].name)} and its suggested location.`;
  } else {
    voyaraSearchDestination(searchTerm);
  }
}

async function openExploreDetails(destinationName) {
  const modal=$("destinationModal"), content=$("destinationModalContent");
  if(!modal||!content)return;
  content.innerHTML=`<div class="destination-guide-loading"><strong>Preparing ${escapeHtml(destinationName)}...</strong><span>Getting destination information.</span></div>`;
  showElement(modal);
  try {
    const geo=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(destinationName)}`,{headers:{"Accept-Language":"en"}});
    const places=geo.ok?await geo.json():[];
    const place=places[0]||{};
    let guide={description:`Explore ${destinationName}.`,introduction:`${destinationName} offers a range of travel experiences. Check current local information before travelling.`,bestTime:"Check seasonal weather for your dates.",duration:"Choose a duration based on the places you want to visit.",budget:"Compare transport, accommodation, food and activity costs."};
    try {
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),5000);
      const r=await fetch(`${API_BASE}/api/destination-guide`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({destination:destinationName,location:place.display_name||"",type:place.type||"place"}),signal:controller.signal});
      clearTimeout(timeout);
      const data=await r.json();
      if(r.ok&&data.success) guide={...guide,...data};
    } catch (_) {
      // Do not leave the Explore modal stuck on "Preparing details".
      // The local fallback below is shown immediately if AI guidance is slow.
    }
    content.innerHTML=`<div class="destination-modal-image"><img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=85" alt="${escapeHtml(destinationName)}"><div><span class="eyebrow">DESTINATION GUIDE</span><h2>${escapeHtml(destinationName)}</h2><p>${escapeHtml(place.display_name||"")}</p></div></div><div class="destination-modal-body"><p>${escapeHtml(guide.introduction||guide.description)}</p><div class="destination-guide-facts"><div><span>Best time</span><strong>${escapeHtml(guide.bestTime)}</strong></div><div><span>Suggested duration</span><strong>${escapeHtml(guide.duration)}</strong></div><div><span>Budget</span><strong>${escapeHtml(guide.budget)}</strong></div></div><div class="destination-modal-actions"><button type="button" class="secondary-button" id="destinationDetailsCloseBtn">Close</button><button type="button" class="primary-button" id="destinationDetailsPlanBtn">Plan this trip →</button></div></div>`;
    $("destinationDetailsCloseBtn")?.addEventListener("click",()=>hideElement(modal));
    $("destinationDetailsPlanBtn")?.addEventListener("click",()=>{hideElement(modal);window.voyaraPlanDestination(destinationName);});
  } catch(error) {
    content.innerHTML=`<div class="destination-search-error"><strong>Destination details are temporarily unavailable.</strong><p>You can still plan this trip now.</p><button type="button" class="primary-button" id="destinationDetailsPlanBtn">Plan this trip →</button></div>`;
    $("destinationDetailsPlanBtn")?.addEventListener("click",()=>{hideElement(modal);window.voyaraPlanDestination(destinationName);});
  }
}

function bindExploreFinal() {
  const input=$("exploreSearch"), button=$("exploreSearchBtn"), grid=$("destinationGrid");
  if(!input||!button||!grid)return;
  const run=()=>renderExploreDestinationsFinal(input.value);
  button.addEventListener("click",run);
  input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();run();}});
  input.addEventListener("input",()=>{if(!input.value.trim())renderExploreDestinationsFinal("");});
  grid.addEventListener("click",e=>{const details=e.target.closest("[data-explore-details]");const plan=e.target.closest("[data-plan-destination]");if(details)openExploreDetails(details.dataset.exploreDetails);if(plan)window.voyaraPlanDestination(plan.dataset.planDestination);});
  renderExploreDestinationsFinal("");
  setTimeout(()=>initializeMap(),120);
}

function voyaraForYouCard(item) {
  const saved=voyaraGetJSON(VOYARA_SAVED_PLACES_KEY,[]);
  const isSaved=saved.some(p=>String(p.id)===String(item.id));
  const rating=item.rating!==null&&item.rating!==undefined ? `<div class="voyara-place-rating">★ ${Number(item.rating).toFixed(1)}${item.ratingCount?` <small>(${Number(item.ratingCount).toLocaleString()} reviews)</small>`:""}</div>` : "";
  return `<article class="voyara-place-card"><div class="voyara-place-card-body"><span class="voyara-place-type">${escapeHtml(item.type||item.category)}</span><h4>${escapeHtml(item.name)}</h4>${rating}<p>${escapeHtml(item.address||item.destination||"")}</p><div class="voyara-place-actions"><a href="${escapeHtml(item.mapUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name+', '+item.destination)}`)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a><button type="button" data-save-final-place="${escapeHtml(item.id)}">${isSaved?'✓ Saved':'♡ Wishlist'}</button><button type="button" data-add-final-place="${escapeHtml(item.id)}">Add to itinerary</button></div></div></article>`;
}

function renderForYouResults() {
  const grid=$("recommendationGrid"); if(!grid)return;
  const category=$("forYouCategory")?.value||"all";
  if(!voyaraForYouResults.length){grid.innerHTML=`<div class="for-you-empty"><strong>Search a destination to discover places.</strong><span>Choose one of the five categories or view all five categories together.</span></div>`;return;}
  const groups=category==="all" ? VOYARA_FOR_YOU_CATEGORIES.map(cat=>({cat,items:voyaraForYouResults.filter(x=>x.category===cat).slice(0,4)})).filter(g=>g.items.length) : [{cat:category,items:voyaraForYouResults.filter(x=>x.category===category).slice(0,4)}];
  if(!groups.some(g=>g.items.length)){grid.innerHTML=`<div class="for-you-empty"><strong>No matching places were found for this category.</strong><span>Try another category or a more specific destination.</span></div>`;return;}
  grid.innerHTML=groups.map(g=>`<section class="voyara-category-results"><div class="voyara-category-results-heading"><div><span class="eyebrow">${escapeHtml(g.cat)}</span><h3>${g.cat}</h3></div><span>${g.items.length} recommendations</span></div><div class="voyara-category-results-grid">${g.items.map(voyaraForYouCard).join("")}</div></section>`).join("");
  grid.querySelectorAll("[data-save-final-place]").forEach(btn=>btn.addEventListener("click",()=>{const item=voyaraForYouResults.find(x=>String(x.id)===String(btn.dataset.saveFinalPlace));if(!item)return;let saved=voyaraGetJSON(VOYARA_SAVED_PLACES_KEY,[]);const idx=saved.findIndex(x=>String(x.id)===String(item.id));if(idx>=0){saved.splice(idx,1);btn.textContent="♡ Wishlist";}else{saved.push({...item,savedAt:new Date().toISOString()});btn.textContent="✓ Saved";}voyaraSetJSON(VOYARA_SAVED_PLACES_KEY,saved);updateHomeStats();}));
  grid.querySelectorAll("[data-add-final-place]").forEach(btn=>btn.addEventListener("click",()=>{const item=voyaraForYouResults.find(x=>String(x.id)===String(btn.dataset.addFinalPlace));if(!item)return;window.voyaraPlanDestination(item.destination);const pref=$("preferences");if(pref)pref.value=`${pref.value?pref.value+"; ":""}Include ${item.name}`;voyaraToast(`${item.name} added to your trip preferences.`);}));
}

async function searchForYouPlaces() {
  const destination=$("forYouSearch")?.value.trim()||"";
  const category=$("forYouCategory")?.value||"all";
  const grid=$("recommendationGrid");
  const note=$("forYouSourceNote");
  if(!destination){
    grid.innerHTML=`<div class="for-you-empty"><strong>Enter a destination first.</strong><span>For example: Goa, Kashmir, Kerala, Paris or Tokyo.</span></div>`;
    return;
  }
  grid.innerHTML=`<div class="for-you-loading"><strong>Finding places in ${escapeHtml(destination)}...</strong><span>Searching the selected category and preparing recommendations.</span></div>`;
  if(note)note.textContent="";
  const categories=category==="all"?VOYARA_FOR_YOU_CATEGORIES:[category];
  try {
    const results=[];
    const sources=new Set();

    for(const cat of categories){
      try {
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),7000);
        const response=await fetch(`${API_BASE}/api/places`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({destination,category:cat,query:""}),
          signal:controller.signal
        });
        clearTimeout(timeout);
        let data={};
        try { data=await response.json(); } catch (_) {}
        if(!response.ok||!data.success) continue;
        sources.add(data.source||"");
        (data.results||[]).forEach(item=>{
          if(!results.some(r=>String(r.id)===String(item.id))) results.push(item);
        });
      } catch (_) {}
    }

    voyaraForYouResults=results;
    if(note) note.textContent=sources.has("Google Places")?"Recommendations are from Google Places. Ratings are shown only when Google supplies them.":"Recommendations are from OpenStreetMap. Ratings are shown only when a real rating is supplied by the source.";
    renderForYouResults();
  } catch(error) {
    voyaraForYouResults=[];
    grid.innerHTML=`<div class="for-you-empty"><strong>Recommendations are temporarily unavailable.</strong><span>Check that the backend is running and try again.</span></div>`;
  }
}
function bindRecommendationsFinal() {
  const input=$("forYouSearch"), select=$("forYouCategory"), button=$("forYouSearchBtn");
  if(!input||!select||!button)return;
  const run=()=>searchForYouPlaces();
  button.addEventListener("click",run);
  input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();run();}});
  select.addEventListener("change",()=>{if(input.value.trim())run();});
  renderForYouResults();
}

function bindPrintControlsFinal() {
  const button=$("printItineraryPdfBtn");
  if(button&&!button.dataset.bound){button.dataset.bound="true";button.addEventListener("click",printItinerary);}
  window.addEventListener("beforeprint",()=>document.body.classList.add("voyara-printing"));
  window.addEventListener("afterprint",()=>document.body.classList.remove("voyara-printing"));
}

function voyaraRemoveFloatingThemeButtonFinal(){
  document.getElementById("voyaraThemeBtn")?.remove();
  document.querySelectorAll('[id*="themeBtn"],.floating-theme-button,.voyara-theme-fab').forEach(el=>el.remove());
}

document.addEventListener("DOMContentLoaded",()=>{
  setTimeout(()=>{
    voyaraRemoveFloatingThemeButtonFinal();
    bindPrintControlsFinal();
    if($("destinationModal")) $("destinationModal").addEventListener("click",e=>{if(e.target.id==="destinationModal")hideElement($("destinationModal"));});
    // Use the final fixed Explore/For You data and controls.
    renderExploreDestinationsFinal($("exploreSearch")?.value||"");
    renderForYouResults();
  },120);
});
