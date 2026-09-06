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
    print("Make sure GEMINI_API_KEY is present in your .env file.")
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
# LOAD PROFILE
# ==================================================

def load_profile():

    if os.path.exists(PROFILE_FILE):

        try:

            with open(PROFILE_FILE, "r", encoding="utf-8") as file:

                profile = json.load(file)

            # Make sure all required fields exist
            for key in default_profile:

                if key not in profile:
                    profile[key] = default_profile[key]

            return profile

        except Exception:

            print("⚠️ Could not read the saved trip profile.")

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
# CHECK COMPLETE PROFILE
# ==================================================

def profile_is_complete(profile):

    return len(get_missing_fields(profile)) == 0


# ==================================================
# RESET PROFILE
# ==================================================

def reset_profile():

    return default_profile.copy()


# ==================================================
# LOCAL ANSWER EXTRACTION
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

        # Keep the user's original budget text.
        # Gemini can interpret values such as:
        # 30000
        # ₹30,000
        # 30k
        # 30,000 rupees

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
# GEMINI PROFILE UPDATE
# ==================================================

def update_profile_with_gemini(profile, user_message):

    extraction_prompt = f"""
You are updating a travel profile for an AI travel planning
assistant called Voyara.

Current saved trip profile:

{json.dumps(profile, indent=4, ensure_ascii=False)}

New user message:

{user_message}

Update the profile using ONLY information explicitly provided
in the new user message.

Rules:

1. Keep existing information that the user did not change.
2. Add new information from the user message.
3. If the user clearly corrects existing information,
   replace the old information.
4. Never invent information.
5. Unknown fields must remain null.
6. interests must always be a list.
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


        # ------------------------------------------
        # Remove markdown code fences if Gemini
        # accidentally returns them.
        # ------------------------------------------

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


        # ------------------------------------------
        # Update profile
        # ------------------------------------------

        for field in default_profile:

            if field in extracted:

                value = extracted[field]

                if (
                    value is not None
                    and value != ""
                    and value != []
                ):

                    profile[field] = value


        save_profile(profile)

        return profile


    except Exception as error:

        print("\n⚠️ I couldn't process that message automatically.")

        print("Error:", error)

        print("\nWe'll continue one question at a time.")

        return profile


# ==================================================
# ITINERARY INSTRUCTIONS
# ==================================================

planner_instruction = """
You are Voyara, a personalized travel planning agent.

Create a practical, realistic and personalized itinerary
based on the completed trip profile.

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
- Do not pretend that you have made reservations.

If something important is unknown, make a reasonable assumption
and clearly label it as an assumption.

Make sure the estimated total cost is consistent with the user's
stated budget.

Make the itinerary useful and realistic rather than simply
listing many tourist attractions.

Use clear headings and concise explanations.

Prefer a logical travel route that avoids unnecessary travel
backtracking.

Consider the travel month when recommending activities and
destinations.

If an attraction may be seasonal or weather-dependent,
mention that appropriately.

Use Indian Rupees (₹) when the user's budget is in INR.
"""


# ==================================================
# GENERATE ITINERARY
# ==================================================

def generate_itinerary(profile):

    print(
        "\n🧳 Voyara is creating your personalized itinerary..."
    )


    planner_prompt = f"""
Completed trip profile:

{json.dumps(profile, indent=4, ensure_ascii=False)}

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


# ==================================================
# SHOW PROFILE
# ==================================================

def show_profile(profile):

    print("\n🧠 Current Trip Profile:")

    print(
        json.dumps(
            profile,
            indent=4,
            ensure_ascii=False
        )
    )


# ==================================================
# COLLECT MISSING INFORMATION
# ==================================================

def collect_missing_information(profile):

    while True:

        missing_fields = get_missing_fields(profile)


        # ------------------------------------------
        # Profile complete
        # ------------------------------------------

        if not missing_fields:

            return profile


        # ------------------------------------------
        # Ask next missing question
        # ------------------------------------------

        field = missing_fields[0]

        print(
            f"\n✈️ Voyara: {questions[field]}"
        )


        answer = input("\nYou: ").strip()


        # ------------------------------------------
        # Exit
        # ------------------------------------------

        if answer.lower() == "exit":

            save_profile(profile)

            print(
                "\n💾 Your trip information has been saved."
            )

            print(
                "You can come back later and continue."
            )

            print(
                "✈️ Thanks for planning with Voyara!"
            )

            return None


        # ------------------------------------------
        # Update locally
        # ------------------------------------------

        value = extract_answer(
            field,
            answer
        )

        profile[field] = value


        # ------------------------------------------
        # Save
        # ------------------------------------------

        save_profile(profile)


        # ------------------------------------------
        # Show profile
        # ------------------------------------------

        show_profile(profile)


# ==================================================
# MAIN PROGRAM
# ==================================================

trip_profile = load_profile()


print("🌍 Welcome to Voyara!")

print(
    "Tell me about the trip you want to plan."
)

print(
    "Type 'exit' when you want to stop."
)

print()


# ==================================================
# HANDLE SAVED PROFILE
# ==================================================

if profile_is_complete(trip_profile):

    print("💾 I found a completed saved trip profile!")

    show_profile(trip_profile)

    print("\nWhat would you like to do?")

    print("1. Generate itinerary using this trip")

    print("2. Change something about this trip")

    print("3. Start a new trip")


    choice = input("\nYou: ").strip()


    # ----------------------------------------------
    # OPTION 1
    # ----------------------------------------------

    if choice == "1":

        generate_itinerary(trip_profile)


        print(
            "\n✈️ Thanks for planning with Voyara!"
        )


        exit()


    # ----------------------------------------------
    # OPTION 2
    # ----------------------------------------------

    elif choice == "2":

        print(
            "\nTell me what you want to change."
        )

        print(
            "For example: "
            "\"Change the budget to ₹40,000\""
        )


        user_message = input("\nYou: ").strip()


        if user_message.lower() == "exit":

            print(
                "\n✈️ Thanks for planning with Voyara!"
            )

            exit()


        trip_profile = update_profile_with_gemini(
            trip_profile,
            user_message
        )


        show_profile(trip_profile)


    # ----------------------------------------------
    # OPTION 3
    # ----------------------------------------------

    elif choice == "3":

        trip_profile = reset_profile()

        save_profile(trip_profile)

        print(
            "\n🆕 Starting a new trip!"
        )


    # ----------------------------------------------
    # Invalid option
    # ----------------------------------------------

    else:

        print(
            "\n⚠️ Invalid choice."
        )

        print(
            "Please run Voyara again and choose 1, 2 or 3."
        )

        exit()


# ==================================================
# HANDLE PARTIALLY COMPLETED PROFILE
# ==================================================

elif len(get_missing_fields(trip_profile)) < len(default_profile):

    print(
        "💾 I found some saved trip information!"
    )

    show_profile(trip_profile)


    print(
        "\nTell me anything else about your trip."
    )

    print(
        "You can provide multiple details in one message."
    )


    first_message = input("\nYou: ").strip()


    if first_message.lower() == "exit":

        save_profile(trip_profile)

        print(
            "\n💾 Your trip information has been saved."
        )

        print(
            "✈️ Thanks for planning with Voyara!"
        )

        exit()


    # ----------------------------------------------
    # Gemini updates saved profile
    # ----------------------------------------------

    trip_profile = update_profile_with_gemini(
        trip_profile,
        first_message
    )


    show_profile(trip_profile)


# ==================================================
# HANDLE COMPLETELY NEW PROFILE
# ==================================================

else:

    print(
        "Let's start by telling me about your trip."
    )

    first_message = input("\nYou: ").strip()


    if first_message.lower() == "exit":

        print(
            "\n✈️ Thanks for planning with Voyara!"
        )

        exit()


    # ----------------------------------------------
    # Gemini extracts initial information
    # ----------------------------------------------

    trip_profile = update_profile_with_gemini(
        trip_profile,
        first_message
    )


    show_profile(trip_profile)


# ==================================================
# COLLECT REMAINING INFORMATION
# ==================================================

trip_profile = collect_missing_information(
    trip_profile
)


# ==================================================
# USER EXITED
# ==================================================

if trip_profile is None:

    exit()


# ==================================================
# PROFILE COMPLETE
# ==================================================

print(
    "\n✅ Trip information complete!"
)


print(
    "\n🧠 Final Trip Profile:"
)


print(
    json.dumps(
        trip_profile,
        indent=4,
        ensure_ascii=False
    )
)


# ==================================================
# GENERATE ITINERARY
# ==================================================

generate_itinerary(trip_profile)