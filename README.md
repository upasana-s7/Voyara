Voyara 🌍

Voyara is an AI-powered travel planning assistant that helps travellers turn trip preferences into practical, personalised itineraries.

It combines Google Gemini, a Flask backend, and a responsive web interface to help users plan trips, explore destinations, discover places, and refine itineraries.

✨ Features

🤖 AI Trip Planning

Generate personalised itineraries from destination, duration, budget, traveller count, starting location, travel month, and preferences.

Supports day-by-day and shorter time-block plans.

Produces concise, practical recommendations.

🔄 Modify & Regenerate

Modify an existing itinerary using a natural-language request.

Generate an alternative itinerary while keeping the original trip requirements.

🗺️ Explore Destinations

Search destinations using OpenStreetMap/Nominatim.

View destinations on an interactive Leaflet map.

Open destination details and get AI-generated travel guidance.

Start planning directly from a destination.

📍 For You Recommendations

Discover places by category:

Food & Cafés

Attractions & Culture

Nature & Outdoors

Experiences & Activities

Shopping & Local Markets

Google Places is used when configured, with an OpenStreetMap-based fallback.

💬 Voyara Assistant

Built-in AI travel assistant for planning, budgeting, packing, destinations, app guidance, and travel safety.

Keeps recent conversation context during a session.

📱 PWA & Local Storage

Progressive Web App support with a service worker.

Saves selected travel data locally in the browser.

Includes itinerary printing/PDF-friendly output.

🧠 AI & Backend

Voyara uses the Google Gemini API through the google-genai Python SDK.

The Flask backend provides API endpoints for:

Trip planning

Itinerary modification

Itinerary regeneration

Destination guides

AI assistant chat

Place discovery

Health/status checks

The backend also includes retry/fallback handling for temporary Gemini API failures.

🛠️ Tech Stack

Frontend

HTML5

CSS3

JavaScript

Leaflet.js

Progressive Web App APIs

Browser Local Storage

Backend

Python

Flask

Flask-CORS

Google GenAI SDK

python-dotenv

APIs / Services

Google Gemini

Google Places API (when configured)

OpenStreetMap / Nominatim

Leaflet

📁 Project Structure

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

⚙️ Run Locally

1. Clone the repository

git clone https://github.com/upasana-s7/Voyara.git
cd Voyara

2. Create a virtual environment

Windows PowerShell:

python -m venv .venv
.\.venv\Scripts\Activate.ps1

3. Install dependencies

pip install -r requirements.txt

4. Configure environment variables

Create a .env file in the project root:

GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

Never commit real API keys to GitHub.

5. Start the backend

python main.py

The Flask backend runs on http://127.0.0.1:5000.

6. Open the frontend

Open frontend/index.html in a browser.

For complete AI functionality, keep the Flask backend running while using the frontend.

🔐 Environment Variables

Variable

Purpose

GEMINI_API_KEY

Required for Gemini-powered itinerary generation, modification, regeneration, destination guidance, and assistant chat

GOOGLE_MAPS_API_KEY

Optional; enables Google Places-based recommendations when configured

The application also has an OpenStreetMap-based fallback for destination and place discovery where applicable.

⚠️ Deployment Note

The current frontend communicates with the Flask backend at http://127.0.0.1:5000, which is intended for local development.

For public deployment, host the Flask backend on a server and change the frontend API base URL to the deployed backend URL. API keys should remain server-side and should never be exposed in frontend code.

🎯 Project Highlights

Voyara combines:

Personalised itinerary generation

Natural-language itinerary editing

Destination discovery

Interactive maps

Place recommendations

AI travel assistance

Local browser storage

PWA functionality

The goal is to provide a single travel-planning experience instead of requiring users to switch between multiple tools for itinerary creation, destination research, and trip refinement.

👩‍💻 Author

Upasana S

GitHub: https://github.com/upasana-s7

📌 Project Status

Voyara is a completed personal AI travel-planning project and is available as a source-code project on GitHub.