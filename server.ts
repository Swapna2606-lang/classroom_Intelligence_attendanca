import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Standard classroom structure setup matching user's BigQuery parameters
const PROJECT_ID = "project-7457295e-3d0e-487f-b2a";
const DATASET_ID = "classroom_analytics";
const TABLE_ID = `${PROJECT_ID}.${DATASET_ID}.engagement_events`;
const ACTIVE_SESSION_ID = 5001;

// Seed active student roster
const STUDENTS = [
  { student_id: 101, name: "Swapna Rowdy", avatar_color: "from-rose-500 to-pink-500", expected_present: true },
  { student_id: 102, name: "Alex Mercer", avatar_color: "from-blue-500 to-indigo-500", expected_present: true },
  { student_id: 103, name: "Sarah Jenkins", avatar_color: "from-emerald-500 to-teal-500", expected_present: true },
  { student_id: 104, name: "David Chen", avatar_color: "from-amber-500 to-orange-500", expected_present: true },
  { student_id: 105, name: "Layla Al-Jamil", avatar_color: "from-violet-500 to-purple-500", expected_present: true },
  { student_id: 106, name: "Marcus Thompson", avatar_color: "from-cyan-500 to-blue-500", expected_present: false }
];

// In-Memory BigQuery database of events
let inMemoryEvents: any[] = [];

// Seed historical events of the past 30 minutes to make the dashboard look active right immediately
function seedDatabase() {
  const now = new Date();
  
  // Create simulated history
  STUDENTS.forEach((student) => {
    if (!student.expected_present) return;
    
    const baseScore = student.student_id === 101 ? 0.94 : 0.82;
    
    // Create 8 staggered history points for each present student
    for (let i = 8; i >= 1; i--) {
      const historicalTime = new Date(now.getTime() - i * 3 * 60 * 1000);
      const randomVariance = (Math.random() - 0.5) * 0.15;
      const score = Math.max(0.2, Math.min(1.0, baseScore + randomVariance));
      
      let event_type = "ATTENTION_NORMAL";
      if (score > 0.88) event_type = "ATTENTION_HIGH";
      else if (score < 0.45) event_type = "STUDENT_AWAY";
      
      inMemoryEvents.push({
        event_id: `seed-${student.student_id}-${i}`,
        session_id: ACTIVE_SESSION_ID,
        student_id: student.student_id,
        event_type: event_type,
        score: score,
        attention_level: score,
        timestamp: historicalTime.toISOString()
      });
    }
  });

  // Add some specific interactive events for fun (hands raised, confusion flags)
  inMemoryEvents.push({
    event_id: "seed-hand-1",
    session_id: ACTIVE_SESSION_ID,
    student_id: 101, // Swapna
    event_type: "hand_raised",
    score: 1.0,
    attention_level: 0.95,
    timestamp: new Date(now.getTime() - 12 * 60 * 1000).toISOString()
  });

  inMemoryEvents.push({
    event_id: "seed-hand-2",
    session_id: ACTIVE_SESSION_ID,
    student_id: 103, // Sarah
    event_type: "hand_raised",
    score: 1.0,
    attention_level: 0.92,
    timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  });

  inMemoryEvents.push({
    event_id: "seed-conf-1",
    session_id: ACTIVE_SESSION_ID,
    student_id: 104, // David Chen
    event_type: "confusion_detected",
    score: 0.35,
    attention_level: 0.40,
    timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString()
  });
}

seedDatabase();

// Lazy initialize Gemini API Client safely to prevent start-up crashes when key is absent
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY || "";
    if (!key || key === "MY_GEMINI_API_KEY") {
      console.log("No valid GEMINI_API_KEY found, running AI classroom suggestions with localized models.");
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Cross-origin and endpoint mirroring so that direct local python stream script running works flawlessly
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Replicate FastAPI /health route to verify BigQuery integration easily
  app.get("/health", (req, res) => {
    res.json({ status: "online", bigquery_target: TABLE_ID });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "online", bigquery_target: TABLE_ID });
  });

  // Replicate `/stream-event` mapping exactly so either /stream-event or /api/stream-event resolves
  const handleStreamEvent = (req: express.Request, res: express.Response) => {
    const { student_id, session_id, event_type, score } = req.body;

    if (!student_id || !session_id || !event_type) {
      res.status(400).json({ status: "error", message: "Missing required fields student_id, session_id, or event_type" });
      return;
    }

    const newEvent = {
      event_id: Math.random().toString(36).substring(2, 11),
      student_id: parseInt(student_id),
      session_id: parseInt(session_id),
      event_type: event_type,
      score: score !== undefined ? parseFloat(score) : 0.85,
      attention_level: score !== undefined ? parseFloat(score) : 0.85,
      timestamp: new Date().toISOString()
    };

    inMemoryEvents.push(newEvent);
    
    // Prune in-memory state if growing too massive
    if (inMemoryEvents.length > 1000) {
      inMemoryEvents.shift();
    }

    res.json({ status: "success", data_sent: event_type });
  };

  app.post("/stream-event", handleStreamEvent);
  app.post("/api/stream-event", handleStreamEvent);

  // Add new student
  app.post("/api/add-student", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ status: "error", message: "Missing student name" });
    
    const newId = Math.max(...STUDENTS.map(s => s.student_id)) + 1;
    const colors = ["from-rose-500 to-pink-500", "from-blue-500 to-indigo-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500", "from-violet-500 to-purple-500", "from-cyan-500 to-blue-500"];
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];
    
    const newStudent = {
      student_id: newId,
      name,
      avatar_color,
      expected_present: true
    };
    
    STUDENTS.push(newStudent);
    res.json({ status: "success", data: newStudent });
  });

  // Face Enrollment
  app.post("/api/enroll-face", (req, res) => {
    const { student_id, image_base64 } = req.body;
    if (!student_id || !image_base64) {
       return res.status(400).json({ status: "error", message: "Missing student_id or image" });
    }
    const student = STUDENTS.find(s => s.student_id === parseInt(student_id));
    if (!student) return res.status(404).json({ status: "error", message: "Student not found" });

    (student as any).reference_image = image_base64;
    res.json({ status: "success", message: "Face enrolled successfully" });
  });

  // Recognize Face & Stream Event
  app.post("/api/recognize-attendance", async (req, res) => {
    const { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ status: "error", message: "Missing image" });
    
    const enrolledStudents = STUDENTS.filter(s => (s as any).reference_image);
    if (enrolledStudents.length === 0) {
      return res.status(400).json({ status: "error", message: "No students have their faces enrolled yet. Please select a student and click 'Enroll Face' first." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({ status: "error", message: "Gemini API key not configured. Cannot perform facial recognition." });
    }

    try {
      const prompt = `
You are an AI classroom observer. 
Identify which enrolled student (if any) is present in the "Capture Frame".
Then analyze their engagement.
Output ONLY JSON matching this schema:
{
  "student_id": number | null,
  "event_type": "ATTENTION_HIGH" | "ATTENTION_NORMAL" | "STUDENT_AWAY" | "confusion_detected" | "hand_raised",
  "score": number, // 0.0 to 1.0 (1.0 is highly attentive)
  "emotion": string // (e.g. "Focused", "Bored", "Confused")
}
`;

      const contents = [
        {
          role: "user" as const,
          parts: [
            ...enrolledStudents.map(s => ({
               inlineData: { mimeType: "image/jpeg", data: (s as any).reference_image.split(',')[1] }
            })),
            { text: `The above are reference photos of enrolled students. IDs: ${enrolledStudents.map(s => s.student_id).join(', ')} in that exact order.` },
            { inlineData: { mimeType: "image/jpeg", data: image_base64.split(',')[1] } },
            { text: `The above is the current Capture Frame.` },
            { text: prompt }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text() || "";
      let result;
      try {
         result = JSON.parse(text);
      } catch(e) {
         return res.status(500).json({ status: "error", message: "Failed to parse AI response" });
      }

      if (!result.student_id || !enrolledStudents.find(s => s.student_id === result.student_id)) {
         return res.status(400).json({ status: "error", message: "No enrolled student recognized in the frame." });
      }

      // Stream the event
      const newEvent = {
        event_id: Math.random().toString(36).substring(2, 11),
        student_id: result.student_id,
        session_id: ACTIVE_SESSION_ID,
        event_type: result.event_type || "ATTENTION_NORMAL",
        score: result.score !== undefined ? result.score : 0.85,
        attention_level: result.score !== undefined ? result.score : 0.85,
        timestamp: new Date().toISOString()
      };

      inMemoryEvents.push(newEvent);

      return res.json({ status: "success", recognized: true, data: newEvent });

    } catch(err: any) {
      console.error("Facial recognition error:", err);
      return res.status(500).json({ status: "error", message: err.message || "Failed to process image" });
    }
  });

  // Clear in-memory event database to reset visualizer
  app.post("/api/clear-events", (req, res) => {
    inMemoryEvents = [];
    seedDatabase();
    res.json({ status: "success", message: "Events database reset to initial seeds" });
  });

  // Replicate BI Dashboard query aggregates representing teacher_dashboard_v1 & attendance_summary
  app.get("/api/classroom-analytics", (req, res) => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Filter events of the active session
    const activeEvents = inMemoryEvents.filter(e => e.session_id === ACTIVE_SESSION_ID);
    const recentEvents = activeEvents.filter(e => new Date(e.timestamp) >= thirtyMinutesAgo);

    // Replicate: standard teacher_dashboard_v1 view calculation
    const teacher_dashboard = STUDENTS.map(student => {
      const studentHistory = activeEvents.filter(e => e.student_id === student.student_id);
      const studentRecentHistory = recentEvents.filter(e => e.student_id === student.student_id);

      // Present status: has sent an event recently
      const hasEvents = studentHistory.length > 0;
      const lastEvent = hasEvents ? studentHistory[studentHistory.length - 1] : null;

      // Calculate rolling avg engagement
      const engagementEvents = studentHistory.filter(e => e.event_type !== "hand_raised" && e.event_type !== "confusion_detected");
      const avgScoreRaw = engagementEvents.length > 0 
        ? engagementEvents.reduce((acc, e) => acc + e.score, 0) / engagementEvents.length 
        : 0;

      const current_engagement = Math.round(avgScoreRaw * 100);

      // Count hands raised
      const hands_raised = studentHistory.filter(e => e.event_type === "hand_raised").length;

      // Average attention level (from simulated attention values)
      const avg_attention = engagementEvents.length > 0
        ? engagementEvents.reduce((acc, e) => acc + (e.attention_level || e.score), 0) / engagementEvents.length
        : 0;

      // Status alert check: if countific "confusion_detected" in studentRecentHistory > 2, alert "HIGH CONFUSION"
      const confusionCount = studentRecentHistory.filter(e => e.event_type === "confusion_detected").length;
      let status_alert: "HIGH CONFUSION" | "STABLE" | "AWAY" = "STABLE";
      
      if (lastEvent && lastEvent.event_type === "STUDENT_AWAY") {
        status_alert = "AWAY";
      } else if (confusionCount >= 2) {
        status_alert = "HIGH CONFUSION";
      }

      // Latest detected emotion/type
      let current_emotion = "Focused";
      if (lastEvent) {
        if (lastEvent.event_type === "STUDENT_AWAY") current_emotion = "Absent";
        else if (lastEvent.event_type === "confusion_detected") current_emotion = "Confused";
        else if (lastEvent.event_type === "hand_raised") current_emotion = "Participating";
        else if (lastEvent.score > 0.9) current_emotion = "Highly Engaged";
      }

      return {
        student_id: student.student_id,
        student_name: student.name,
        session_id: ACTIVE_SESSION_ID,
        current_engagement,
        hands_raised,
        avg_attention: parseFloat(avg_attention.toFixed(2)),
        status_alert,
        last_active_time: lastEvent ? lastEvent.timestamp : new Date().toISOString(),
        current_emotion
      };
    });

    // Replicate: attendance_summary automated view calculations
    // roster is of active expected students vs actually present (sent an event)
    const expectedStudents = STUDENTS.filter(s => s.expected_present);
    const presentCount = expectedStudents.filter(student => 
      activeEvents.some(e => e.student_id === student.student_id && e.event_type !== "STUDENT_AWAY")
    ).length;

    const attendance_rate = expectedStudents.length > 0 
      ? Math.round((presentCount / expectedStudents.length) * 10000) / 100 
      : 0;

    // Replicate: AI Lesson/Course scoring logic (aggregate session scores)
    const classEngagementEvents = activeEvents.filter(e => e.event_type !== "hand_raised" && e.event_type !== "confusion_detected");
    const lesson_engagement_score = classEngagementEvents.length > 0
      ? classEngagementEvents.reduce((acc, e) => acc + e.score, 0) / classEngagementEvents.length
      : 0.75; // Default healthy baseline
      
    const lesson_attention_score = classEngagementEvents.length > 0
      ? classEngagementEvents.reduce((acc, e) => acc + (e.attention_level || e.score), 0) / classEngagementEvents.length
      : 0.78;

    let teaching_effectiveness_rating: "Highly Effective" | "Effective" | "Needs Adjustment" = "Effective";
    if (lesson_engagement_score > 0.8) {
      teaching_effectiveness_rating = "Highly Effective";
    } else if (lesson_engagement_score < 0.5) {
      teaching_effectiveness_rating = "Needs Adjustment";
    }

    res.json({
      project_id: PROJECT_ID,
      dataset_id: DATASET_ID,
      table_id: TABLE_ID,
      active_session_id: ACTIVE_SESSION_ID,
      roster: STUDENTS,
      current_events: activeEvents.slice(-40), // Return last 40 active events
      teacher_dashboard,
      attendance: {
        course_name: "Design & ML Analytics 301",
        start_time: new Date().toISOString(), // Replaces BQ timestamps
        total_roster: expectedStudents.length,
        students_present: presentCount,
        attendance_rate
      },
      lesson_rating: {
        lesson_engagement_score: parseFloat(lesson_engagement_score.toFixed(2)),
        lesson_attention_score: parseFloat(lesson_attention_score.toFixed(2)),
        teaching_effectiveness_rating
      }
    });
  });

  // Replicate BigQuery ML Burnout Predictive logistic models via deterministic logit function
  app.post("/api/ml-predict", (req, res) => {
    const { avg_engagement, away_count } = req.body;

    const engagementVal = parseFloat(avg_engagement !== undefined ? avg_engagement : "0.5");
    const awayVal = parseInt(away_count !== undefined ? away_count : "0");

    // Logistic regression math representation
    // ln(p / 1-p) = intercept + beta1 * (engagement_offset) + beta2 * (away_count)
    // Beta weights learned from relationship of Student Away and low rolling engagement:
    const intercept = -1.8;
    const beta_engagement = 5.2 * (0.50 - engagementVal); // Negative correlation: lower engagement increases log-odds
    const beta_away = 0.45 * awayVal; // Positive correlation: higher away count increases log-odds
    
    const logOdds = intercept + beta_engagement + beta_away;
    const probability = 1.0 / (1.0 + Math.exp(-logOdds));

    // Decision boundary at 0.5
    const is_burnt_out = probability >= 0.5;

    res.json({
      avg_engagement: engagementVal,
      away_count: awayVal,
      is_burnt_out,
      probability: parseFloat(probability.toFixed(3))
    });
  });

  // Real-time AI Teaching Coach utilizing the Gemini SDK
  app.post("/api/classroom-coach", async (req, res) => {
    const { schemaSnapshot } = req.body;

    const gemini = getGeminiClient();

    if (!gemini) {
      // High-fidelity fallback simulated intelligence response if Gemini API key isn't provided
      const defaultRecommendations = [
        {
          summary: "Check in with Student 104 (David Chen)",
          details: [
            "Lay down an active learning prompt to resolve a moderate lag in engagement.",
            "David was flagged with temporary confusion 2 minutes ago. Take a 60-second break to explain the current BigQuery schema constraints."
          ],
          suggested_action: "Pose the question: 'Who can tell me the main difference between static tables and views?'",
          priority: "high",
          tag: "Confusion Resolving"
        },
        {
          summary: "Trigger a live active interaction",
          details: [
            "Class attention currently sits at 78%. Raising verbal interaction helps boost passive listeners.",
            "Ask students to click the hand-raise button to answer a quick interactive check-in."
          ],
          suggested_action: "Initiate 'Virtual High Five' participation round.",
          priority: "medium",
          tag: "Attention Boost"
        },
        {
          summary: "Review burnout risk vectors",
          details: [
            "Your simulated logistics model is showing steady trends. Use BigQuery ML to evaluate trend forecasting during your next lesson interval."
          ],
          suggested_action: "Conduct standard 5-minute team check-in.",
          priority: "low",
          tag: "Burnout Prevention"
        }
      ];
      
      res.json({
        recommendations: defaultRecommendations,
        using_fallback: true
      });
      return;
    }

    try {
      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
          You are the AI Classroom Intelligence Coach for a teacher's analytics platform.
          Analyze the following real-time classroom statistics and generate exactly 3 smart, actionable and pedagogically helpful recommendations to display on the teacher's dashboard.

          Classroom Snapshot:
          - Course: "Design & ML Analytics 301"
          - Global Effectiveness Rating: ${schemaSnapshot.lesson_rating?.teaching_effectiveness_rating || "Effective"}
          - Class Engagement Score: ${Math.round((schemaSnapshot.lesson_rating?.lesson_engagement_score || 0.75) * 100)}%
          - Active Alerts: ${JSON.stringify(schemaSnapshot.teacher_dashboard?.map((t: any) => ({ name: t.student_name, alert: t.status_alert, emotion: t.current_emotion, engagement: t.current_engagement })) || [])}

          Generate a JSON object corresponding to this format:
          {
            "recommendations": [
              {
                "summary": "Short, punchy instruction headline including student names if high-priority (max 8 words)",
                "details": [
                  "1-2 concise, expert sentences explaining why this advice helps in this state based on the provided student alerts."
                ],
                "suggested_action": "An exact quote or action the teacher should announce verbally to the classroom right now to boost engagement",
                "priority": "high" | "medium" | "low",
                "tag": "e.g., Attention Boost, Confusion Resolving, Burnout Prevention"
              }
            ]
          }

          Respond with raw JSON strictly following this schema. Do not add markdown wrappers around the JSON.
        `,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "";
      const resultObj = JSON.parse(responseText.trim());
      res.json({
        recommendations: resultObj.recommendations || [],
        using_fallback: false
      });
    } catch (e: any) {
      const errMsg = e?.message || "";
      const isQuota = errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("429") || errMsg.toLowerCase().includes("exhausted");

      if (!isQuota) {
        console.error("Gemini context recommendation failed:", e);
      } else {
        console.log("Gemini quota exceeded. Seamlessly falling back to simulated logic.");
      }
      
      const defaultRecommendations = [
        {
          summary: "Check in with Student 104 (David Chen)",
          details: [
            "Lay down an active learning prompt to resolve a moderate lag in engagement.",
            "David was flagged with temporary confusion 2 minutes ago. Take a 60-second break to explain the current BigQuery schema constraints."
          ],
          suggested_action: "Pose the question: 'Who can tell me the main difference between static tables and views?'",
          priority: "high",
          tag: "Confusion Resolving"
        },
        {
          summary: "Trigger a live active interaction",
          details: [
            "Class attention currently sits at 78%. Raising verbal interaction helps boost passive listeners.",
            "Ask students to click the hand-raise button to answer a quick interactive check-in."
          ],
          suggested_action: "Initiate 'Virtual High Five' participation round.",
          priority: "medium",
          tag: "Attention Boost"
        },
        {
          summary: "Review burnout risk vectors",
          details: [
            "Your simulated logistics model is showing steady trends. Use BigQuery ML to evaluate trend forecasting during your next lesson interval."
          ],
          suggested_action: "Conduct standard 5-minute team check-in.",
          priority: "low",
          tag: "Burnout Prevention"
        }
      ];

      res.status(200).json({
        recommendations: defaultRecommendations,
        using_fallback: true,
        quota_exceeded: isQuota,
        api_error_message: errMsg
      });
    }
  });

  // Vite development middleware vs Static serve
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Classroom Intelligence full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
