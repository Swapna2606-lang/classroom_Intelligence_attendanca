# Classroom Intelligence Studio

A real-time, AI-powered classroom engagement analytics and teacher insights dashboard. 

This application simulates a cutting-edge classroom monitoring stack, replicating the behavior of local AI observers (like OpenCV face mapping), real-time data streaming to BigQuery, BigQuery ML predictive modeling, and generative AI pedagogical coaching into a single cohesive full-stack web application.

## Features

* **Real-time AI Observer (Simulated):** Uses your device's webcam to track facial framing locally, assigning simulated engagement scores and streaming them to the server just like a python OpenCV observer.
* **Telemetry Event Dispatcher:** Manually trigger classroom events (focus high, flag confusion, raise hand, mark absent) to instantly populate the analytics dashboard.
* **BigQuery Dashboard Simulation:** View aggregated real-time statistics including attendance summaries, average engagement indices, and individual student status cards.
* **BigQuery ML Predictor:** A mathematical simulation of a BigQuery Logistic Regression model (`LOGISTIC_REG`) that forecasts student burnout risk based on engagement metrics and absent counts.
* **Gemini AI Classroom Coach:** Leverages the Gemini API to analyze current classroom statistics and generate context-aware, actionable pedagogical recommendations directly to the teacher. Includes a simulated fallback if API quota is exceeded or keys are unavailable.

## Tech Stack

* **Frontend:** React, TypeScript, Tailwind CSS, Vite, Lucide Icons, Framer Motion
* **Backend:** Node.js, Express
* **AI:** Google GenAI SDK (`@google/genai`) for Gemini 3.5 Flash

## Configuration

This project requires a Gemini API key for the AI Coaching feature to function with live data.

1. Obtain a Gemini API key from Google AI Studio.
2. In the AI Studio platform, configure your `GEMINI_API_KEY` via the Secrets/Environment Variables panel. 
   *(Alternatively, if running locally, create a `.env` file with `GEMINI_API_KEY=your_key_here`)*

If the API key is missing or quota is exceeded, the application gracefully degrades to using built-in, high-quality simulated recommendations.

## Running the Application

This is a full-stack application. `npm run dev` in this environment uses `tsx` to run the backend `server.ts` file, which maps Vite middleware to serve the React frontend alongside the Express API routes.

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Build for production
npm run build

# Start the production server
npm run start
```

## Architecture Notes

* Both frontend and backend logic coexist in this single deployment.
* The frontend accesses standard REST endpoints (`/api/stream-event`, `/api/classroom-analytics`, etc.) served by `server.ts`.
* The simulated database is held in memory by the Express process. Modifying server code will reset the event database.
