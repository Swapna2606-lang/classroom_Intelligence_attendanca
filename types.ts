/**
 * Types and interfaces for Classroom Intelligence
 */

export interface EngagementEvent {
  event_id: string;
  student_id: number;
  session_id: number;
  event_type: "ATTENTION_HIGH" | "STUDENT_AWAY" | "confusion_detected" | "hand_raised" | "ATTENTION_NORMAL" | "LAUGH";
  score: number;
  attention_level?: number;
  timestamp: string;
}

export interface Student {
  student_id: number;
  name: string;
  avatar_color: string;
  expected_present: boolean;
}

export interface SessionStats {
  session_id: number;
  course_name: string;
  start_time: string;
  total_roster: number;
  students_present: number;
  attendance_rate: number;
}

export interface TeacherDashboardRow {
  student_id: number;
  student_name: string;
  session_id: number;
  current_engagement: number; // 0-100
  hands_raised: number;
  avg_attention: number; // 0-1
  status_alert: "HIGH CONFUSION" | "STABLE" | "AWAY";
  last_active_time: string;
  current_emotion: string;
}

export interface BurnoutPredictionInput {
  avg_engagement: number;
  away_count: number;
}

export interface BurnoutPredictionOutput {
  avg_engagement: number;
  away_count: number;
  is_burnt_out: boolean;
  probability: number;
}

export interface AIRecommendation {
  summary: string;
  details: string[];
  suggested_action: string;
  priority: "low" | "medium" | "high";
  tag: string;
}

export interface ClassroomStateResponse {
  project_id: string;
  dataset_id: string;
  table_id: string;
  active_session_id: number;
  roster: Student[];
  current_events: EngagementEvent[];
  teacher_dashboard: TeacherDashboardRow[];
  attendance: {
    course_name: string;
    start_time: string;
    total_roster: number;
    students_present: number;
    attendance_rate: number;
  };
  lesson_rating: {
    lesson_engagement_score: number;
    lesson_attention_score: number;
    teaching_effectiveness_rating: "Highly Effective" | "Effective" | "Needs Adjustment";
  };
}
