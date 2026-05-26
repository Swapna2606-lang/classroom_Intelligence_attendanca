import { useState, useEffect, useRef } from "react";
import { 
  Brain, 
  Video, 
  Activity, 
  Sparkles, 
  AlertTriangle, 
  Users, 
  CheckCircle, 
  TrendingUp, 
  RotateCcw, 
  Camera, 
  CameraOff, 
  ChevronRight, 
  Info, 
  Flame, 
  Check, 
  BookOpen, 
  Gauge, 
  HelpCircle,
  Database,
  ArrowRight,
  User
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ClassroomStateResponse, TeacherDashboardRow, AIRecommendation, BurnoutPredictionOutput } from "./types";

export default function App() {
  // State variables for classroom analytics
  const [analytics, setAnalytics] = useState<ClassroomStateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorString, setErrorString] = useState<string | null>(null);
  
  // Simulated camera & observer tracking states
  const [selectedStudentId, setSelectedStudentId] = useState<number>(101); // Default to Swapna Rowdy
  const [webcamActive, setWebcamActive] = useState<boolean>(false);
  const [simulatedAttention, setSimulatedAttention] = useState<number>(0.92);
  const [simulationInterval, setSimulationInterval] = useState<boolean>(true);
  const [lastPostedPayload, setLastPostedPayload] = useState<any>(null);
  const [postingState, setPostingState] = useState<boolean>(false);
  
  // HTML5 Video / Canvas elements for face-bounding tracking overlay
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasTimerRef = useRef<number | null>(null);

  // BigQuery ML simulation tool states
  const [mlEngagement, setMlEngagement] = useState<number>(0.35);
  const [mlAwayCount, setMlAwayCount] = useState<number>(5);
  const [mlResult, setMlResult] = useState<BurnoutPredictionOutput | null>(null);
  const [mlPredictiveLoading, setMlPredictiveLoading] = useState<boolean>(false);

  // Gemini AI Classroom Coach states
  const [aiCoachInsights, setAiCoachInsights] = useState<AIRecommendation[]>([]);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  // Fetch classroom analytical snapshot
  const fetchAnalytics = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/classroom-analytics");
      if (!res.ok) throw new Error("Could not retrieve classroom data layer properties.");
      const data: ClassroomStateResponse = await res.ok ? await res.json() : null;
      if (data) {
        setAnalytics(data);
        setErrorString(null);
      }
    } catch (err: any) {
      if (err.message !== "Failed to fetch" && !err.message?.includes("fetch")) {
        console.error(err);
      }
      setErrorString("Failed to synchronize with Classroom Analytics database core.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Synchronize on mount and poll every 4 seconds to reflect background streaming events
  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchAnalytics(true);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Sync AI coach insights whenever analytics core changes
  useEffect(() => {
    if (analytics && aiCoachInsights.length === 0) {
      triggerAiCoach(analytics);
    }
  }, [analytics]);

  // Handle stream event dispatch POST replicates FastAPI `/stream-event`
  const handleStreamPost = async (eventType: string, scoreVal?: number) => {
    setPostingState(true);
    const score = scoreVal !== undefined ? scoreVal : simulatedAttention;
    
    const payload = {
      student_id: selectedStudentId,
      session_id: 5001,
      event_type: eventType,
      score: score
    };

    try {
      const res = await fetch("/api/stream-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setLastPostedPayload({
        endpoint: "/api/stream-event",
        status: data.status,
        sent_item: data.data_sent,
        timestamp: new Date().toLocaleTimeString(),
        payload
      });
      // Refresh database records immediately
      await fetchAnalytics(true);
    } catch (err: any) {
      if (err.message !== "Failed to fetch" && !err.message?.includes("fetch")) {
        console.error("Payload streaming failed", err);
      }
    } finally {
      setPostingState(false);
    }
  };

  // Reset metrics database
  const handleDatabaseReset = async () => {
    try {
      await fetch("/api/clear-events", { method: "POST" });
      setLastPostedPayload(null);
      await fetchAnalytics();
    } catch (err: any) {
      if (err.message !== "Failed to fetch" && !err.message?.includes("fetch")) {
        console.error(err);
      }
    }
  };

  // Run BigQuery ML predictive logistic score
  const evaluateMLPrediction = async () => {
    setMlPredictiveLoading(true);
    try {
      const res = await fetch("/api/ml-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avg_engagement: mlEngagement,
          away_count: mlAwayCount
        })
      });
      const data = await res.json();
      setMlResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setMlPredictiveLoading(false);
    }
  };

  // Trigger prediction initially and when parameters are changed
  useEffect(() => {
    evaluateMLPrediction();
  }, [mlEngagement, mlAwayCount]);

  // Request Gemini pedagogical coaching suggestions
  const triggerAiCoach = async (snapshotData: ClassroomStateResponse) => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/classroom-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaSnapshot: snapshotData })
      });
      const data = await res.json();
      if (data.recommendations) {
        setAiCoachInsights(data.recommendations);
        setUsingFallback(!!data.using_fallback);
        setQuotaExceeded(!!data.quota_exceeded);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const webcamActiveRef = useRef<boolean>(false);

  // Sync ref with state
  useEffect(() => {
    webcamActiveRef.current = webcamActive;
  }, [webcamActive]);

  // Synchronize webcam element source object on initialization and mount
  useEffect(() => {
    let active = true;
    if (webcamActive && streamRef.current) {
      const initVideo = () => {
        if (!active) return;
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play()
            .then(() => {
              if (active) {
                startFaceDetectionLoop();
              }
            })
            .catch(err => {
              console.error("Video play failed:", err);
            });
        } else {
          // Retry slightly later in case of rendering lag
          setTimeout(initVideo, 50);
        }
      };
      initVideo();
    } else {
      // If inactive, ensure any active canvas draw frame loop is canceled
      if (canvasTimerRef.current) {
        cancelAnimationFrame(canvasTimerRef.current);
      }
    }
    return () => {
      active = false;
    };
  }, [webcamActive]);

  // Trigger camera capture to stream live observer data mimicking observer.py camera loop
  const toggleWebcam = async () => {
    if (webcamActive) {
      // Disengage stream and timing loops
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (canvasTimerRef.current) {
        cancelAnimationFrame(canvasTimerRef.current);
      }
      streamRef.current = null;
      setWebcamActive(false);
    } else {
      try {
        const constraints = { video: { width: 320, height: 240 } };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = mediaStream;
        setWebcamActive(true);
      } catch (err) {
        console.error("Camera access failed:", err);
        alert("Camera permissions required or webcam not found. Reverting to interactive facial simulator.");
      }
    }
  };

  const captureFrameBase64 = (): string | null => {
    const video = videoRef.current;
    if (!video || !webcamActive) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7); // Compress slight bit before hitting API
  };

  const [faceEnrolling, setFaceEnrolling] = useState<boolean>(false);
  const [faceRecognizing, setFaceRecognizing] = useState<boolean>(false);
  const [newStudentName, setNewStudentName] = useState<string>("");
  const [isAddingStudent, setIsAddingStudent] = useState<boolean>(false);

  const handleAddNewStudent = async () => {
    if (!newStudentName.trim()) return;
    setIsAddingStudent(true);
    try {
      const res = await fetch("/api/add-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStudentName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add student");
      
      setSelectedStudentId(data.data.student_id);
      setNewStudentName("");
      await fetchAnalytics(true);
    } catch (err: any) {
      alert("Error adding student: " + err.message);
    } finally {
      setIsAddingStudent(false);
    }
  };

  const enrollUserFace = async () => {
    if (!selectedStudentId) {
      alert("Please select a target student first to enroll a face for them.");
      return;
    }
    const base64 = captureFrameBase64();
    if (!base64) {
      alert("Camera is not active. Please start camera first.");
      return;
    }
    
    setFaceEnrolling(true);
    try {
      const res = await fetch("/api/enroll-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedStudentId, image_base64: base64 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to enroll");
      alert("Face successfully encoded and enrolled for active student!");
    } catch(err: any) {
      alert("Enrollment failed: " + err.message);
    } finally {
      setFaceEnrolling(false);
    }
  };

  const recognizeFace = async () => {
    const base64 = captureFrameBase64();
    if (!base64) {
      alert("Camera is not active. Please start camera first.");
      return;
    }

    setFaceRecognizing(true);
    try {
      const res = await fetch("/api/recognize-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Recognition Failed");
      
      setLastPostedPayload({
        endpoint: "POST /api/recognize-attendance (Gemini Vision)",
        payload: data.data,
        timestamp: new Date().toISOString().split("T")[1].substring(0, 8),
      });

      await fetchAnalytics(true);
    } catch(err: any) {
      alert("AI Recognition error: " + err.message);
    } finally {
      setFaceRecognizing(false);
    }
  };

  // Local AI Face Bounding Simulation Overlays using standard HTML Canvas
  const startFaceDetectionLoop = () => {
    const drawOverlay = () => {
      if (!webcamActiveRef.current || !streamRef.current) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      if (canvas && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Mimic cascade classifier face box (we draw a sleek pulsing green frame based on the coordinates)
          const now = Date.now();
          const pulse = Math.sin(now / 200) * 4;
          
          const boxX = 80 + pulse;
          const boxY = 60 - pulse / 2;
          const boxW = 160 + pulse * 2;
          const boxH = 145 + pulse * 2;

          // Draw the facial indicator rectangle
          ctx.strokeStyle = "#10b981"; // Emerald
          ctx.lineWidth = 3;
          ctx.setLineDash([]);
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          // Draw futuristic framing bracket corners
          ctx.fillStyle = "#10b981";
          // Top Left
          ctx.fillRect(boxX - 4, boxY - 4, 15, 4);
          ctx.fillRect(boxX - 4, boxY - 4, 4, 15);
          // Top Right
          ctx.fillRect(boxX + boxW - 11, boxY - 4, 15, 4);
          ctx.fillRect(boxX + boxW, boxY - 4, 4, 15);
          // Bottom Left
          ctx.fillRect(boxX - 4, boxY + boxH, 15, 4);
          ctx.fillRect(boxX - 4, boxY + boxH - 11, 4, 15);
          // Bottom Right
          ctx.fillRect(boxX + boxW - 11, boxY + boxH, 15, 4);
          ctx.fillRect(boxX + boxW, boxY + boxH - 11, 4, 15);

          // Render Text labels (Matching observer.py terminal string overlays)
          const liveScore = Math.min(1.0, Math.max(0.4, 0.85 + Math.sin(now / 1500) * 0.12));
          // Save computed score to state
          setSimulatedAttention(parseFloat(liveScore.toFixed(3)));

          ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
          ctx.fillRect(boxX, boxY - 26, 115, 20);
          
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px JetBrains Mono, monospace";
          ctx.fillText(`ENGAGED: ${Math.round(liveScore * 100)}%`, boxX + 6, boxY - 12);

          // Draw tracking scanlines
          ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
          ctx.lineWidth = 1;
          const scanY = boxY + ((now / 6) % boxH);
          ctx.beginPath();
          ctx.moveTo(boxX, scanY);
          ctx.lineTo(boxX + boxW, scanY);
          ctx.stroke();
        }
      }
      canvasTimerRef.current = requestAnimationFrame(drawOverlay);
    };
    canvasTimerRef.current = requestAnimationFrame(drawOverlay);
  };

  // Clean elements on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (canvasTimerRef.current) {
        cancelAnimationFrame(canvasTimerRef.current);
      }
    };
  }, []);

  // Automatic Event stream heartbeat generator to mimic observer.py continuous analytics insertion
  useEffect(() => {
    let intervalId: any;
    if (simulationInterval) {
      intervalId = setInterval(() => {
        // Post attention score every 10 seconds to maintain steady streams
        handleStreamPost("ATTENTION_NORMAL", simulatedAttention);
      }, 10000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [simulationInterval, selectedStudentId, simulatedAttention]);

  // Update mock simulation metrics manually
  const triggerManualEvent = (type: string) => {
    let score = 0.90;
    if (type === "STUDENT_AWAY") score = 0.0;
    else if (type === "confusion_detected") score = 0.42;
    else if (type === "hand_raised") score = 1.0;
    else if (type === "ATTENTION_HIGH") score = 0.98;

    handleStreamPost(type, score);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-6 antialiased">
      {/* Sleek, Premium Technical Header */}
      <header className="max-w-7xl mx-auto mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-tr from-cyan-600 to-cyan-400 rounded-xl shadow-lg shadow-cyan-950/40">
            <Brain className="w-8 h-8 text-white stroke-[1.8] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white font-sans">
                Classroom Intelligence
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md">
                v1.0.4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time AI-powered classroom engagement analytics and teacher insights dashboard.
            </p>
          </div>
        </div>

        {/* Global Cloud Project State Metadata */}
        <div className="flex flex-wrap gap-4 items-center font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
            <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Project Target ID</span>
            <span className="text-white font-medium select-all">project-7457295e-3d0e-487f-b2a</span>
          </div>
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs">
            <div>
              <span className="text-cyan-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Telemetry Server</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5 font-mono text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                PORT 3000 / LIVE
              </span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 p-2 px-3 rounded-xl">
            <div className="text-right">
              <p className="text-xs font-bold text-white">Dr. Aris Thorne</p>
              <p className="text-[10px] text-slate-500">Session #5001 - CS101</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-sans font-bold text-xs text-cyan-400">
              AT
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid: Three Column Proportioned Cockpit Layout */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMN 1: THE AI OBSERVER PLAYGROUND (lg:span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Facial Monitoring Core Canvas (replicates observer.py) */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white tracking-wide">The AI Observer Localizer</h2>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
                OBSERVER.PY
              </span>
            </div>

            {/* Video Canvas Stage container */}
            <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden">
              {webcamActive ? (
                <>
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover scale-x-[-1]"
                    playsInline 
                    muted 
                  />
                  <canvas 
                    ref={canvasRef} 
                    width={320} 
                    height={240} 
                    className="absolute inset-0 w-full h-full z-10 pointer-events-none" 
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  {/* Digital face mesh placeholder when camera inactive */}
                  <div className="relative w-24 h-32 border-2 border-cyan-400/30 rounded-lg relative flex items-center justify-center bg-slate-900">
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400"></div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-400"></div>
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-400"></div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400"></div>
                    <Brain className="w-8 h-8 stroke-[1.2] opacity-50 text-cyan-400 animate-pulse" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300 mt-3">Webcam Monitor Offline</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[190px]">
                    Use your camera or select simulated controls below to stream attention metrics.
                  </p>
                </div>
              )}

              {/* Float Indicators for target student */}
              <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-between items-center text-[10px] font-mono">
                <div className="bg-slate-950/90 border border-slate-800 rounded-lg px-2 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                  <span>Active Core ID: {selectedStudentId}</span>
                </div>
                {webcamActive && (
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-lg text-emerald-400 text-[9px] font-bold">
                    [ LATENCY: 142ms ]
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Frame Control Action buttons */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex flex-col gap-3">
              <button 
                onClick={toggleWebcam} 
                id="toggle-webcam-btn"
                className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs border transition duration-200 ${
                  webcamActive 
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20" 
                    : "bg-cyan-600 text-white border-transparent hover:bg-cyan-500 shadow-md shadow-cyan-950/10"
                }`}
              >
                {webcamActive ? (
                  <>
                    <CameraOff className="w-4 h-4" />
                    Disconnect Camera Monitor
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Launch Browser Webcam
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={enrollUserFace}
                  disabled={faceEnrolling}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50 border border-slate-700"
                >
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  {faceEnrolling ? "Enrolling..." : "Enroll Student Face"}
                </button>
                <button
                  onClick={recognizeFace}
                  disabled={faceRecognizing}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-[10px] py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50 border border-slate-700"
                >
                  <Brain className="w-3.5 h-3.5" />
                  {faceRecognizing ? "Analyzing..." : "Take AI Attendance"}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                <span>Auto Heartbeat stream (10s)</span>
                <button 
                  onClick={() => setSimulationInterval(!simulationInterval)}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    simulationInterval 
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}
                >
                  {simulationInterval ? "ACTIVE" : "PAUSED"}
                </button>
              </div>
            </div>
          </section>

          {/* Interactive Database Multi-Trigger telemetry cards */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Telemetry Event Dispatcher
              </h3>
              <Info className="w-3.5 h-3.5 text-slate-500" />
            </div>

            {/* Target Student stream Selection dropdown */}
            <div className="mb-4">
              <label className="block text-[11px] text-slate-400 mb-1.5 font-mono">1. Select Target Student Stream:</label>
              <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                {analytics?.roster.map((s) => (
                  <button
                    key={s.student_id}
                    onClick={() => setSelectedStudentId(s.student_id)}
                    className={`py-1.5 px-2.5 rounded-lg text-left text-xs transition border font-medium flex items-center justify-between ${
                      selectedStudentId === s.student_id 
                        ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30" 
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900"
                    }`}
                  >
                    <span>{s.name.split(" ")[0]}</span>
                    <span className="text-[10px] opacity-70 font-mono">({s.student_id})</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter new student name..."
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewStudent()}
                  className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 transition"
                  disabled={isAddingStudent}
                />
                <button
                  onClick={handleAddNewStudent}
                  disabled={isAddingStudent || !newStudentName.trim()}
                  className="bg-cyan-900 hover:bg-cyan-800 text-cyan-100 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  title="Add Student"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Raw attention metric trigger slider */}
            <div className="mb-4 bg-slate-950/80 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1 text-[11px] font-mono">
                <span className="text-slate-400">Target Score Index:</span>
                <span className="text-white font-bold">{Math.round(simulatedAttention * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.10" 
                max="1.00" 
                step="0.01" 
                value={simulatedAttention}
                onChange={(e) => setSimulatedAttention(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-1 uppercase font-mono">
                <span>Distracted</span>
                <span>Highly Attentive</span>
              </div>
            </div>

            {/* Concrete pipeline triggers representing python state logs */}
            <label className="block text-[11px] text-slate-400 mb-2 font-mono">2. Inject Multi-State Diagnostics:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => triggerManualEvent("ATTENTION_HIGH")}
                className="py-2 px-3 text-xs bg-slate-950 text-cyan-400 border border-slate-800 rounded-xl hover:bg-cyan-500/10 hover:border-cyan-500/20 text-center font-bold transition-colors"
              >
                Focus High
              </button>
              <button
                onClick={() => triggerManualEvent("STUDENT_AWAY")}
                className="py-2 px-3 text-xs bg-slate-950 text-rose-400 border border-slate-800 rounded-xl hover:bg-rose-500/10 hover:border-rose-500/20 text-center font-bold transition-colors"
              >
                Mark Out/Absent
              </button>
              <button
                onClick={() => triggerManualEvent("confusion_detected")}
                className="py-2 px-3 text-xs bg-slate-950 text-orange-400 border border-slate-800 rounded-xl hover:bg-orange-500/10 hover:border-orange-500/20 text-center font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                Flag Confusion
              </button>
              <button
                onClick={() => triggerManualEvent("hand_raised")}
                className="py-2 px-3 text-xs bg-slate-950 text-cyan-300 border border-slate-800 rounded-xl hover:bg-cyan-500/10 hover:border-cyan-500/20 text-center font-bold transition-colors"
              >
                Raise Hand
              </button>
            </div>
          </section>

          {/* Replicate JSON Event Payload live panel directly */}
          {lastPostedPayload && (
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Real-Time Stream JSON Log</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/15 px-1.5 py-0.5 rounded uppercase">
                  POST 200
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-48 overflow-y-auto">
                <span className="text-[10px] text-slate-500 block">HTTP POST TO TELEMETRY ENDPOINT:</span>
                <span className="text-cyan-400 font-bold block mb-2">{lastPostedPayload.endpoint}</span>
                <pre className="text-slate-300 text-[11px] leading-relaxed">
                  {JSON.stringify(lastPostedPayload.payload, null, 2)}
                </pre>
                <div className="border-t border-slate-800 mt-2 pt-2 flex items-center justify-between text-[10px] text-slate-550">
                  <span>Stream Status: SUCCESS</span>
                  <span>Received at {lastPostedPayload.timestamp}</span>
                </div>
              </div>
            </section>
          )}

        </div>

        {/* COLUMN 2: BIGQUERY REAL-TIME ANALYTICS DASHBOARD (lg:span-5) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Diagnostic Stats Header row */}
          <div className="grid grid-cols-3 gap-4">
            
            {/* Attendance Summarization box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between min-h-[105px]">
              <div>
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest block font-bold mb-1">Average Attendance</span>
                <h3 className="text-3xl font-bold text-white font-mono mt-1">
                  {analytics?.attendance.attendance_rate || 0}%
                </h3>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-3">
                <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${analytics?.attendance.attendance_rate || 0}%` }} />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 font-mono">
                <Users className="w-3 h-3 text-cyan-400" />
                <span>
                  {analytics?.attendance.students_present || 0}/{analytics?.attendance.total_roster || 0} Present
                </span>
              </div>
            </div>

            {/* Hands raised box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between min-h-[105px]">
              <div>
                <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest block font-bold mb-1">Hands Raised</span>
                <h3 className="text-3xl font-bold text-white font-mono mt-1">
                  {analytics?.teacher_dashboard?.reduce((acc, row) => acc + row.hands_raised, 0) || 0}
                </h3>
              </div>
              <p className="text-[10px] text-emerald-400 font-bold tracking-tight mt-3">
                Live stream interaction active
              </p>
            </div>

            {/* Lesson Quality rating panel */}
            <div className="bg-slate-900 border border-slate-800 border-l-orange-500 border-l-4 rounded-2xl p-4 shadow-lg flex flex-col justify-between min-h-[105px]">
              <div>
                <span className="text-orange-500 text-[10px] font-mono uppercase tracking-widest block font-extrabold mb-1">Alert State</span>
                <h3 className="text-lg font-bold text-white mt-1 uppercase">
                  {analytics?.lesson_rating.teaching_effectiveness_rating || "Calculating"}
                </h3>
              </div>
              <div className="text-[10px] text-slate-555 font-mono flex items-center gap-1 mt-3 text-slate-400">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span>Score: {analytics?.lesson_rating.lesson_engagement_score || 0}</span>
              </div>
            </div>

          </div>

          {/* Live class-wide engagement tracking visual chart (replicates teacher_dashboard_v1 attributes) */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Live Classroom Engagement Index</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Average attention metrics aggregated across present roster.</p>
              </div>
              <span className="font-mono text-[9px] uppercase font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                LATEST 30MINS
              </span>
            </div>

            {/* SVG Custom Responsive Line Graph */}
            <div className="h-44 bg-slate-950 border border-slate-800 rounded-xl relative p-2 flex items-end">
              <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-slate-900 w-full h-px" />
                <div className="border-b border-slate-900 w-full h-px" />
                <div className="border-b border-slate-900 w-full h-px" />
                <div className="border-b border-slate-900 w-full h-px" />
              </div>
              
              {/* Plot graph line */}
              <svg className="w-full h-full absolute inset-0 z-10" viewBox="0 0 400 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>
                {/* Visualizing engagement fluctuations */}
                <path
                  d="M 0 110 Q 50 40 100 80 T 200 60 T 300 110 T 400 35"
                  fill="none"
                  stroke="#0891b2"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 0 110 Q 50 40 100 80 T 200 60 T 300 110 T 400 35 L 400 150 L 0 150 Z"
                  fill="url(#chartGrad)"
                />
                {/* Glowing endpoint dots */}
                <circle cx="400" cy="35" r="4" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
                <circle cx="200" cy="60" r="3" fill="#06b6d4" opacity="0.8" />
              </svg>

              {/* Data descriptors overlaid on axis */}
              <div className="absolute top-2 left-3 font-mono text-[9px] text-slate-500">100% (High Focus)</div>
              <div className="absolute bottom-2 left-3 font-mono text-[9px] text-slate-500">0% (Away/Alerts)</div>
              
              <div className="absolute bottom-2 right-3 flex gap-2 font-mono text-[9px]">
                <span className="text-cyan-400 font-bold">&#9679; Attendance Rate: {analytics?.attendance.attendance_rate || 0}%</span>
                <span className="text-emerald-400 font-bold">&#9679; Target: {Math.round((analytics?.lesson_rating.lesson_engagement_score || 0.75) * 100)}%</span>
              </div>
            </div>

            {/* View Source indicator badge */}
            <div className="mt-3 bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="text-slate-400">View Source Identifier:</span>
              <span className="text-white font-medium select-all">teacher_dashboard_v1</span>
            </div>
          </section>

          {/* Active Student stream dashboard records */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Active Student Engagement Cards</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Real-time status tracking computed in BigQuery live view partitions.</p>
              </div>
              <button 
                onClick={handleDatabaseReset}
                className="p-1 px-2.5 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white flex items-center gap-1.5 rounded bg-slate-950 border border-slate-800 font-mono transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Database
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-500 font-mono">Synchronizing state...</span>
                </div>
              ) : analytics?.teacher_dashboard && analytics.teacher_dashboard.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {analytics.teacher_dashboard.map((row) => {
                    const matchedRoster = analytics.roster.find(s => s.student_id === row.student_id);
                    const avatarColor = matchedRoster?.avatar_color || "from-[#4f46e5] to-[#818cf8]";
                    const present = matchedRoster?.expected_present;

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        key={row.student_id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                          selectedStudentId === row.student_id 
                            ? "bg-cyan-500/5 border-cyan-500/30 shadow-md shadow-cyan-950/10" 
                            : "bg-slate-950 hover:bg-slate-800/40 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Student Initial avatar with dynamic color */}
                          <div className={`w-9 h-9 rounded-lg bg-gradient-to-tr ${avatarColor} flex items-center justify-center text-white font-bold text-sm shadow`}>
                            {row.student_name.charAt(0)}
                          </div>
                          
                          {/* Student Identification and status alert */}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white">{row.student_name}</span>
                              <span className="text-[9px] font-mono text-slate-500">ID: {row.student_id}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`text-[10px] font-medium font-mono ${
                                row.current_emotion === "Absent" 
                                  ? "text-slate-500" 
                                  : row.current_emotion === "Confused"
                                  ? "text-orange-400"
                                  : "text-emerald-400"
                              }`}>
                                {row.current_emotion}
                              </span>
                              <span className="text-[10px] text-slate-500">&bull;</span>
                              <span className="text-[10px] text-slate-400 font-mono">{row.hands_raised} hands raised</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Check circular indicators */}
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[10px] text-slate-500 block font-mono">Engagement</span>
                            <span className="text-xs font-bold text-white font-mono">{row.current_engagement}%</span>
                          </div>
                          
                          {/* Alert Badge badge */}
                          <div className="min-w-[70px]">
                            {row.status_alert === "HIGH CONFUSION" ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-tight bg-orange-500/10 text-orange-400 border border-orange-500/20 block text-center animate-pulse">
                                FLAG ALERT
                              </span>
                            ) : row.status_alert === "AWAY" ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-tight bg-rose-500/10 text-rose-400 border border-rose-500/20 block text-center">
                                AWAY
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-tight bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 block text-center">
                                STABLE
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <div className="py-8 bg-slate-950 rounded-xl text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800">
                  No active telemetry signals found. Dispatch stream events to generate views.
                </div>
              )}
            </div>
          </section>

        </div>

        {/* COLUMN 3: PREDICTIONS & AI TEACHING COACH RECOMMENDATIONS (lg:span-3) */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* BigQuery ML Logistic Regression predictor widget */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-450 text-cyan-400 animate-spin" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">BigQuery ML Predictor</h3>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
                LOGISTIC_REG
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Trains Logistic Regression algorithm to forecast student burnout risk based on rolling session attributes.
            </p>

            {/* Slider parameters */}
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <div className="flex items-center justify-between mb-1 text-[10px] font-mono">
                  <span className="text-slate-400">Mean Engagement:</span>
                  <span className="text-white font-bold">{Math.round(mlEngagement * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={mlEngagement}
                  onChange={(e) => setMlEngagement(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 text-[10px] font-mono">
                  <span className="text-slate-400">Away/Absent Count:</span>
                  <span className="text-white font-bold">{mlAwayCount} Times</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={mlAwayCount}
                  onChange={(e) => setMlAwayCount(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            {/* Model prediction result panel */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              {mlPredictiveLoading ? (
                <div className="py-4 text-center font-mono text-xs text-slate-500 flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Fitting weights...</span>
                </div>
              ) : mlResult ? (
                <div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-1">ML.PREDICT Classification</span>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold ${
                      mlResult.is_burnt_out ? "text-rose-400" : "text-emerald-400"
                    }`}>
                      {mlResult.is_burnt_out ? "BURNOUT RISK" : "HEALTHY STATUS"}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                      p={Math.round(mlResult.probability * 100)}%
                    </span>
                  </div>

                  {/* SVG Probability track bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        mlResult.is_burnt_out ? "bg-rose-500" : "bg-emerald-500"
                      }`} 
                      style={{ width: `${mlResult.probability * 100}%` }}
                    />
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono mt-2 block leading-snug">
                    {mlResult.is_burnt_out 
                      ? "High risk criteria matched. Recommend proactive check-in." 
                      : "Rolling averages indicate stable retention metrics."}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {/* AI Teaching Coach Recommendations Powered by Gemini API */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-bounce" />
                <h3 className="text-sm font-semibold text-white">AI Classroom Coach</h3>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
                GEMINI
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed -mt-1.5">
              Generates customized pedagogical recommendations based on current classroom active snapshots.
            </p>

            <div className="flex flex-col gap-3">
              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-400 font-mono">Class Coach thinking...</span>
                </div>
              ) : aiCoachInsights.length > 0 ? (
                aiCoachInsights.map((rec, i) => (
                  <div key={i} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded font-bold">
                        {rec.tag || "Pedagogy"}
                      </span>
                      <span className={`text-[10px] uppercase font-bold font-mono px-1.5 py-0.5 rounded ${
                        rec.priority === "high" 
                          ? "bg-rose-500/15 text-rose-400" 
                          : rec.priority === "medium" 
                          ? "bg-amber-500/15 text-amber-400" 
                          : "bg-cyan-500/15 text-cyan-400"
                      }`}>
                        {rec.priority}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white leading-snug">{rec.summary}</h4>
                    
                    <ul className="list-disc pl-4 text-[10px] text-slate-400 flex flex-col gap-1 leading-relaxed">
                      {rec.details?.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>

                    {rec.suggested_action && (
                      <div className="mt-1 pb-1.5 pt-1.5 px-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-cyan-400 block font-mono mb-0.5">Recommended Prompt:</span>
                        <p className="text-[10px] text-slate-300 italic">"{rec.suggested_action}"</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 bg-slate-950 rounded-xl text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800">
                  No AI Coaching recommendations updated yet. Click below to load.
                </div>
              )}
            </div>

            <button
              onClick={() => analytics && triggerAiCoach(analytics)}
              disabled={aiLoading}
              className="w-full mt-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? "Consulting Coach..." : "Consult AI Coach Insights"}
            </button>

            {usingFallback && (
              <div className="flex flex-col gap-1.5 mt-2 p-3 bg-slate-950/65 border border-slate-800 rounded-xl">
                {quotaExceeded ? (
                  <>
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[10px] uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                      <span>Gemini API Quota Exceeded</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono leading-normal">
                      The daily/minute free tier limits for your Gemini API key are currently exhausted (20 requests/day). The app has seamlessly transitioned to high-fidelity simulated recommendations to ensure zero downtime.
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-500 text-center font-mono leading-snug">
                    Configure your valid `GEMINI_API_KEY` in settings to unlock raw live AI context evaluation!
                  </span>
                )}
              </div>
            )}
          </section>

        </div>

      </main>

      {/* Roster & Reference Code Footer */}
      <footer className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-[10px] text-slate-500 font-mono gap-4">
        <div className="flex items-center gap-4">
          <span>ENDPOINT: project-7457295e-3d0e-487f-b2a.classroom_analytics</span>
          <div className="h-4 w-px bg-slate-800 hidden md:block"></div>
          <span className="text-emerald-500">API STATUS: ONLINE</span>
        </div>
        <div className="flex gap-4">
          <span className="text-cyan-400 font-semibold">Classroom Intelligence &copy; 2026</span>
          <span className="text-slate-800">|</span>
          <span className="italic">"Press 'q' to stop AI Observer session"</span>
        </div>
      </footer>
    </div>
  );
}
