# ✈️ Voyara

### AI-Powered Travel Planning Assistant

**Voyara** is an AI-powered travel planning assistant that turns your destination, budget, duration, travel preferences, and starting location into a practical, personalised trip plan.

It combines **Google Gemini**, a **Flask backend**, interactive maps, destination discovery, and a responsive web interface into one travel-planning experience.

---

## 🌍 Live Demo

🚀 **[Try Voyara Live](https://voyara-frontend.onrender.com)**

📂 **[View Source Code](https://github.com/upasana-s7/Voyara)**

---

## ✨ Features

### 🤖 AI Trip Planning
- Generate personalised day-by-day itineraries.
- Plan trips using destination, duration, budget, traveller count, starting location, travel month, and preferences.
- Create practical time-block plans for shorter trips.
- Get concise, travel-focused recommendations.

### 🔄 Modify & Regenerate
- Modify an existing itinerary using natural-language instructions.
- Regenerate an alternative itinerary while keeping the original trip requirements.
- Refine your trip without starting from scratch.

### 🗺️ Explore Destinations
- Search destinations using OpenStreetMap/Nominatim.
- Explore locations on an interactive **Leaflet** map.
- Open destination details with AI-generated travel guidance.
- Start planning directly from an explored destination.

### 📍 For You Recommendations
Discover places based on your interests and selected category:

- 🍴 Food & Cafés
- 🏛️ Attractions & Culture
- 🌿 Nature & Outdoors
- 🎯 Experiences & Activities
- 🛍️ Shopping & Local Markets

Voyara supports Google Places when configured and uses an OpenStreetMap-based fallback for place discovery.

### 💬 Voyara Assistant
An integrated AI travel assistant that can help with:
- Trip planning
- Budgeting
- Packing
- Destination questions
- Travel guidance
- App guidance
- Travel safety

The assistant also keeps recent conversation context during a session.

### 💾 Save & Manage Trips
- Save selected travel data locally in the browser.
- Keep generated trip information available for later use.
- Print itineraries in a PDF-friendly format.

### 📱 Progressive Web App
- PWA support with a service worker.
- Responsive interface for different screen sizes.
- Browser Local Storage for selected travel data.

---

## 🧠 AI & Backend

Voyara uses the **Google Gemini API** through the \`google-genai\` Python SDK.

The Flask backend provides APIs for:

- ✈️ Trip planning
- 🔄 Itinerary modification
- ♻️ Itinerary regeneration
- 📍 Destination guides
- 💬 AI assistant chat
- 🗺️ Place discovery
- ❤️ Health/status checks

The backend also includes retry and fallback handling for temporary Gemini API failures.

---

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript
- Leaflet.js
- Progressive Web App APIs
- Browser Local Storage

### Backend
- Python
- Flask
- Flask-CORS
- Google GenAI SDK
- python-dotenv

### APIs & Services
- Google Gemini
- Google Places API *(when configured)*
- OpenStreetMap / Nominatim
- Leaflet

### Deployment
- **Render** — frontend & backend hosting

---

## 🏗️ How It Works

~~~text
User Preferences
      ↓
Voyara Frontend
      ↓
Flask Backend
      ↓
Google Gemini + Location Services
      ↓
Personalised Travel Results
      ↓
Interactive Itinerary & Destination Experience
~~~

---

## 📁 Project Structure

~~~text
Voyara/
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── service-worker.js
├── main.py
├── requirements.txt
├── .gitignore
└── README.md
~~~

---

## ⚙️ Run Locally

### 1. Clone the repository

~~~bash
git clone https://github.com/upasana-s7/Voyara.git
cd Voyara
~~~

### 2. Create a virtual environment

**Windows PowerShell:**

~~~powershell
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
~~~

### 3. Install dependencies

~~~bash
pip install -r requirements.txt
~~~

### 4. Configure environment variables

Create a \`.env\` file in the project root:

~~~env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
~~~

> **Never commit real API keys to GitHub.**

### 5. Start the backend

~~~bash
python main.py
~~~

The Flask backend runs locally on:

~~~text
http://127.0.0.1:5000
~~~

### 6. Open the frontend

Open:

~~~text
frontend/index.html
~~~

For complete AI functionality during local development, keep the Flask backend running.

---

## 🔐 Environment Variables

| Variable | Purpose |
|---|---|
| \`GEMINI_API_KEY\` | Required for Gemini-powered itinerary generation, modification, regeneration, destination guidance, and assistant chat |
| \`GOOGLE_MAPS_API_KEY\` | Optional; enables Google Places-based recommendations when configured |

Voyara uses an OpenStreetMap-based fallback for destination and place discovery where applicable.

---

## 🚀 Deployment

Voyara is deployed as two connected services on **Render**:

**Frontend**

\`https://voyara-frontend.onrender.com\`

**Backend**

\`https://voyara-backend-cwik.onrender.com\`

The frontend communicates with the deployed Flask backend through the configured API base URL.

API keys remain server-side and are not exposed in the frontend.

---

## 🎯 Project Highlights

Voyara brings multiple travel-planning tasks together in one application:

**Personalised Planning**  
Generate itineraries around real trip constraints and preferences.

**AI-Powered Refinement**  
Modify and regenerate plans using natural language.

**Destination Discovery**  
Explore destinations, places, and attractions through an interactive map.

**Smart Recommendations**  
Discover food, attractions, nature, experiences, and shopping based on category.

**AI Travel Assistance**  
Ask questions and get travel-focused guidance inside the application.

**Offline-Friendly Data**  
Use browser storage to retain selected travel information.

---

## 💡 Why Voyara?

Planning a trip often means switching between multiple tools for:

- Finding destinations
- Researching places
- Building an itinerary
- Checking activities
- Adjusting plans
- Getting travel advice

**Voyara brings these steps together into a single AI-powered travel experience.**

---

## 👩‍💻 Author

### Upasana S

🔗 **GitHub:** https://github.com/upasana-s7

---

## 📌 Project Status

**Completed personal AI travel-planning project.**

Voyara is available as an open-source project on GitHub with a live deployed demo.
