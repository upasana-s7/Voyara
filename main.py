import os
import json
import re
from dotenv import load_dotenv
from google import genai

load_dotenv()

# ==================================================
# API SETUP
# ==================================================

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ API key not found!")
    exit()

client = genai.Client(api_key=api_key)

PROFILE_FILE = "trip_profile.json"


# ==================================================
# DEFAULT TRIP PROFILE
# ==================================================

default_profile = {
    "destination": None,
    "duration": None,
    "budget": None,
    "travelers": None,
    "starting_location": None,
    "travel_month": None,
    "interests": []
}


# ==================================================
# LOAD SAVED PROFILE
# ==================================================

def load_profile():

    if os.path.exists(PROFILE_FILE):

        try:

            with open(PROFILE_FILE, "r", encoding="utf-8") as file:
                profile = json.load(file)

            # Make sure every required field exists
            for key in default_profile:

                if key not in profile:
                    profile[key] = default_profile[key]

            return profile

        except Exception:
            pass

    return default_profile.copy()


# ==================================================
# SAVE PROFILE
# ==================================================

def save_profile(profile):

    with open(PROFILE_FILE, "w", encoding="utf-8") as file:

        json.dump(
            profile,
            file,
            indent=4,
            ensure_ascii=False
        )


# ==================================================
# CHECK MISSING FIELDS
# ==================================================

def get_missing_fields(profile):

    missing = []

    for field in default_profile:

        value = profile.get(field)

        if value is None or value == "" or value == []:
            missing.append(field)

    return missing


# ==================================================
# QUESTIONS
# ==================================================

questions = {

    "destination":
        "Where would you like to travel?",

    "duration":
        "How many days will you be traveling?",

    "budget":
        "What is your total budget?",

    "travelers":
        "How many people are traveling?",

    "starting_location":
        "Where will you be traveling from?",

    "travel_month":
        "Which month or dates are you planning to travel?",

    "interests":
        "What are your interests or preferences?"
}


# ==================================================
# SIMPLE LOCAL ANSWER EXTRACTION
# ==================================================
# These functions do NOT call Gemini.
# ==================================================

def extract_answer(field, answer):

    answer = answer.strip()


    # ----------------------------------------------
    # DESTINATION
    # ----------------------------------------------

    if field == "destination":

        return answer


    # ----------------------------------------------
    # DURATION
    # ----------------------------------------------

    if field == "duration":

        match = re.search(r"\d+", answer)

        if match:

            number = match.group()

            return f"{number} days"

        return answer


    # ----------------------------------------------
    # BUDGET
    # ----------------------------------------------

    if field == "budget":

        return answer


    # ----------------------------------------------
    # TRAVELERS
    # ----------------------------------------------

    if field == "travelers":

        match = re.search(r"\d+", answer)

        if match:

            number = match.group()

            return f"{number} travelers"

        return answer


    # ----------------------------------------------
    # STARTING LOCATION
    # ----------------------------------------------

    if field == "starting_location":

        return answer


    # ----------------------------------------------
    # TRAVEL MONTH
    # ----------------------------------------------

    if field == "travel_month":

        return answer


    # ----------------------------------------------
    # INTERESTS
    # ----------------------------------------------

    if field == "interests":

        # Allows:
        #
        # nature and food
        # nature, food, photography
        # nature, food and photography

        parts = re.split(
            r",|\band\b",
            answer,
            flags=re.IGNORECASE
        )

        interests = []

        for part in parts:

            part = part.strip()

            if part:
                interests.append(part)

        return interests

    return answer


# ==================================================
# ITINERARY INSTRUCTIONS
# ==================================================

planner_instruction = """
You are Voyara, a personalized travel planning agent.

Create a practical and realistic itinerary based on the completed
trip profile.

Requirements:

- Respect the user's total budget.
- Respect the trip duration.
- Consider the number of travelers.
- Consider the starting location.
- Consider the travel month.
- Prioritize the user's interests.
- Organize the trip day by day.
- Include transportation suggestions.
- Include accommodation suggestions appropriate for the budget.
- Include food recommendations relevant to the user's interests.
- Include an estimated cost breakdown.
- Clearly state that prices are estimates.
- Do not claim that live prices, availability, reservations,
  or schedules have been verified.
- Do not invent confirmed bookings.

If something important is unknown, make a reasonable assumption
and clearly label it as an assumption.

Make the itinerary useful and realistic rather than simply listing
many tourist attractions.

Use clear headings and concise explanations.
"""


# ==================================================
# START
# ==================================================

trip_profile = load_profile()

print("🌍 Welcome to Voyara!")
print("Tell me about the trip you want to plan.")
print("Type 'exit' when you want to stop.")
print()


# ==================================================
# SHOW SAVED INFORMATION
# ==================================================

missing_fields = get_missing_fields(trip_profile)

if len(missing_fields) < len(default_profile):

    print("💾 I found some saved trip information!")

    print(
        json.dumps(
            trip_profile,
            indent=4,
            ensure_ascii=False
        )
    )

    print()


# ==================================================
# FIRST USER MESSAGE
# ==================================================

first_message = input("You: ").strip()

if first_message.lower() == "exit":

    print("\n✈️ Thanks for planning with Voyara!")
    exit()


# ==================================================
# PROCESS FIRST MESSAGE
# ==================================================
#
# IMPORTANT:
#
# The first message is ALWAYS sent to Gemini,
# even when a saved profile already exists.
#
# Gemini receives the existing profile and the
# new message, then returns the updated profile.
#
# This means:
#
# Saved:
# destination = Kerala
#
# New message:
# "I want to visit Kerala for 5 days.
#  I love nature and food."
#
# Result:
# destination = Kerala
# duration = 5 days
# interests = [nature, food]
#
# Only ONE Gemini call is used here.
# ==================================================

extraction_prompt = f"""
You are updating a travel profile.

Current saved trip profile:

{json.dumps(trip_profile, indent=4, ensure_ascii=False)}

New user message:

{first_message}

Update the current trip profile using ONLY information
explicitly provided in the new user message.

Rules:

1. Keep existing information that the user did not change.
2. Add new information from the user message.
3. If the user clearly corrects existing information,
   replace the old information.
4. Never invent missing information.
5. Keep unknown fields as null.
6. interests must be a list.
7. Return ONLY valid JSON.
8. Use exactly this structure:

{{
    "destination": null,
    "duration": null,
    "budget": null,
    "travelers": null,
    "starting_location": null,
    "travel_month": null,
    "interests": []
}}
"""


try:

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=extraction_prompt
    )

    response_text = response.text.strip()

    # Remove accidental markdown code fences
    response_text = re.sub(
        r"^```json\s*",
        "",
        response_text,
        flags=re.IGNORECASE
    )

    response_text = re.sub(
        r"\s*```$",
        "",
        response_text
    )

    extracted = json.loads(response_text)

    # Update only valid fields
    for field in default_profile:

        if field in extracted:

            value = extracted[field]

            if value is not None and value != [] and value != "":

                trip_profile[field] = value

    save_profile(trip_profile)


except Exception as error:

    print("\n⚠️ I couldn't process that message automatically.")

    print("Error:", error)

    print("\nWe'll continue one question at a time.")


# ==================================================
# SHOW UPDATED PROFILE
# ==================================================

print("\n🧠 Current Trip Profile:")

print(
    json.dumps(
        trip_profile,
        indent=4,
        ensure_ascii=False
    )
)


# ==================================================
# MAIN QUESTION LOOP
# ==================================================

while True:

    missing_fields = get_missing_fields(trip_profile)


    # ==================================================
    # PROFILE COMPLETE
    # ==================================================

    if not missing_fields:

        print("\n✅ Trip information complete!")

        print("\n🧠 Final Trip Profile:")

        print(
            json.dumps(
                trip_profile,
                indent=4,
                ensure_ascii=False
            )
        )

        print(
            "\n🧳 Voyara is creating your personalized itinerary..."
        )


        # ----------------------------------------------
        # ITINERARY GENERATION
        # ----------------------------------------------

        planner_prompt = f"""
Completed trip profile:

{json.dumps(trip_profile, indent=4, ensure_ascii=False)}

Create the personalized itinerary now.
"""


        try:

            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=planner_prompt,
                config={
                    "system_instruction": planner_instruction
                }
            )

            print("\n\n✈️ VOYARA'S ITINERARY\n")

            print(response.text)

            print("\n\n✅ Trip planning complete!")


        except Exception as error:

            print("\n❌ Could not generate the itinerary.")

            print("Error:", error)


        break


    # ==================================================
    # ASK NEXT MISSING QUESTION
    # ==================================================

    field = missing_fields[0]

    print(f"\n✈️ Voyara: {questions[field]}")


    answer = input("\nYou: ").strip()


    # ==================================================
    # EXIT
    # ==================================================

    if answer.lower() == "exit":

        save_profile(trip_profile)

        print("\n💾 Your trip information has been saved.")

        print("You can come back later and continue.")

        print("✈️ Thanks for planning with Voyara!")

        break


    # ==================================================
    # PROCESS ANSWER LOCALLY
    # ==================================================
    #
    # IMPORTANT:
    #
    # No Gemini API call happens here.
    #
    # This saves your API quota.
    # ==================================================

    value = extract_answer(field, answer)

    trip_profile[field] = value


    # ==================================================
    # SAVE PROFILE
    # ==================================================

    save_profile(trip_profile)


    # ==================================================
    # SHOW UPDATED PROFILE
    # ==================================================

    print("\n🧠 Current Trip Profile:")

    print(
        json.dumps(
            trip_profile,
            indent=4,
            ensure_ascii=False
        )
    )