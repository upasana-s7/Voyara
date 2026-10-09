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
// ACCOUNT / AUTHENTICATION
// Browser-local prototype authentication.
// ============================================================

const VOYARA_ACCOUNT_KEYS = [
  "voyaraUserName",
  "voyaraUserEmail",
  "voyaraUserPhone",
  "voyaraUserIdentifier"
];

const VOYARA_ACCOUNTS_KEY = "voyaraAccountsV2";

function voyaraGetAccounts() {
  try {
    return JSON.parse(
      localStorage.getItem(VOYARA_ACCOUNTS_KEY) || "{}"
    );
  } catch (_) {
    return {};
  }
}

function voyaraSaveAccounts(accounts) {
  localStorage.setItem(
    VOYARA_ACCOUNTS_KEY,
    JSON.stringify(accounts)
  );
}

function voyaraNormalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function voyaraAccountMessage(message) {
  const existing = $("voyaraAuthMessage");
  if (existing) {
    existing.textContent = message;
    existing.classList.remove("hidden");
    return;
  }

  const form = $("nameForm");
  if (form) {
    const note = document.createElement("p");
    note.id = "voyaraAuthMessage";
    note.className = "voyara-auth-message";
    note.textContent = message;
    form.insertAdjacentElement("afterend", note);
  }
}

function voyaraLoadAccountData(identifier, name) {
  const key = voyaraNormalizeIdentifier(identifier);
  const accounts = voyaraGetAccounts();
  const account = accounts[key];

  if (account) {
    localStorage.setItem("voyaraUserName", account.name || name || "Traveller");
    localStorage.setItem("voyaraUserIdentifier", key);
    if (account.email) localStorage.setItem("voyaraUserEmail", account.email);
    if (account.phone) localStorage.setItem("voyaraUserPhone", account.phone);
  }
}

function voyaraClearActiveAccountData() {
  // Keep saved journeys/memories intact; only clear active session fields.
  VOYARA_ACCOUNT_KEYS.forEach((key) => localStorage.removeItem(key));
}

function voyaraHandleAuthSubmit(event) {
  event.preventDefault();

  const mode =
    document.querySelector(".voyara-auth-tab.active")?.dataset.authMode ||
    "signup";

  const name = $("nameInput")?.value.trim() || "";
  const identifier = voyaraNormalizeIdentifier(
    $("contactInput")?.value || ""
  );
  const password = $("passwordInput")?.value || "";

  if (!identifier) {
    voyaraAccountMessage("Enter your email address or phone number.");
    $("contactInput")?.focus();
    return;
  }

  if (password.length < 6) {
    voyaraAccountMessage("Password must be at least 6 characters.");
    $("passwordInput")?.focus();
    return;
  }

  if (mode === "signup" && !name) {
    voyaraAccountMessage("Enter your name to create your account.");
    $("nameInput")?.focus();
    return;
  }

  const accounts = voyaraGetAccounts();
  const account = accounts[identifier];

  if (mode === "signup") {
    if (account) {
      voyaraAccountMessage(
        "An account already exists with this email or phone number. Choose Log in instead."
      );
      return;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const newAccount = {
      name,
      email: isEmail ? identifier : "",
      phone: isEmail ? "" : identifier,
      password,
      createdAt: new Date().toISOString()
    };

    accounts[identifier] = newAccount;
    voyaraSaveAccounts(accounts);

    localStorage.setItem("voyaraUserName", name);
    localStorage.setItem("voyaraUserIdentifier", identifier);
    if (isEmail) {
      localStorage.setItem("voyaraUserEmail", identifier);
    } else {
      localStorage.setItem("voyaraUserPhone", identifier);
    }

    // Switch screens immediately after a successful signup.
    // Keep this transition independent of the optional home-page refresh code.
    hideElement($("welcomeScreen"));
    showElement($("app"));
    setText("profileName", name);
    setText("profileInitial", name.charAt(0).toUpperCase());
    setText("userGreeting", name);
    setText("homeUserName", name);
    showSection("home");
    try { updateHomeStats(); } catch (_) {}
    return;
  }

  if (!account || account.password !== password) {
    voyaraAccountMessage("Incorrect email/phone or password. Please try again.");
    return;
  }

  localStorage.setItem(
    "voyaraUserName",
    account.name || "Traveller"
  );
  localStorage.setItem("voyaraUserIdentifier", identifier);

  if (account.email) {
    localStorage.setItem("voyaraUserEmail", account.email);
  }
  if (account.phone) {
    localStorage.setItem("voyaraUserPhone", account.phone);
  }

  voyaraAccountMessage("");
  showApplication();
}



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
  // Warm the free backend while the user is signing in or exploring,
  // so the first itinerary request is less likely to pay the cold-start delay.
  fetch(`${API_BASE}/api/health`, { cache: "no-store" }).catch(() => {});

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
  voyaraEnsureTripToolkit();

  renderSavedJourneys();
  renderTrips();
  renderScrapbook();
  updateHomeStats();

  const savedName = localStorage.getItem("voyaraUserName");
  const activeIdentifier = localStorage.getItem("voyaraUserIdentifier");

  if (savedName && activeIdentifier) {
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

  if (nameForm && !nameForm.dataset.authBound) {
    nameForm.dataset.authBound = "true";
    nameForm.addEventListener("submit", voyaraHandleAuthSubmit);
  }

  // Handle the account button directly as well, so browser form behavior
  // cannot prevent the prototype auth flow from running.
  const authSubmitButton = $("authSubmitBtn");
  if (authSubmitButton && !authSubmitButton.dataset.authClickBound) {
    authSubmitButton.dataset.authClickBound = "true";
    authSubmitButton.addEventListener("click", (event) => {
      event.preventDefault();
      voyaraHandleAuthSubmit(event);
    });
  }

  const tabs = document.querySelectorAll(".voyara-auth-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });

      const signup = tab.dataset.authMode === "signup";
      const nameField = $("signupNameField");
      const submit = $("authSubmitBtn");
      const password = $("passwordInput");

      if (nameField) {
        nameField.classList.toggle("hidden", !signup);
      }
      if (submit) {
        submit.innerHTML = signup
          ? 'Create my account <span>→</span>'
          : 'Log in <span>→</span>';
      }
      if (password) {
        password.autocomplete = signup ? "new-password" : "current-password";
      }

      const message = $("voyaraAuthMessage");
      if (message) message.classList.add("hidden");
    });
  });

  const googleSignInButton = $("googleSignInBtn");

  if (googleSignInButton && !googleSignInButton.dataset.authBound) {
    googleSignInButton.dataset.authBound = "true";
    googleSignInButton.addEventListener("click", () => {
      const name = prompt("Enter your name to continue with Voyara:");
      if (!name || !name.trim()) return;

      const identifier = "google:" + name.trim().toLowerCase();
      const accounts = voyaraGetAccounts();

      if (!accounts[identifier]) {
        accounts[identifier] = {
          name: name.trim(),
          email: "",
          phone: "",
          password: "",
          provider: "google",
          createdAt: new Date().toISOString()
        };
        voyaraSaveAccounts(accounts);
      }

      localStorage.setItem("voyaraUserName", name.trim());
      localStorage.setItem("voyaraUserIdentifier", identifier);
      showApplication();
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
  const handleNavigation = (event) => {
    const navigationButton = event.target.closest(
      "[data-section], [data-target]"
    );

    if (!navigationButton) return;

    const sectionName =
      navigationButton.dataset.section ||
      navigationButton.dataset.target;

    if (!sectionName) return;

    event.preventDefault();
    event.stopPropagation();
    showSection(sectionName);
  };

  // Bind directly to navigation controls as well as using delegation.
  // This keeps navigation reliable after the auth screen is replaced.
  document.querySelectorAll("[data-section], [data-target]").forEach((button) => {
    if (button.dataset.navigationBound === "true") return;
    button.dataset.navigationBound = "true";
    button.addEventListener("click", handleNavigation);
  });

  document.addEventListener("click", handleNavigation);
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
          const apiError = new Error(
            dataResult.error ||
            "Unable to create the itinerary."
          );
          // A completed API error is not a cold-start/network failure.
          // Avoid repeating an expensive AI request when the server already replied.
          apiError.retryable = false;
          throw apiError;
        }

        result = dataResult;
        break;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (attempt === 1 && error.retryable !== false) {
          if (plannerStatus) {
            plannerStatus.textContent =
              "Waking Voyara's travel engine and trying again...";
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          break;
        }
      }
    }

    if (!result) {
      throw lastError || new Error("Unable to reach the Voyara backend.");
    }

    currentItinerary = result.itinerary || "";
    currentProfile = result.profile || data;

    displayItinerary(currentItinerary);
    voyaraEnsureTripToolkit();
    setTimeout(voyaraLoadWeather,150);

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
      html.push(`<h3 class="voyara-day-heading">${voyaraInlineFormat(title)} <button type="button" class="voyara-regenerate-day-btn" data-regenerate-day="${Number(dayMatch[1])}">↻ Regenerate day</button></h3>`);
      continue;
    }

    const cleaned = cleanHeading(line);
    if (/^day\s*\d+/i.test(cleaned)) {
      const match = cleaned.match(/^day\s*(\d+)\s*(?:[:—-]\s*)?(.*)$/i);
      closeList();
      html.push(`<h3 class="voyara-day-heading">${voyaraInlineFormat(match[2] ? `Day ${match[1]} — ${match[2]}` : `Day ${match[1]}`)} <button type="button" class="voyara-regenerate-day-btn" data-regenerate-day="${Number(match[1])}">↻ Regenerate day</button></h3>`);
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
  const itineraryPreview = $("itineraryPreview");
  if (itineraryPreview && !itineraryPreview.dataset.dayRegenerationBound) {
    itineraryPreview.dataset.dayRegenerationBound = "true";
    itineraryPreview.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-regenerate-day]");
      if (!button) return;
      const dayNumber = Number(button.dataset.regenerateDay);
      if (!Number.isInteger(dayNumber) || dayNumber < 1) return;
      await regenerateSingleDay(dayNumber, button);
    });
  }
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

async function regenerateSingleDay(dayNumber, button) {
  if (!currentItinerary) {
    alert("Create an itinerary first.");
    return;
  }

  const oldLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Regenerating...";

  try {
    const response = await fetch(`${API_BASE}/api/regenerate-day`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itinerary: currentItinerary,
        profile: currentProfile,
        day_number: dayNumber
      })
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.day) {
      throw new Error(result.error || "Unable to regenerate this day.");
    }

    const dayPattern = new RegExp(
      "(^|\\n)(?:#{1,6}\\s*)?Day\\s*" + dayNumber +
      "\\b[^\\n]*[\\s\\S]*?(?=\\n(?:#{1,6}\\s*)?Day\\s*\\d+\\b|\\n#{1,6}\\s*(?:Local Food to Try|Getting Around|Useful Tips|Trip Overview|Quick Summary)\\b|$)",
      "i"
    );
    if (!dayPattern.test(currentItinerary)) {
      throw new Error("Couldn't locate that day in the current itinerary. Your existing plan has been kept unchanged.");
    }

    currentItinerary = currentItinerary.replace(
      dayPattern,
      (matched, prefix) => prefix + "\n" + result.day.trim()
    );
    displayItinerary(currentItinerary);
    voyaraToast(`Day ${dayNumber} regenerated.`);
  } catch (error) {
    console.error("Single-day regeneration error:", error);
    alert(error.message || "Unable to regenerate this day right now.");
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = oldLabel;
    }
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
    const grouped=VOYARA_FOR_YOU_CATEGORIES.map(cat=>({cat,items:results.filter(item=>item.category===cat).slice(0,6)})).filter(group=>group.items.length);
    grid.innerHTML=grouped.map(group=>`<section class="voyara-category-results"><div class="voyara-category-results-heading"><h3>${voyaraEscapeAttr(group.cat)}</h3><span>${group.items.length} recommendations</span></div><div class="voyara-category-results-grid">${group.items.map(cardMarkup).join('')}</div></section>`).join('');
  } else {
    grid.innerHTML=results.slice(0,6).map(cardMarkup).join('');
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
  const selected=Array.isArray(draft.selected)?draft.selected.filter(id=>album.photos.some(p=>String(p.id)===String(id))):album.photos.slice(0,6).map(p=>p.id);
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

const VOYARA_FOR_YOU_SAMPLE_RESULTS = [
  {id:"sample-goa-baga",name:"Baga Beach",destination:"Goa",category:"Nature & Outdoors",description:"Popular North Goa beach for sunsets, water activities and a lively coastal atmosphere.",rating:null},
  {id:"sample-goa-palolem",name:"Palolem Beach",destination:"Goa",category:"Nature & Outdoors",description:"A scenic South Goa beach known for its calm waters, palm-lined shore and relaxed atmosphere.",rating:null},
  {id:"sample-goa-dudhsagar-nature",name:"Dudhsagar Falls",destination:"Goa",category:"Nature & Outdoors",description:"A spectacular waterfall surrounded by lush Western Ghats scenery.",rating:null},
  {id:"sample-goa-candolim",name:"Candolim Beach",destination:"Goa",category:"Nature & Outdoors",description:"A popular North Goa beach with a long sandy shoreline and a relaxed coastal setting.",rating:null},
  {id:"sample-goa-arambol",name:"Arambol Beach",destination:"Goa",category:"Nature & Outdoors",description:"A scenic North Goa beach known for its laid-back atmosphere and coastal walks.",rating:null},
  {id:"sample-goa-butterfly",name:"Butterfly Beach",destination:"Goa",category:"Nature & Outdoors",description:"A quieter South Goa beach surrounded by greenery and rocky coastal scenery.",rating:null},
  {id:"sample-goa-basilica",name:"Basilica of Bom Jesus",destination:"Goa",category:"Attractions & Culture",description:"Historic Old Goa landmark known for its Portuguese-era architecture and heritage.",rating:null},
  {id:"sample-goa-se-cathedral",name:"Se Cathedral",destination:"Goa",category:"Attractions & Culture",description:"One of Old Goa's most prominent historic churches and architectural landmarks.",rating:null},
  {id:"sample-goa-fontainhas",name:"Fontainhas",destination:"Goa",category:"Attractions & Culture",description:"Colourful Latin Quarter with heritage houses, narrow lanes and a distinctive Portuguese influence.",rating:null},
  {id:"sample-goa-aguada",name:"Fort Aguada",destination:"Goa",category:"Attractions & Culture",description:"Historic Portuguese-era fort overlooking the Arabian Sea near Sinquerim.",rating:null},
  {id:"sample-goa-chapora",name:"Chapora Fort",destination:"Goa",category:"Attractions & Culture",description:"Hilltop fort known for sweeping views over the Chapora River and coastline.",rating:null},
  {id:"sample-goa-mangueshi",name:"Shri Mangueshi Temple",destination:"Goa",category:"Attractions & Culture",description:"A prominent Goan temple known for its distinctive architecture and cultural heritage.",rating:null},
  {id:"sample-goa-thalassa",name:"Thalassa",destination:"Goa",category:"Food & Cafés",description:"A well-known Goa dining spot with coastal views and a relaxed evening setting.",rating:null},
  {id:"sample-goa-mil",name:"Vinayak Family Restaurant",destination:"Goa",category:"Food & Cafés",description:"A popular local-style dining option for experiencing Goan flavours.",rating:null},
  {id:"sample-goa-artjuna",name:"Artjuna",destination:"Goa",category:"Food & Cafés",description:"A relaxed café and lifestyle space known for food, ambience and creative culture.",rating:null},
  {id:"sample-goa-gunpowder",name:"Gunpowder",destination:"Goa",category:"Food & Cafés",description:"A popular dining destination known for South Indian-inspired food in a relaxed setting.",rating:null},
  {id:"sample-goa-baba",name:"Baba Au Rum",destination:"Goa",category:"Food & Cafés",description:"A casual café and bakery-style spot known for food, coffee and a relaxed atmosphere.",rating:null},
  {id:"sample-goa-souza",name:"Souza Lobo",destination:"Goa",category:"Food & Cafés",description:"A long-established Calangute beachfront restaurant associated with classic Goan dining.",rating:null},
  {id:"sample-goa-market",name:"Mapusa Market",destination:"Goa",category:"Shopping & Local Markets",description:"Local market experience for produce, spices, handicrafts and everyday Goan goods.",rating:null},
  {id:"sample-goa-panaji-market",name:"Panaji Market",destination:"Goa",category:"Shopping & Local Markets",description:"Central city market for local produce, snacks, souvenirs and everyday shopping.",rating:null},
  {id:"sample-goa-night-market",name:"Anjuna Flea Market",destination:"Goa",category:"Shopping & Local Markets",description:"Colourful market experience with clothing, crafts, jewellery and souvenirs.",rating:null},
  {id:"sample-goa-saturday-market",name:"Saturday Night Market",destination:"Goa",category:"Shopping & Local Markets",description:"Popular weekend market experience with food, clothing, crafts and local shopping.",rating:null},
  {id:"sample-goa-tibetan-market",name:"Tibetan Market Baga",destination:"Goa",category:"Shopping & Local Markets",description:"Compact shopping area around Baga with souvenirs, clothing and small local shops.",rating:null},
  {id:"sample-goa-pondamarket",name:"Ponda Market",destination:"Goa",category:"Shopping & Local Markets",description:"Local market experience for everyday goods, produce and regional shopping.",rating:null},
  {id:"sample-goa-dudhsagar",name:"Dudhsagar Falls Jeep Safari",destination:"Goa",category:"Experiences & Activities",description:"Adventure-focused excursion to one of Goa's most famous natural attractions.",rating:null},
  {id:"sample-goa-water-sports",name:"Calangute Water Sports",destination:"Goa",category:"Experiences & Activities",description:"Beach activities including boating and water-sport experiences along the North Goa coast.",rating:null},
  {id:"sample-goa-spice",name:"Goa Spice Plantation Tour",destination:"Goa",category:"Experiences & Activities",description:"A hands-on cultural experience exploring tropical spices and traditional Goan life.",rating:null},
  {id:"sample-goa-sunset-cruise",name:"Mandovi River Sunset Cruise",destination:"Goa",category:"Experiences & Activities",description:"Evening cruise experience with views of the Mandovi waterfront and Goa skyline.",rating:null},
  {id:"sample-goa-scuba",name:"Grand Island Scuba Diving",destination:"Goa",category:"Experiences & Activities",description:"Popular water-based adventure experience around Goa's coastal islands.",rating:null},
  {id:"sample-goa-kayak",name:"Palolem Kayaking",destination:"Goa",category:"Experiences & Activities",description:"Outdoor water activity option around the scenic Palolem coastline.",rating:null},

  {id:"sample-kerala-munnar",name:"Munnar Tea Gardens",destination:"Kerala",category:"Nature & Outdoors",description:"Misty tea-covered hills and scenic viewpoints around Munnar.",rating:null},
  {id:"sample-kerala-varkala",name:"Varkala Beach",destination:"Kerala",category:"Nature & Outdoors",description:"Dramatic coastal cliffs, sea views and a relaxed beach atmosphere.",rating:null},
  {id:"sample-kerala-athirappilly",name:"Athirappilly Falls",destination:"Kerala",category:"Nature & Outdoors",description:"Majestic waterfall surrounded by lush tropical forest in Kerala.",rating:null},
  {id:"sample-kerala-eravikulam",name:"Eravikulam National Park",destination:"Kerala",category:"Nature & Outdoors",description:"Mountain landscape near Munnar known for rolling grasslands and biodiversity.",rating:null},
  {id:"sample-kerala-kovalam",name:"Kovalam Beach",destination:"Kerala",category:"Nature & Outdoors",description:"Popular coastal destination known for beaches, lighthouse views and seaside walks.",rating:null},
  {id:"sample-kerala-periyar",name:"Periyar Wildlife Sanctuary",destination:"Kerala",category:"Nature & Outdoors",description:"Wildlife and forest destination around the scenic Periyar lake region.",rating:null},
  {id:"sample-kerala-fortkochi",name:"Fort Kochi",destination:"Kerala",category:"Attractions & Culture",description:"Historic waterfront neighbourhood with heritage streets and cultural landmarks.",rating:null},
  {id:"sample-kerala-mattancherry",name:"Mattancherry Palace",destination:"Kerala",category:"Attractions & Culture",description:"Historic palace and museum showcasing Kerala's rich cultural heritage.",rating:null},
  {id:"sample-kerala-chinese-nets",name:"Chinese Fishing Nets",destination:"Kerala",category:"Attractions & Culture",description:"Iconic waterfront landmark and one of Kochi's best-known sights.",rating:null},
  {id:"sample-kerala-folklore",name:"Kerala Folklore Museum",destination:"Kerala",category:"Attractions & Culture",description:"Museum showcasing traditional art, architecture and cultural objects from Kerala.",rating:null},
  {id:"sample-kerala-stfrancis",name:"St. Francis Church",destination:"Kerala",category:"Attractions & Culture",description:"Historic church in Fort Kochi with an important colonial-era heritage setting.",rating:null},
  {id:"sample-kerala-hillpalace",name:"Hill Palace Museum",destination:"Kerala",category:"Attractions & Culture",description:"Large heritage museum complex near Kochi with royal collections and grounds.",rating:null},
  {id:"sample-kerala-cafe",name:"Kashi Art Café",destination:"Kerala",category:"Food & Cafés",description:"Art-filled café experience in the heart of Fort Kochi.",rating:null},
  {id:"sample-kerala-paragon",name:"Paragon Restaurant",destination:"Kerala",category:"Food & Cafés",description:"Popular restaurant known for Kerala-style dishes and Malabar flavours.",rating:null},
  {id:"sample-kerala-fusion",name:"Kerala Café",destination:"Kerala",category:"Food & Cafés",description:"A convenient way to explore familiar Kerala flavours and local specialities.",rating:null},
  {id:"sample-kerala-dheputtu",name:"Dhe Puttu",destination:"Kerala",category:"Food & Cafés",description:"Restaurant known for puttu-based dishes and Kerala-inspired comfort food.",rating:null},
  {id:"sample-kerala-coffeehouse",name:"Indian Coffee House",destination:"Kerala",category:"Food & Cafés",description:"Classic café-style stop for simple South Indian food and coffee.",rating:null},
  {id:"sample-kerala-malabarjunction",name:"Malabar Junction",destination:"Kerala",category:"Food & Cafés",description:"Fort Kochi dining option featuring Kerala and broader Indian flavours.",rating:null},
  {id:"sample-kerala-handloom",name:"Kerala Handicrafts",destination:"Kerala",category:"Shopping & Local Markets",description:"Browse traditional Kerala crafts, textiles and locally made souvenirs.",rating:null},
  {id:"sample-kerala-broadway",name:"Broadway Market Kochi",destination:"Kerala",category:"Shopping & Local Markets",description:"Busy local shopping area for spices, textiles, household goods and souvenirs.",rating:null},
  {id:"sample-kerala-jewtown",name:"Jew Town",destination:"Kerala",category:"Shopping & Local Markets",description:"Historic shopping street around Mattancherry with antiques, crafts and cafés.",rating:null},
  {id:"sample-kerala-lulu",name:"LuLu Mall Kochi",destination:"Kerala",category:"Shopping & Local Markets",description:"Large modern shopping destination in Kochi with retail, dining and entertainment.",rating:null},
  {id:"sample-kerala-chalai",name:"Chalai Market",destination:"Kerala",category:"Shopping & Local Markets",description:"Busy traditional market area in Thiruvananthapuram for local goods and produce.",rating:null},
  {id:"sample-kerala-spice-market",name:"Mattancherry Spice Market",destination:"Kerala",category:"Shopping & Local Markets",description:"Historic area around Mattancherry associated with spices, antiques and local shopping.",rating:null},
  {id:"sample-kerala-backwaters",name:"Alleppey Backwaters",destination:"Kerala",category:"Experiences & Activities",description:"Relaxing backwater experience with houseboats and scenic waterways.",rating:null},
  {id:"sample-kerala-kathakali",name:"Kathakali Cultural Show",destination:"Kerala",category:"Experiences & Activities",description:"Traditional performance experience featuring Kerala's distinctive dance-drama art form.",rating:null},
  {id:"sample-kerala-houseboat",name:"Alappuzha Houseboat Cruise",destination:"Kerala",category:"Experiences & Activities",description:"A classic Kerala travel experience through peaceful backwaters and village scenery.",rating:null},
  {id:"sample-kerala-kathakali-centre",name:"Kerala Kathakali Centre",destination:"Kerala",category:"Experiences & Activities",description:"Cultural venue in Kochi for experiencing Kerala's traditional Kathakali performance art.",rating:null},
  {id:"sample-kerala-periyar-boating",name:"Periyar Lake Boating",destination:"Kerala",category:"Experiences & Activities",description:"Scenic boating experience through the forested Periyar lake region.",rating:null},
  {id:"sample-kerala-kumbalangi",name:"Kumbalangi Village",destination:"Kerala",category:"Experiences & Activities",description:"Village experience highlighting Kerala's backwaters, fishing culture and rural landscapes.",rating:null}
];

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
  const rating=item.rating!==null&&item.rating!==undefined
    ? `<div class="voyara-place-rating" aria-label="Google rating ${Number(item.rating).toFixed(1)} out of 5">★ ${Number(item.rating).toFixed(1)}${item.ratingCount?` <small>(${Number(item.ratingCount).toLocaleString()} ratings)</small>`:""}<small>Google rating</small></div>`
    : `<div class="voyara-place-rating unavailable">Rating unavailable from this source</div>`;
  const overview=String(item.description||"").trim() ||
    `Explore this ${String(item.type||item.category||"place").toLowerCase()} in ${item.destination||"your destination"}. Open the map listing for current visitor photos, directions and opening details.`;
  const reviews=Array.isArray(item.reviews)?item.reviews.filter(r=>r&&String(r.text||"").trim()).slice(0,2):[];
  const reviewMarkup=reviews.length
    ? `<div class="voyara-place-review"><div class="voyara-place-review-title">Visitor review${reviews.length>1?"s":""} <span>from Google Maps</span></div>${reviews.map(review=>`<blockquote><p>“${escapeHtml(review.text)}”</p><footer>${review.rating!==null&&review.rating!==undefined?`★ ${Number(review.rating).toFixed(1)} · `:""}${escapeHtml(review.author||"Google Maps user")}${review.relativeTime?` · ${escapeHtml(review.relativeTime)}`:""}</footer></blockquote>`).join("")}</div>`
    : "";
  return `<article class="voyara-place-card"><div class="voyara-place-card-body"><span class="voyara-place-type">${escapeHtml(item.type||item.category)}</span><h4>${escapeHtml(item.name)}</h4>${rating}<div class="voyara-place-overview"><strong>About this place</strong><p>${escapeHtml(overview)}</p></div>${reviewMarkup}<p class="voyara-place-address">${escapeHtml(item.address||item.destination||"")}</p><div class="voyara-place-actions"><a href="${escapeHtml(item.mapUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name+', '+item.destination)}`)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a><button type="button" data-save-final-place="${escapeHtml(item.id)}">${isSaved?'✓ Saved':'♡ Wishlist'}</button><button type="button" data-add-final-place="${escapeHtml(item.id)}">Add to itinerary</button></div></div></article>`;
}

function voyaraPriceLevelNumber(value) {
  const key = String(value || "").toUpperCase();
  if (key === "PRICE_LEVEL_FREE") return 0;
  if (key === "PRICE_LEVEL_INEXPENSIVE") return 1;
  if (key === "PRICE_LEVEL_MODERATE") return 2;
  if (key === "PRICE_LEVEL_EXPENSIVE") return 3;
  if (key === "PRICE_LEVEL_VERY_EXPENSIVE") return 4;
  return null;
}

function voyaraApplyForYouFilters(items) {
  const minRating = Number($("forYouMinRating")?.value || 0);
  const maxPrice = $("forYouBudgetFilter")?.value || "";
  const openNowOnly = Boolean($("forYouOpenNow")?.checked);
  return items.filter(item => {
    if (minRating > 0 && (item.rating === null || item.rating === undefined || Number(item.rating) < minRating)) return false;
    if (maxPrice !== "") {
      const price = voyaraPriceLevelNumber(item.priceLevel);
      if (price === null || price > Number(maxPrice)) return false;
    }
    if (openNowOnly && item.openNow !== true) return false;
    return true;
  });
}

function renderForYouResults() {
  const grid=$("recommendationGrid"); if(!grid)return;
  const category=$("forYouCategory")?.value||"all";
  if(!voyaraForYouResults.length){grid.innerHTML=`<div class="for-you-empty"><strong>Search a destination to discover places.</strong><span>Choose one of the five categories or view all five categories together.</span></div>`;return;}
  const filteredResults=voyaraApplyForYouFilters(voyaraForYouResults);
  const groups=category==="all" ? VOYARA_FOR_YOU_CATEGORIES.map(cat=>({cat,items:filteredResults.filter(x=>x.category===cat).slice(0,6)})).filter(g=>g.items.length) : [{cat:category,items:filteredResults.filter(x=>x.category===cat).slice(0,6)}];
  if(!groups.some(g=>g.items.length)){grid.innerHTML=`<div class="for-you-empty"><strong>No places match these filters.</strong><span>Try lowering the minimum rating, increasing the budget level, or turning off “Open now”. Filters only use live fields supplied by the place source.</span></div>`;return;}
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
    voyaraForYouResults=VOYARA_FOR_YOU_SAMPLE_RESULTS.slice();
    if(note)note.textContent="Demo recommendations for Goa and Kerala are available below.";
    renderForYouResults();
    return;
  }
  grid.innerHTML=`<div class="for-you-loading"><strong>Finding places in ${escapeHtml(destination)}...</strong><span>Searching the selected category and preparing recommendations.</span></div>`;
  if(note)note.textContent="";
  const categories=[category];
  try {
    const results=[];
    const sources=new Set();

    for(const cat of categories){
      try {
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),10000);
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

    if(!results.length && /^(goa|kerala)$/i.test(destination)){
      voyaraForYouResults=VOYARA_FOR_YOU_SAMPLE_RESULTS.filter(x=>x.destination.toLowerCase()===destination.toLowerCase());
      if(note)note.textContent="Showing Voyara demo recommendations for this destination.";
    }else{
      voyaraForYouResults=results;
    }
    if(note && results.length) note.textContent=sources.has("Google Places")?"Recommendations are from Google Places. Ratings are shown only when Google supplies them.":"Recommendations are from OpenStreetMap. Ratings are shown only when a real rating is supplied by the source.";
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
  ["forYouMinRating","forYouBudgetFilter","forYouOpenNow"].forEach(id=>$(id)?.addEventListener("change",renderForYouResults));
  renderForYouResults();
}

/* ============================================================
   TRIP TOOLKIT
   Budget tracker + weather + packing checklist + share.
============================================================ */

const VOYARA_TOOLKIT_STYLE_ID = "voyaraToolkitStyles";
const VOYARA_EXPENSES_KEY = "voyaraToolkitExpenses";


function voyaraEnsureTripToolkitStyles() {
  if ($(VOYARA_TOOLKIT_STYLE_ID)) return;
  const style=document.createElement("style");
  style.id=VOYARA_TOOLKIT_STYLE_ID;
  style.textContent=`
    .voyara-trip-toolkit{margin-top:28px;border:1px solid rgba(90,70,45,.14);border-radius:24px;background:#fffdf9;box-shadow:0 14px 35px rgba(60,45,30,.07);overflow:hidden}
    .voyara-toolkit-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid rgba(90,70,45,.1)}
    .voyara-toolkit-head h3{margin:3px 0 0;font-family:"Playfair Display",serif;font-size:24px}
    .voyara-toolkit-head p{margin:4px 0 0;opacity:.7}
    .voyara-toolkit-actions{display:flex;gap:8px;flex-wrap:wrap}
    .voyara-toolkit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:18px}
    .voyara-tool-card{border:1px solid rgba(90,70,45,.12);border-radius:18px;background:#fff;padding:18px}
    .voyara-tool-card.wide{grid-column:span 2}
    .voyara-tool-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .voyara-tool-card-head h4{margin:0;font-size:17px}
    .voyara-tool-toggle{border:0;background:transparent;cursor:pointer;font-size:18px}
    .voyara-tool-body{margin-top:16px}
    .voyara-budget-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .voyara-budget-stat{padding:12px;border-radius:14px;background:#f7f3ed}
    .voyara-budget-stat span{display:block;font-size:12px;opacity:.65}.voyara-budget-stat strong{display:block;margin-top:4px;font-size:18px}
    .voyara-budget-bar{height:9px;background:#eee7dd;border-radius:99px;overflow:hidden;margin:14px 0}
    .voyara-budget-fill{height:100%;width:0;background:currentColor;border-radius:99px;transition:width .25s}
    .voyara-tool-row{display:flex;gap:8px;margin-top:12px}.voyara-tool-row input{flex:1}
    .voyara-weather-main{display:flex;align-items:center;gap:14px}.voyara-weather-temp{font-size:34px;font-weight:800}.voyara-weather-icon{font-size:34px}
    .voyara-weather-meta{opacity:.7}.voyara-weather-loading{opacity:.65}
    .voyara-pack-add{display:flex;gap:8px;margin-bottom:12px}.voyara-pack-add input{flex:1}.voyara-pack-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .voyara-pack-item{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:12px;background:#f7f3ed}
    .voyara-pack-item input{width:auto}.voyara-pack-item.done span{text-decoration:line-through;opacity:.55}
    .voyara-share-box{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    @media(max-width:800px){.voyara-toolkit-grid{grid-template-columns:1fr}.voyara-tool-card.wide{grid-column:span 1}.voyara-pack-list{grid-template-columns:1fr}.voyara-budget-stats{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function voyaraToolkitDestination(){
  return String(
    lastTripRequest?.destination ||
    currentProfile?.destination ||
    $("destination")?.value ||
    ""
  ).trim();
}

function voyaraMoney(value){
  const n=Number(value)||0;
  return "₹"+n.toLocaleString("en-IN",{maximumFractionDigits:0});
}

function voyaraGetExpenses(){
  try {
    const value=JSON.parse(localStorage.getItem(VOYARA_EXPENSES_KEY)||"[]");
    return Array.isArray(value)?value:[];
  } catch (_) { return []; }
}

function voyaraTripDayCount(){
  const match=String(currentProfile?.days||$("days")?.value||"1").match(/\d+/);
  return Math.max(1,Math.min(31,Number(match?.[0]||1)));
}

function voyaraRenderBudget(){
  const budgetInput=$("voyaraBudgetInput"), spent=$("voyaraSpentInput");
  const budget=Number(budgetInput?.value)||0, otherAmount=Number(spent?.value)||0;
  const expenses=voyaraGetExpenses();
  const expenseTotal=expenses.reduce((sum,item)=>sum+Math.max(0,Number(item.amount)||0),0);
  const amount=otherAmount+expenseTotal;
  const percent=budget>0?Math.min(100,(amount/budget)*100):0;
  if($("voyaraBudgetValue"))$("voyaraBudgetValue").textContent=voyaraMoney(budget);
  if($("voyaraSpentValue"))$("voyaraSpentValue").textContent=voyaraMoney(amount);
  if($("voyaraRemainingValue"))$("voyaraRemainingValue").textContent=voyaraMoney(budget-amount);
  if($("voyaraBudgetFill"))$("voyaraBudgetFill").style.width=percent+"%";
  localStorage.setItem("voyaraToolkitBudget",JSON.stringify({budget,amount:otherAmount}));

  const days=voyaraTripDayCount(), dailyBudget=budget/days;
  const byDay=Array.from({length:days},(_,index)=>({day:index+1,total:0}));
  expenses.forEach(item=>{const day=Number(item.day);if(day>=1&&day<=days)byDay[day-1].total+=Number(item.amount)||0;});
  const summary=$("voyaraDailyBudgetSummary");
  if(summary){
    summary.innerHTML=`<strong>Average daily budget: ${voyaraMoney(dailyBudget)}</strong><div class="voyara-daily-budget-grid">${byDay.map(day=>`<div><span>Day ${day.day}</span><strong>${voyaraMoney(day.total)}</strong><small>${dailyBudget>0?voyaraMoney(dailyBudget-day.total)+" vs. daily budget":"Set a budget to compare"}</small></div>`).join("")}</div>`;
  }
  const list=$("voyaraExpenseList");
  if(list){
    list.innerHTML=expenses.length?expenses.map(item=>`<div class="voyara-expense-item"><div><strong>${escapeHtml(item.description||item.category||"Expense")}</strong><small>${escapeHtml(item.category||"Other")} · Day ${Number(item.day)||1}</small></div><strong>${voyaraMoney(item.amount)}</strong><button type="button" data-delete-expense="${escapeHtml(item.id)}" aria-label="Delete expense">×</button></div>`).join(""):'<p class="voyara-muted">Your itemized expenses will appear here.</p>';
    list.querySelectorAll("[data-delete-expense]").forEach(button=>button.addEventListener("click",()=>{
      const next=voyaraGetExpenses().filter(item=>String(item.id)!==String(button.dataset.deleteExpense));
      localStorage.setItem(VOYARA_EXPENSES_KEY,JSON.stringify(next));
      voyaraRenderBudget();
    }));
  }
}

function voyaraAddExpense(){
  const description=$("voyaraExpenseDescription"), amount=$("voyaraExpenseAmount"), day=$("voyaraExpenseDay");
  const value=Number(amount?.value), dayNumber=Number(day?.value)||1;
  if(!description?.value.trim()){voyaraToast("Enter an expense description.");description?.focus();return;}
  if(!Number.isFinite(value)||value<=0){voyaraToast("Enter an expense amount greater than zero.");amount?.focus();return;}
  if(dayNumber<1||dayNumber>31){voyaraToast("Choose a trip day between 1 and 31.");day?.focus();return;}
  const expenses=voyaraGetExpenses();
  expenses.push({id:`expense-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,description:description.value.trim(),category:$("voyaraExpenseCategory")?.value||"Other",amount:Math.round(value),day:dayNumber,createdAt:new Date().toISOString()});
  localStorage.setItem(VOYARA_EXPENSES_KEY,JSON.stringify(expenses));
  description.value="";amount.value="";
  voyaraRenderBudget();
}

async function voyaraLoadWeather(){
  const destination=voyaraToolkitDestination(), box=$("voyaraWeatherBody");
  if(!box)return;
  if(!destination){box.innerHTML=`<div class="voyara-weather-loading">Create a trip or enter a destination to see weather.</div>`;return;}
  box.innerHTML=`<div class="voyara-weather-loading">Checking weather for ${escapeHtml(destination)}...</div>`;
  try{
    const geo=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(destination)}`,{headers:{"Accept-Language":"en"}});
    const places=geo.ok?await geo.json():[];
    if(!places.length)throw new Error("Destination not found");
    const lat=Number(places[0].lat),lon=Number(places[0].lon);
    const weather=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
    const data=weather.ok?await weather.json():null;
    if(!data?.current)throw new Error("Weather unavailable");
    const code=Number(data.current.weather_code);
    const label=code===0?"Clear":code<=3?"Partly cloudy":code<=48?"Cloudy":code<=67?"Rain":code<=77?"Snow":code<=82?"Showers":"Stormy";
    const icon=code===0?"☀️":code<=3?"⛅":code<=48?"☁️":code<=67?"🌧️":code<=77?"❄️":code<=82?"🌦️":"⛈️";
    box.innerHTML=`<div class="voyara-weather-main"><span class="voyara-weather-icon">${icon}</span><div><div class="voyara-weather-temp">${Math.round(data.current.temperature_2m)}°C</div><div>${label}</div></div></div><p class="voyara-weather-meta">Feels like ${Math.round(data.current.apparent_temperature)}°C · Wind ${Math.round(data.current.wind_speed_10m)} km/h</p><small class="voyara-weather-meta">Live weather for ${escapeHtml(destination)}</small>`;
  }catch(_){
    box.innerHTML=`<div class="voyara-weather-loading">Weather is temporarily unavailable. Try again in a moment.</div>`;
  }
}

function voyaraPackingItems(){
  try{return JSON.parse(localStorage.getItem(VOYARA_PACKING_KEY)||"[]")||[];}catch(_){return[];}
}

function voyaraAddPackingItem(){
  const input=$("voyaraPackingInput");
  if(!input)return;
  const text=input.value.trim();
  if(!text)return;
  const items=voyaraPackingItems();
  items.push({text,done:false});
  localStorage.setItem(VOYARA_PACKING_KEY,JSON.stringify(items));
  input.value="";
  voyaraRenderPacking();
  input.focus();
}

function voyaraRenderPacking(){
  const list=$("voyaraPackingList"); if(!list)return;
  const items=voyaraPackingItems();
  list.innerHTML=items.map((item,i)=>`<label class="voyara-pack-item ${item.done?"done":""}"><input type="checkbox" data-pack-index="${i}" ${item.done?"checked":""}><span>${escapeHtml(item.text)}</span></label>`).join("");
  list.querySelectorAll("[data-pack-index]").forEach(cb=>cb.addEventListener("change",()=>{
    const next=voyaraPackingItems(); next[Number(cb.dataset.packIndex)].done=cb.checked;
    localStorage.setItem(VOYARA_PACKING_KEY,JSON.stringify(next)); voyaraRenderPacking();
  }));
}

function voyaraShareTrip(){
  const destination=voyaraToolkitDestination()||"my trip";
  const text=`I'm planning a trip to ${destination} with Voyara ✈️`;
  if(navigator.share){navigator.share({title:"My Voyara trip",text,url:location.href}).catch(()=>{});return;}
  navigator.clipboard?.writeText(text+" "+location.href).then(()=>voyaraToast("Trip share link copied.")).catch(()=>alert(text));
}

function voyaraEnsureTripToolkit(){
  voyaraEnsureTripToolkitStyles();
  const planner=$("section-planner"), toolkitSection=$("section-toolkit"), itinerary=$("itineraryContainer");
  if((!planner&&!toolkitSection)||$("voyaraTripToolkit"))return;
  const mount=document.createElement("div");
  mount.id="voyaraTripToolkit";
  mount.className="voyara-trip-toolkit";
  mount.innerHTML=`
    <div class="voyara-toolkit-head">
      <div><span class="eyebrow">TRAVEL TOOLS</span><h3>Trip Toolkit</h3><p>Keep the practical parts of your journey in one place.</p></div>
      <div class="voyara-toolkit-actions"><button type="button" class="secondary-button" id="voyaraRefreshWeather">↻ Weather</button><button type="button" class="primary-button" id="voyaraShareTripBtn">↗ Share trip</button></div>
    </div>
    <div class="voyara-toolkit-grid">
      <section class="voyara-tool-card"><div class="voyara-tool-card-head"><h4>💰 Budget Tracker</h4><button class="voyara-tool-toggle" type="button" data-tool-toggle="budget">−</button></div><div class="voyara-tool-body" data-tool-body="budget"><div class="voyara-budget-stats"><div class="voyara-budget-stat"><span>Budget</span><strong id="voyaraBudgetValue">₹0</strong></div><div class="voyara-budget-stat"><span>Spent</span><strong id="voyaraSpentValue">₹0</strong></div><div class="voyara-budget-stat"><span>Remaining</span><strong id="voyaraRemainingValue">₹0</strong></div></div><div class="voyara-budget-bar"><div class="voyara-budget-fill" id="voyaraBudgetFill"></div></div><div class="voyara-tool-row"><input id="voyaraBudgetInput" type="number" min="0" placeholder="Total budget" aria-label="Total trip budget"><input id="voyaraSpentInput" type="number" min="0" placeholder="Other spending (optional)" aria-label="Other spending not itemized below"></div><div class="voyara-expense-form"><input id="voyaraExpenseDescription" type="text" maxlength="80" placeholder="Expense (e.g. lunch)" aria-label="Expense description"><select id="voyaraExpenseCategory" aria-label="Expense category"><option>Food</option><option>Transport</option><option>Stay</option><option>Activities</option><option>Shopping</option><option>Other</option></select><input id="voyaraExpenseAmount" type="number" min="1" step="1" placeholder="₹ amount" aria-label="Expense amount"><input id="voyaraExpenseDay" type="number" min="1" value="1" placeholder="Day #" aria-label="Trip day number"><button type="button" class="primary-button" id="voyaraAddExpenseBtn">Add expense</button></div><div id="voyaraDailyBudgetSummary" class="voyara-expense-summary"></div><div id="voyaraExpenseList" class="voyara-expense-list"></div></div></section>
      <section class="voyara-tool-card"><div class="voyara-tool-card-head"><h4>🌦️ Weather</h4><button class="voyara-tool-toggle" type="button" data-tool-toggle="weather">−</button></div><div class="voyara-tool-body" data-tool-body="weather" id="voyaraWeatherBody"><div class="voyara-weather-loading">Create a trip to check weather.</div></div></section>
      <section class="voyara-tool-card wide"><div class="voyara-tool-card-head"><h4>🎒 Packing Checklist</h4><button class="voyara-tool-toggle" type="button" data-tool-toggle="packing">−</button></div><div class="voyara-tool-body" data-tool-body="packing"><div class="voyara-pack-add"><input id="voyaraPackingInput" type="text" placeholder="Add your own checklist item..." aria-label="New packing checklist item"><button type="button" class="primary-button" id="voyaraAddPackingBtn">Add</button></div><div class="voyara-pack-list" id="voyaraPackingList"></div></div></section>
      <section class="voyara-tool-card wide"><div class="voyara-tool-card-head"><h4>↗ Share Trip</h4><button class="voyara-tool-toggle" type="button" data-tool-toggle="share">−</button></div><div class="voyara-tool-body" data-tool-body="share"><div class="voyara-share-box"><span>Share your Voyara trip with friends or teammates.</span><button type="button" class="primary-button" id="voyaraShareTripBtn2">Share trip ↗</button></div></div></section>
    </div>`;
  if(toolkitSection) toolkitSection.appendChild(mount);
  else if(itinerary) itinerary.insertAdjacentElement("afterend",mount);
  else if(planner) planner.appendChild(mount);

  const saved=JSON.parse(localStorage.getItem("voyaraToolkitBudget")||"{}");
  if($("voyaraBudgetInput"))$("voyaraBudgetInput").value=saved.budget||"";
  if($("voyaraSpentInput"))$("voyaraSpentInput").value=saved.amount||"";
  $("voyaraBudgetInput")?.addEventListener("input",voyaraRenderBudget);
  $("voyaraSpentInput")?.addEventListener("input",voyaraRenderBudget);
  $("voyaraAddExpenseBtn")?.addEventListener("click",voyaraAddExpense);
  $("voyaraExpenseDescription")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();voyaraAddExpense();}});
  $("voyaraExpenseAmount")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();voyaraAddExpense();}});
  $("voyaraRefreshWeather")?.addEventListener("click",voyaraLoadWeather);
  $("voyaraAddPackingBtn")?.addEventListener("click",voyaraAddPackingItem);
  $("voyaraPackingInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();voyaraAddPackingItem();}});
  $("voyaraShareTripBtn")?.addEventListener("click",voyaraShareTrip);
  $("voyaraShareTripBtn2")?.addEventListener("click",voyaraShareTrip);
  mount.querySelectorAll("[data-tool-toggle]").forEach(btn=>btn.addEventListener("click",()=>{
    const key=btn.dataset.toolToggle, body=mount.querySelector(`[data-tool-body="${key}"]`);
    if(!body)return; const hidden=body.classList.toggle("hidden"); btn.textContent=hidden?"+":"−";
  }));
  voyaraRenderBudget(); voyaraRenderPacking();
  setTimeout(voyaraLoadWeather,300);
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
    voyaraEnsureTripToolkit();
    if($("destinationModal")) $("destinationModal").addEventListener("click",e=>{if(e.target.id==="destinationModal")hideElement($("destinationModal"));});
    // Use the final fixed Explore/For You data and controls.
    renderExploreDestinationsFinal($("exploreSearch")?.value||"");
    renderForYouResults();
  },120);
});