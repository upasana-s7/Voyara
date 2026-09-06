# ✈️ Voyara

An AI-powered travel planning assistant that creates personalized travel itineraries based on your destination, duration, budget, travelers, starting location, travel month, and interests.

## ✨ Features

- 🧠 Collects trip preferences through a conversational interface
- 📍 Supports destination, duration, budget, travelers, starting location, and travel month
- ❤️ Takes personal interests into account
- 💾 Saves the trip profile locally
- 🤖 Uses Google Gemini to generate a personalized itinerary
- 🗓️ Creates a day-by-day travel plan
- 💰 Provides an estimated budget breakdown
- 🍴 Suggests food experiences based on the user's interests
- 🚍 Includes transportation and accommodation suggestions

## 🛠️ Tech Stack

- **Python** — Core programming language
- **Google Gemini API** — AI-powered travel planning
- **Google GenAI SDK** — Gemini API integration
- **python-dotenv** — Secure environment variable management
- **JSON** — Trip profile storage
- **Git & GitHub** — Version control

## ⚙️ How It Works

Voyara follows a simple conversational workflow:

1. 👤 The user describes the trip they want to plan.
2. 🧠 Voyara extracts important trip details from the conversation.
3. 📝 The trip profile is updated as the user provides more information.
4. 🔎 Voyara checks whether any required information is missing.
5. 💬 If information is missing, Voyara asks for the remaining details.
6. ✅ Once the trip profile is complete, Voyara generates a personalized itinerary.
7. 💰 The itinerary includes estimated costs, transportation, accommodation, activities, and food recommendations.

## 📁 Project Structure

```text
Voyara/
├── main.py              # Main application
├── requirements.txt     # Python dependencies
├── .gitignore           # Files excluded from Git
├── .env                 # API key (kept private)
├── trip_profile.json    # Saved trip profile (kept private)
└── README.md            # Project documentation
```

## 🚀 Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/upasana-s7/Voyara.git
cd Voyara
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

### 3. Activate the virtual environment

On Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Add your Gemini API key

Create a `.env` file in the project folder:

```text
GEMINI_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your own Gemini API key.

**Never commit your `.env` file or expose your API key publicly.**

## ▶️ Run Voyara

After activating the virtual environment and installing the dependencies, run:

```bash
python main.py
```

Voyara will start a conversational session and ask about your trip.

Example:

```text
🌍 Welcome to Voyara!
Tell me about the trip you want to plan.

You: I want to visit Kerala for 5 days. I love nature and food.
```

Voyara will collect the missing trip details and generate a personalized itinerary once the profile is complete.

## 🔐 Security

Voyara uses environment variables to keep the Gemini API key out of the source code.

The `.env` file should remain local and must not be uploaded to GitHub.

Make sure `.env` is included in `.gitignore`.

## 🚧 Future Improvements

- 🌐 Web-based user interface
- 🗺️ Interactive maps and route planning
- 💵 Live travel price information
- 🏨 Real-time hotel and accommodation recommendations
- ✈️ Flight and train information
- 🌦️ Weather-based itinerary adjustments
- 📍 Location-based recommendations
- 💾 Persistent user trip history

## 👩‍💻 Author

**Upasana**

GitHub: [upasana-s7](https://github.com/upasana-s7)