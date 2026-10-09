import os
import json
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

# Load the .env file beside main.py
load_dotenv(dotenv_path=ENV_FILE, override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()

MODEL_NAME = "gemini-3.5-flash-lite"
FALLBACK_MODELS = ["gemini-3.6-flash"]


# ============================================================
# FLASK SETUP
# ============================================================

app = Flask(__name__)
CORS(app)


# ============================================================
# GEMINI SETUP
# ============================================================

gemini_client = None

if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY was not found in .env")

else:
    print("Gemini API key loaded.")
    print("Model:", MODEL_NAME)

    try:
        gemini_client = genai.Client(
            api_key=GEMINI_API_KEY
        )

        print("Gemini client created successfully.")

    except Exception as error:
        print("Could not create Gemini client:")
        print(error)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def generate_with_gemini(prompt):
    """Generate text with Gemini, retrying transient errors and using a fallback model."""
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY is missing. Check your .env file.")

    if gemini_client is None:
        raise Exception(
            "Gemini client is not available. "
            "Check the API key and google-genai installation."
        )

    models = [MODEL_NAME] + [
        m for m in FALLBACK_MODELS
        if m != MODEL_NAME
    ]

    last_error = None

    for model_name in models:
        for attempt in range(1, 2):
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        max_output_tokens=1800,
                    ),
                )

                if not response.text:
                    raise Exception("Gemini returned an empty response.")

                if model_name != MODEL_NAME:
                    print(
                        f"Gemini fallback model used: {model_name}"
                    )

                return response.text.strip()

            except Exception as error:
                last_error = error
                error_text = str(error).upper()

                temporary_error = any(
                    marker in error_text
                    for marker in (
                        "429",
                        "RESOURCE_EXHAUSTED",
                        "503",
                        "UNAVAILABLE",
                        "500",
                        "INTERNAL",
                        "502",
                        "504",
                        "DEADLINE_EXCEEDED",
                    )
                )

                print(
                    f"Gemini request failed using {model_name} "
                    f"(attempt {attempt}/1): {error}"
                )

                if not temporary_error:
                    if model_name != MODEL_NAME:
                        raise
                    break

                if attempt < 2:
                    time.sleep(1)

    raise Exception(
        "Gemini could not complete the request right now. "
        "The primary model and fallback model were both unavailable "
        "or rate-limited. Check the backend terminal for the exact "
        "Gemini error."
    ) from last_error


def make_trip_prompt(data):
    """Create a concise, scan-friendly itinerary prompt."""

    destination = data.get("destination", "Not specified")
    starting_location = data.get(
        "startingLocation",
        "Not specified"
    )
    days = data.get("days", "Not specified")
    people = data.get("people", "Not specified")
    budget = data.get("budget", "Not specified")
    travel_month = data.get(
        "travelMonth",
        "Not specified"
    )
    preferences = data.get(
        "preferences",
        "Not specified"
    )

    is_hourly = "hour" in str(days).lower()

    itinerary_heading = (
        "## Time-Block Itinerary"
        if is_hourly
        else "## Day-by-Day Itinerary"
    )

    itinerary_instructions = (
        "Organise the plan into realistic time blocks "
        "across the requested hours. Do not create a "
        "multi-day itinerary."
        if is_hourly
        else
        "For every day, use this exact compact structure:"
    )

    itinerary_structure = (
        "### Suggested time blocks\n"
        "- **Start:** activity + brief practical detail.\n"
        "- **Next:** activity + brief practical detail.\n"
        "- **Finish:** activity or relaxed option.\n"
        "- **Estimated cost:** approximate amount or 'varies'."
        if is_hourly
        else
        "### Day 1 — short theme\n"
        "- **Morning:** activity + one brief practical detail.\n"
        "- **Afternoon:** activity + one brief practical detail.\n"
        "- **Evening:** activity or relaxed option.\n"
        "- **Estimated day cost:** approximate amount or 'varies'.\n"
        "Repeat for all requested days."
    )

    return f"""
You are Voyara, a practical travel planner.
Create a realistic, concise itinerary.

TRIP DETAILS
Destination: {destination}
Starting location: {starting_location}
Duration: {days}
Travellers: {people}
Approximate budget: {budget}
Travel month: {travel_month}
Preferences: {preferences}

OUTPUT RULES
- Be concise and skimmable. Do not write long paragraphs or a travel essay.
- Use the exact section headings and format below.
- Use Markdown headings, bold labels and short bullet points.
- Keep each day or time block concise, with no more than 3 main activity bullets.
- Include estimated costs, but never claim prices or bookings are confirmed.
- Avoid unrealistic travel times; group nearby places together.
- If information is uncertain, say to verify it before travel.
- Do not include a table.

## Trip Overview
- **Destination:** {destination}
- **Starting location:** {starting_location}
- **Duration:** {days}
- **Travellers:** {people}
- **Estimated budget:** {budget}
- **Travel style:** {preferences}

## Quick Summary
Write no more than 2 short sentences.

{itinerary_heading}
{itinerary_instructions}
{itinerary_structure}

## Local Food to Try
- 3–5 named local dishes or food experiences; do not invent local specialties.

## Getting Around & Where to Stay
- 2–4 concise bullets; distinguish suggestions from confirmed details.

## Useful Tips
- 3–5 concise bullets covering weather, safety, etiquette and bookings.
"""


def make_message_prompt(message):
    """Create a concise itinerary from a combined frontend request."""

    return f"""
You are Voyara, a practical travel planner.
Create a concise, readable itinerary from this request:

{message}

Use Markdown with these headings:
## Trip Overview
## Quick Summary
an appropriate itinerary section
(day-by-day for durations in days, time blocks for durations in hours)
## Local Food to Try
## Getting Around & Where to Stay
## Useful Tips

Use bold labels and short bullets.
Keep the summary to 2 sentences maximum.
Avoid long paragraphs and tables.
Keep travel times realistic.
Do not invent confirmed bookings, live prices, opening hours or availability.
Label costs as estimates and ask the traveller to verify time-sensitive details.
"""


def make_modify_prompt(data):
    """Creates a prompt to modify an existing itinerary."""

    itinerary = data.get("itinerary", "")
    modification = data.get("modification", "")
    profile = data.get("profile", {})

    return f"""
You are Voyara, a travel-planning assistant.

The user wants to modify an existing itinerary.

TRIP DETAILS
============
{profile}

CURRENT ITINERARY
=================
{itinerary}

REQUESTED CHANGE
================
{modification}

Update the itinerary according to the requested change.

Rules:
- Keep the original duration unless the user asks to change it.
- Keep the original destination unless the user asks to change it.
- Consider the original budget and preferences.
- Preserve useful parts of the original plan.
- Do not invent confirmed prices or reservations.
- Use clear headings and plain text.
"""


def make_regenerate_prompt(data):
    """Creates a prompt for generating an alternative itinerary."""

    itinerary = data.get("itinerary", "")
    profile = data.get("profile", {})

    return f"""
You are Voyara, a travel-planning assistant.

Create a fresh alternative itinerary for this trip.

TRIP DETAILS
============
{profile}

CURRENT ITINERARY
=================
{itinerary}

Create a different but realistic plan.

Include:
- Day-by-day activities
- Food suggestions
- Transport guidance
- Approximate cost guidance
- Safety and travel tips

Keep the same destination, duration, and general requirements
unless the information suggests otherwise.

Do not claim that prices, tickets, or reservations are confirmed.
Use plain text and clear headings.
"""


# ============================================================
# BASIC ROUTES
# ============================================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "success": True,
        "message": "Voyara backend is running."
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "success": True,
        "backend": "online",
        "gemini_key_loaded": bool(GEMINI_API_KEY),
        "gemini_client_ready": gemini_client is not None,
        "google_places_configured": bool(GOOGLE_MAPS_API_KEY),
        "model": MODEL_NAME,
        "fallback_models": FALLBACK_MODELS
    })


# ============================================================
# PLAN TRIP
# ============================================================

@app.route("/api/plan", methods=["POST"])
def plan_trip():
    data = request.get_json(silent=True) or {}

    if not data:
        return jsonify({
            "success": False,
            "error": "No trip details were received."
        }), 400

    message = str(
        data.get("message", "")
    ).strip()

    if message:
        prompt = make_message_prompt(message)
    else:
        prompt = make_trip_prompt(data)

    try:
        itinerary = generate_with_gemini(prompt)

        return jsonify({
            "success": True,
            "itinerary": itinerary,
            "profile": data
        })

    except Exception as error:
        print("PLAN ERROR:", error)

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


# ============================================================
# MODIFY TRIP
# ============================================================

@app.route("/api/modify", methods=["POST"])
def modify_trip():
    data = request.get_json(silent=True) or {}

    itinerary = str(
        data.get("itinerary", "")
    ).strip()

    modification = str(
        data.get("modification", "")
    ).strip()

    if not itinerary:
        return jsonify({
            "success": False,
            "error": "No existing itinerary was provided."
        }), 400

    if not modification:
        return jsonify({
            "success": False,
            "error": "Please enter a modification request."
        }), 400

    try:
        prompt = make_modify_prompt(data)
        updated_itinerary = generate_with_gemini(prompt)

        return jsonify({
            "success": True,
            "itinerary": updated_itinerary
        })

    except Exception as error:
        print("MODIFY ERROR:", error)

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


# ============================================================
# REGENERATE TRIP
# ============================================================

@app.route("/api/regenerate", methods=["POST"])
def regenerate_trip():
    data = request.get_json(silent=True) or {}

    itinerary = str(
        data.get("itinerary", "")
    ).strip()

    if not itinerary:
        return jsonify({
            "success": False,
            "error": "No itinerary was provided."
        }), 400

    try:
        prompt = make_regenerate_prompt(data)
        regenerated_itinerary = generate_with_gemini(prompt)

        return jsonify({
            "success": True,
            "itinerary": regenerated_itinerary
        })

    except Exception as error:
        print("REGENERATE ERROR:", error)

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


# ============================================================
# NEW TRIP
# ============================================================

@app.route("/api/new-trip", methods=["POST"])
def new_trip():
    return jsonify({
        "success": True,
        "message": "Ready to create a new trip."
    })


# ============================================================
# DESTINATION GUIDE
# ============================================================

@app.route("/api/destination-guide", methods=["POST"])
def destination_guide():
    data = request.get_json(silent=True) or {}

    destination = str(
        data.get("destination", "")
    ).strip()

    location = str(
        data.get("location", "")
    ).strip()

    place_type = str(
        data.get("type", "place")
    ).strip()

    if not destination:
        return jsonify({
            "success": False,
            "error": "A destination is required."
        }), 400

    prompt = f"""
You are Voyara, a careful travel guide writer.
Write a concise guide for this destination.

Destination: {destination}
Location context from map search: {location}
Place type: {place_type}

Return only valid JSON with these string fields:
- description: one attractive but factual sentence, max 25 words.
- introduction: 2 concise sentences about the destination's known character and useful travel angle.
- bestTime: short seasonal guidance; acknowledge regional variation if needed.
- duration: a suggested visit length, clearly approximate.
- budget: concise cost guidance without inventing exact live prices.

Do not make up attractions, current opening hours, current prices,
bookings, safety guarantees or live availability.
If uncertain, use cautious wording and tell the traveller to
verify details. No markdown fences.
"""

    try:
        raw = generate_with_gemini(prompt).strip()

        cleaned = (
            raw
            .removeprefix("```json")
            .removeprefix("```")
            .removesuffix("```")
            .strip()
        )

        try:
            guide = json.loads(cleaned)

        except json.JSONDecodeError:
            guide = {
                "description": raw[:180],
                "introduction": raw[:600]
            }

        return jsonify({
            "success": True,
            "description": str(
                guide.get("description", "")
            ).strip(),

            "introduction": str(
                guide.get("introduction", "")
            ).strip(),

            "bestTime": str(
                guide.get(
                    "bestTime",
                    "Check seasonal weather for your dates."
                )
            ).strip(),

            "duration": str(
                guide.get(
                    "duration",
                    "Choose a duration based on the places you want to visit."
                )
            ).strip(),

            "budget": str(
                guide.get(
                    "budget",
                    "Compare transport, accommodation, food and activity costs."
                )
            ).strip()
        })

    except Exception as error:
        print("DESTINATION GUIDE ERROR:", error)

        return jsonify({
            "success": False,
            "error": "AI destination guidance is temporarily unavailable."
        }), 503


# ============================================================
# VOYARA ASSISTANT CHAT
# ============================================================

@app.route("/api/chat", methods=["POST"])
def chat_assistant():
    data = request.get_json(silent=True) or {}

    message = str(
        data.get("message", "")
    ).strip()

    history = data.get("history", [])
    context = data.get("context", {})

    if not message:
        return jsonify({
            "success": False,
            "error": "Please enter a message."
        }), 400

    safe_history = []

    if isinstance(history, list):
        for item in history[-8:]:
            if isinstance(item, dict):
                role = (
                    "User"
                    if item.get("role") == "user"
                    else "Voyara"
                )

                content = str(
                    item.get("content", "")
                )[:1200]

                if content:
                    safe_history.append(
                        f"{role}: {content}"
                    )

    prompt = f"""
You are Voyara Assistant, a friendly and practical
travel-planning helper inside a travel website.

Help users navigate the app, plan trips, understand
itineraries, budget, packing, destinations, and travel safety.

Be concise, ask a clarifying question when needed,
and never claim bookings, opening hours, prices,
weather, or live availability are confirmed unless verified.

For time-sensitive travel information, tell users to
verify official sources.

If asked how to use the website, give simple step-by-step instructions.

Current app context (may be incomplete):
{json.dumps(context, ensure_ascii=False)[:2000]}

Recent conversation:
{chr(10).join(safe_history)}

User message:
{message}

Reply helpfully in plain text.
"""

    try:
        reply = generate_with_gemini(prompt)

        return jsonify({
            "success": True,
            "reply": reply
        })

    except Exception as error:
        print("CHAT ERROR:", error)

        return jsonify({
            "success": False,
            "error": (
                "The AI assistant is temporarily unavailable. "
                "Please check that the backend and Gemini API "
                "are working, then try again."
            )
        }), 503


# ============================================================
# PLACE DISCOVERY
# Google Places when configured; OSM fallback
# ============================================================

PLACE_CATEGORY_QUERY = {
    "Food & Cafés":
        "top rated restaurants cafes local food and coffee",

    "Attractions & Culture":
        "top tourist attractions museums cultural landmarks historic places",

    "Nature & Outdoors":
        "top nature attractions parks beaches waterfalls viewpoints hiking outdoor places",

    "Experiences & Activities":
        "top experiences activities adventure tours cultural experiences things to do",

    "Shopping & Local Markets":
        "top shopping areas local markets bazaars shopping streets handicrafts",

    "all":
        "top places to visit",
}


def _json_request(
    url,
    payload=None,
    headers=None,
    timeout=18
):
    body = (
        None
        if payload is None
        else json.dumps(payload).encode("utf-8")
    )

    request_headers = {
        "User-Agent": "VoyaraTravelPlanner/1.0 (local prototype)"
    }

    if headers:
        request_headers.update(headers)

    if body is not None:
        request_headers.setdefault(
            "Content-Type",
            "application/json"
        )

    req = urllib.request.Request(
        url,
        data=body,
        headers=request_headers,
        method="GET" if body is None else "POST"
    )

    with urllib.request.urlopen(
        req,
        timeout=timeout
    ) as response:
        return json.loads(
            response.read().decode("utf-8")
        )


def _geocode_destination(destination):
    query = urllib.parse.urlencode({
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 1,
        "q": destination
    })

    data = _json_request(
        f"https://nominatim.openstreetmap.org/search?{query}",
        headers={
            "Accept-Language": "en"
        },
        timeout=12
    )

    if not data:
        raise ValueError(
            "Destination not found. "
            "Try adding a state or country."
        )

    return data[0]


def _google_places_search(
    destination,
    category,
    query_text
):
    category_text = PLACE_CATEGORY_QUERY.get(
        category,
        PLACE_CATEGORY_QUERY["all"]
    )

    text_query = " ".join(
        part
        for part in [
            query_text,
            category_text,
            destination
        ]
        if part
    ).strip()

    payload = {
        "textQuery": text_query,
        "maxResultCount": 6
    }

    fields = (
        "places.id,"
        "places.displayName,"
        "places.formattedAddress,"
        "places.rating,"
        "places.userRatingCount,"
        "places.googleMapsUri,"
        "places.primaryTypeDisplayName,"
        "places.location"
    )

    data = _json_request(
        "https://places.googleapis.com/v1/places:searchText",
        payload,
        headers={
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": fields
        },
        timeout=18
    )

    if not data.get("places"):
        fallback_query = (
            f"{category_text} in {destination}"
        )

        if query_text:
            fallback_query = (
                f"{query_text} {fallback_query}"
            )

        data = _json_request(
            "https://places.googleapis.com/v1/places:searchText",
            {
                "textQuery": fallback_query,
                "maxResultCount": 6
            },
            headers={
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": fields
            },
            timeout=18
        )

    results = []

    for place in data.get("places", []):
        display = place.get(
            "displayName"
        ) or {}

        name = str(
            display.get("text", "")
        ).strip()

        if not name:
            continue

        location = place.get(
            "location"
        ) or {}

        results.append({
            "id": place.get("id", name),
            "name": name,
            "destination": destination,
            "category": category,
            "type": (
                place.get(
                    "primaryTypeDisplayName"
                ) or {}
            ).get(
                "text",
                category
            ),
            "address": place.get(
                "formattedAddress",
                ""
            ),
            "lat": location.get(
                "latitude"
            ),
            "lon": location.get(
                "longitude"
            ),
            "rating": place.get(
                "rating"
            ),
            "ratingCount": place.get(
                "userRatingCount"
            ),
            "mapUrl": (
                place.get("googleMapsUri")
                or
                f"https://www.google.com/maps/search/"
                f"?api=1&query="
                f"{urllib.parse.quote(name + ', ' + destination)}"
            ),
            "source": "Google Places",
        })

    return results


def _osm_places_search(
    destination,
    category,
    query_text
):
    """Reliable POI search using one geocode request and one scoped
    Overpass request, with Nominatim as a lightweight fallback.
    """

    category_tags = {
        "Food & Cafés": [
            '"amenity"~"restaurant|cafe|fast_food|food_court|bar"'
        ],
        "Attractions & Culture": [
            '"tourism"~"attraction|museum|gallery|artwork|zoo"'
        ],
        "Nature & Outdoors": [
            '"leisure"~"park|nature_reserve|garden"',
            '"natural"~"waterfall|beach|peak|viewpoint"'
        ],
        "Experiences & Activities": [
            '"tourism"~"attraction|theme_park|viewpoint"',
            '"leisure"~"sports_centre|water_park|stadium"'
        ],
        "Shopping & Local Markets": [
            '"shop"~"supermarket|mall|department_store|gift|clothes|shoes"',
            '"amenity"="marketplace"'
        ],
        "all": [
            '"tourism"~"attraction|museum|gallery"',
            '"amenity"~"restaurant|cafe|marketplace"',
            '"leisure"~"park|garden"'
        ],
    }

    def geocode():
        params = urllib.parse.urlencode({
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 1,
            "q": destination,
        })
        return _json_request(
            "https://nominatim.openstreetmap.org/search?" + params,
            headers={
                "Accept-Language": "en",
                "User-Agent": "VoyaraTravelPlanner/1.0",
            },
            timeout=7,
        )

    try:
        places = geocode()
        if not places:
            return []
        center = places[0]
        lat = float(center["lat"])
        lon = float(center["lon"])
    except Exception as error:
        print("OSM GEOCODE ERROR:", error)
        return []

    tags = category_tags.get(category, category_tags["all"])
    query = str(query_text or "").strip()

    if query:
        # Keep arbitrary user searches useful without trusting the text
        # as an Overpass expression.
        search_text = query.replace('"', "").replace("\\", " ")[:80]
        tags = [
            f'"name"~"{search_text}",i',
            f'"amenity"~"restaurant|cafe|marketplace"',
            f'"tourism"~"attraction|museum|gallery"',
            f'"leisure"~"park|garden"',
        ]

    clauses = []
    for tag in tags:
        for element in ("node", "way", "relation"):
            clauses.append(
                f"{element}(around:12000,{lat},{lon})[{tag}];"
            )

    overpass_query = (
        "[out:json][timeout:8];("
        + "".join(clauses)
        + ");out center tags 12;"
    )

    try:
        payload = urllib.parse.urlencode({
            "data": overpass_query
        })
        data = _json_request(
            "https://overpass-api.de/api/interpreter?" + payload,
            headers={
                "User-Agent": "VoyaraTravelPlanner/1.0",
            },
            timeout=12,
        )
        elements = data.get("elements", [])
    except Exception as error:
        print("OVERPASS SEARCH ERROR:", error)
        elements = []

    results = []
    seen = set()

    for item in elements:
        tags_data = item.get("tags") or {}
        name = str(tags_data.get("name") or "").strip()
        if not name:
            continue

        center_data = item.get("center") or {}
        item_lat = item.get("lat", center_data.get("lat"))
        item_lon = item.get("lon", center_data.get("lon"))
        if item_lat is None or item_lon is None:
            continue

        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)

        place_type = (
            tags_data.get("amenity")
            or tags_data.get("tourism")
            or tags_data.get("leisure")
            or tags_data.get("shop")
            or tags_data.get("natural")
            or category
        )

        result_category = category
        if category == "all":
            if tags_data.get("amenity") in {"restaurant", "cafe", "fast_food", "food_court", "bar"}:
                result_category = "Food & Cafés"
            elif tags_data.get("amenity") == "marketplace" or tags_data.get("shop"):
                result_category = "Shopping & Local Markets"
            elif tags_data.get("leisure") in {"park", "garden", "nature_reserve"} or tags_data.get("natural") in {"waterfall", "beach", "peak", "viewpoint"}:
                result_category = "Nature & Outdoors"
            elif tags_data.get("tourism") in {"attraction", "museum", "gallery", "artwork", "zoo"}:
                result_category = "Attractions & Culture"
            else:
                result_category = "Experiences & Activities"

        address_parts = [
            tags_data.get("addr:street"),
            tags_data.get("addr:city"),
            tags_data.get("addr:state"),
        ]
        address = ", ".join(
            str(part).strip()
            for part in address_parts
            if part
        ) or destination

        results.append({
            "id": f"osm-{item.get('type')}-{item.get('id')}",
            "name": name,
            "destination": destination,
            "category": result_category,
            "type": str(place_type).replace("_", " "),
            "address": address,
            "lat": item_lat,
            "lon": item_lon,
            "rating": None,
            "ratingCount": None,
            "mapUrl": (
                "https://www.google.com/maps/search/?api=1&query="
                + urllib.parse.quote(name + ", " + destination)
            ),
            "source": "OpenStreetMap",
        })

        if len(results) >= 6:
            break

    if results:
        return results[:6]

    # Last-resort Nominatim fallback. This is intentionally only one
    # request so a temporary Overpass issue cannot make the UI hang.
    try:
        fallback_query = (
            f"{query} in {destination}"
            if query
            else f"{category} in {destination}"
        )
        params = urllib.parse.urlencode({
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 6,
            "q": fallback_query,
        })
        fallback = _json_request(
            "https://nominatim.openstreetmap.org/search?" + params,
            headers={
                "Accept-Language": "en",
                "User-Agent": "VoyaraTravelPlanner/1.0",
            },
            timeout=7,
        )
        for item in fallback:
            name = str(
                item.get("name")
                or item.get("display_name", "").split(",")[0]
                or ""
            ).strip()
            if not name:
                continue
            results.append({
                "id": f"osm-{item.get('osm_type')}-{item.get('osm_id')}",
                "name": name,
                "destination": destination,
                "category": (
                    "Attractions & Culture"
                    if category == "all"
                    else category
                ),
                "type": str(
                    item.get("type") or item.get("class") or category
                ).replace("_", " "),
                "address": item.get("display_name") or destination,
                "lat": item.get("lat"),
                "lon": item.get("lon"),
                "rating": None,
                "ratingCount": None,
                "mapUrl": (
                    "https://www.google.com/maps/search/?api=1&query="
                    + urllib.parse.quote(name + ", " + destination)
                ),
                "source": "OpenStreetMap",
            })
            if len(results) >= 6:
                break
    except Exception as error:
        print("OSM FALLBACK ERROR:", error)

    return results[:6]


@app.route(
    "/api/places",
    methods=["POST"]
)
def discover_places():
    data = request.get_json(
        silent=True
    ) or {}

    destination = str(
        data.get(
            "destination",
            ""
        )
    ).strip()

    category = str(
        data.get(
            "category",
            "all"
        )
    ).strip()

    query_text = str(
        data.get(
            "query",
            ""
        )
    ).strip()

    if not destination:
        return jsonify({
            "success": False,
            "error": "Enter a destination first."
        }), 400

    try:
        if GOOGLE_MAPS_API_KEY:
            results = _google_places_search(
                destination,
                category,
                query_text
            )
            source = "Google Places"

        else:
            results = _osm_places_search(
                destination,
                category,
                query_text
            )
            source = "OpenStreetMap"

        return jsonify({
            "success": True,
            "source": source,
            "google_places_configured":
                bool(GOOGLE_MAPS_API_KEY),
            "results":
                results[:6],
        })

    except urllib.error.HTTPError as error:
        print(
            "PLACE LOOKUP HTTP ERROR:",
            error.code,
            error.reason
        )

        if GOOGLE_MAPS_API_KEY:
            message = (
                "Google Places could not complete the search. "
                "Check that the API key, Places API and billing "
                "are configured."
            )
        else:
            message = (
                "The open place directory is temporarily busy. "
                "Please try again in a moment."
            )

        return jsonify({
            "success": False,
            "error": message
        }), 503

    except Exception as error:
        print(
            "PLACE LOOKUP ERROR:",
            error
        )

        return jsonify({
            "success": False,
            "error": (
                "Place recommendations are temporarily unavailable. "
                "Check your connection and try again."
            )
        }), 503


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    print("\n========================================")
    print("          VOYARA BACKEND")
    print("========================================")
    print("Server: http://127.0.0.1:5000")
    print("Health: http://127.0.0.1:5000/api/health")
    print("========================================\n")

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )