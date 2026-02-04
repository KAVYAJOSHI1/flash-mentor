import { useState, useEffect, useRef, useCallback } from "react";
import "./CommunicationCoach.css"; // Ensure this CSS file exists and has styles

// Define the base URL for your backend API
const API_BASE_URL = 'http://localhost:5000';

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

// --- Custom types for the application ---
interface Question {
  question: string;
  category: string;
  difficulty: string;
}

interface Session {
  id: number;
  type: string;
  score?: number;
  completed: boolean;
  createdAt: string;
  questions?: Question[];
  answers?: string[];
  feedback?: string;
}

// --- Local Storage Keys ---
const LOCAL_STORAGE_SESSIONS_KEY = 'communicationCoachSessions';

// --- Constants ---
const API_TIMEOUT = 60000;

export default function CommunicationCoach() {
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<{
    type: string;
    questions: Question[];
    currentQuestionIndex: number;
    answers: string[];
    sessionId: number;
  } | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const savedSessions = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
      return savedSessions ? JSON.parse(savedSessions) : [];
    } catch (error) {
      console.error("Failed to load sessions from local storage:", error);
      return [];
    }
  });

  // --- Audio State & Refs ---
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const isSpeechSupported = useRef(false);

  // --- Initial setup for Speech Recognition/Synthesis ---
  useEffect(() => {
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      isSpeechSupported.current = true;
    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }
    if (window.speechSynthesis) {
      synthesisRef.current = window.speechSynthesis;
    }
    return () => {
      recognitionRef.current?.stop();
      synthesisRef.current?.cancel();
    };
  }, []);


  // --- Audio Control Functions ---
  const speak = useCallback((text: string) => {
    if (!synthesisRef.current) return;
    synthesisRef.current.cancel();
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthesisRef.current.speak(utterance);
  }, []);

  const startListening = useCallback((callback: (transcript: string) => void) => {
    if (!isSpeechSupported.current) {
      alert("Browser does not support Speech Recognition.");
      return;
    }
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognitionAPI();
    const recognition = recognitionRef.current;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      callback(transcript);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      speak("I didn't catch that. Please try again.");
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [speak]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // --- API Call Function ---
  // --- API Call Function ---
  const callBackendApi = useCallback(async (endpoint: string, method: string = 'GET', body: any = null, showLoading: boolean = true): Promise<any> => {
    if (showLoading) setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      };
      if (body) options.body = JSON.stringify(body);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error(`Error calling ${endpoint}:`, error);
      speak(error.message || "An unknown error occurred.");
      // If critical error for user action, show alert
      if (showLoading) alert(`Error: ${error.message}`);
      throw error;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [speak]);

  // --- Persistence Effects ---
  // Replace localStorage with Backend Fetch
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        // Pass false to not block UI with global loading state
        const data = await callBackendApi('/api/learning_sessions?user_id=1', 'GET', null, false);
        if (Array.isArray(data)) {
          setSessions(data);
        }
      } catch (error) {
        console.error("Failed to load sessions from backend:", error);
      }
    };
    fetchSessions();
  }, [callBackendApi]);


  // --- Interview Mode Functions ---
  const interviewTypes = [
    { id: 'technical', title: 'Technical Interview', description: 'CSE Domains: AI, DBMS, OS, Networks', icon: '💻' },
    { id: 'hr', title: 'HR Interview', description: 'Behavioral, Communication, Soft Skills', icon: '👥' },
    { id: 'aptitude', title: 'Aptitude Round', description: 'Logical Reasoning, Quantitative Aptitude', icon: '🧮' },
    { id: 'group-discussion', title: 'Group Discussion', description: 'Topic Analysis, Debate Skills', icon: '🗣️' }
  ];

  const fetchInterviewQuestions = useCallback(async (type: string): Promise<Question[]> => {
    try {
      const aiResponse = await callBackendApi('/api/ai/generate_interview_questions', 'POST', { interview_type: type });
      if (!Array.isArray(aiResponse.questions) || aiResponse.questions.length === 0) {
        throw new Error("AI returned invalid question format.");
      }
      return aiResponse.questions;
    } catch (error) {
      console.error("Error fetching interview questions:", error);
      return [];
    }
  }, [callBackendApi]);

  const startInterview = async (type: string) => {
    const generatedQuestions = await fetchInterviewQuestions(type);
    if (generatedQuestions.length > 0) {
      setCurrentSession({
        type,
        questions: generatedQuestions,
        currentQuestionIndex: 0,
        answers: new Array(generatedQuestions.length).fill(''),
        sessionId: Date.now(),
      });
      speak(`Starting your ${type} interview. Here is the first question: ${generatedQuestions[0].question}`);
    }
  };

  const shuffleQuestions = () => {
    if (!currentSession) return;
    const shuffled = [...currentSession.questions].sort(() => Math.random() - 0.5);
    setCurrentSession({ ...currentSession, questions: shuffled, currentQuestionIndex: 0, answers: new Array(shuffled.length).fill('') });
    setCurrentAnswer('');
    speak(`Questions shuffled. The new first question is: ${shuffled[0].question}`);
  };

  const nextQuestion = async () => {
    if (!currentSession || !currentAnswer.trim()) {
      alert("Please provide an answer.");
      return;
    }
    const updatedAnswers = [...currentSession.answers];
    updatedAnswers[currentSession.currentQuestionIndex] = currentAnswer;

    if (currentSession.currentQuestionIndex < currentSession.questions.length - 1) {
      const nextIndex = currentSession.currentQuestionIndex + 1;
      setCurrentSession({ ...currentSession, currentQuestionIndex: nextIndex, answers: updatedAnswers });
      setCurrentAnswer(updatedAnswers[nextIndex] || '');
      speak(`Next question: ${currentSession.questions[nextIndex].question}`);
    } else {
      // Complete Interview
      // Send raw data for sophisticated analysis
      const feedbackResponse = await callBackendApi('/api/ai/generate_interview_feedback', 'POST', {
        questions: currentSession.questions,
        user_answers: updatedAnswers
      });

      const score = feedbackResponse.score || 0;
      const feedbackText = feedbackResponse.feedback || "No feedback generated.";

      completeInterview(updatedAnswers, feedbackText, score);
      speak(`Interview completed. You scored ${score} out of 100. ${feedbackText.substring(0, 100)}...`);
    }
  };

  const previousQuestion = () => {
    if (!currentSession || currentSession.currentQuestionIndex === 0) return;
    const updatedAnswers = [...currentSession.answers];
    updatedAnswers[currentSession.currentQuestionIndex] = currentAnswer;
    const prevIndex = currentSession.currentQuestionIndex - 1;
    setCurrentSession({ ...currentSession, currentQuestionIndex: prevIndex, answers: updatedAnswers });
    setCurrentAnswer(updatedAnswers[prevIndex] || '');
    speak(`Previous question: ${currentSession.questions[prevIndex].question}`);
  };

  const completeInterview = async (answers: string[], feedback: string, score: number) => {
    if (!currentSession) return;
    const completedSession: Session = {
      id: currentSession.sessionId,
      type: currentSession.type,
      score,
      completed: true,
      createdAt: new Date().toISOString(),
      questions: currentSession.questions,
      answers,
      feedback,
    };
    try {
      // Save directly to backend
      const savedSession = await callBackendApi('/api/learning_sessions', 'POST', {
        user_id: 1,
        session_type: completedSession.type,
        score: completedSession.score,
        feedback: completedSession.feedback,
        questions: completedSession.questions,
        answers: completedSession.answers
      });
      setSessions(prev => [savedSession, ...prev]);
    } catch (error) {
      console.error("Failed to save session to backend:", error);
      // Optimistic update if backend fails (though ideally we show error)
      setSessions(prev => [completedSession, ...prev]);
    }
    endInterview();
  };

  const endInterview = () => {
    setCurrentSession(null);
    setCurrentAnswer('');
  };

  const handleInterviewAnswerVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(setCurrentAnswer);
    }
  };

  /*
  const clearSessions = () => {
    setSessions([]);
    // Note: Backend clear endpoint not implemented yet, just clearing UI for now
  };
  */

  // --- JSX Rendering ---
  return (
    <div className="app-container">
      <div className="max-w-7xl">
        <div className="text-center mb-8 text-white">
          <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">🎯 GATE Interview Coach</h1>
          <p className="text-xl opacity-90">Master technical interviews, HR rounds, and communication skills</p>
        </div>

        <div className="w-full">
          {currentSession ? (
            <div className="interview-active-container">
              <div className="max-w-6xl">
                <div className="interview-card">
                  <div className="interview-header">
                    <div>
                      <h1 className="interview-header-title">
                        {interviewTypes.find(t => t.id === currentSession.type)?.icon} {currentSession.type.charAt(0).toUpperCase() + currentSession.type.slice(1)} Interview
                      </h1>
                      <p className="interview-header-description">Question {currentSession.currentQuestionIndex + 1} of {currentSession.questions.length}</p>
                    </div>
                    <div className="interview-controls">
                      <button onClick={shuffleQuestions} className="shuffle-button" disabled={loading} title="Shuffle Questions">🔀 Shuffle</button>
                      <button onClick={endInterview} className="close-interview-button" disabled={loading}>✕</button>
                    </div>
                  </div>

                  <div className="interview-content-area">
                    <div className="question-box">
                      <p className="question-text">{currentSession.questions[currentSession.currentQuestionIndex].question}</p>
                      <span className="question-difficulty-tag">{currentSession.questions[currentSession.currentQuestionIndex].difficulty}</span>
                      <button onClick={() => speak(currentSession.questions[currentSession.currentQuestionIndex].question)} className="speak-question-button" disabled={isSpeaking}>🔊</button>
                    </div>

                    <div className="answer-section">
                      <textarea
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        placeholder="Type or speak your answer..."
                        className="answer-textarea"
                        disabled={loading}
                      />
                      <button
                        onClick={handleInterviewAnswerVoiceInput}
                        disabled={loading || !isSpeechSupported.current}
                        className={`voice-answer-button ${isListening ? 'listening' : ''}`}
                      >
                        {isListening ? '🎙️ Stop' : '🎤 Speak'}
                      </button>
                    </div>

                    <div className="navigation-buttons">
                      <button onClick={previousQuestion} disabled={currentSession.currentQuestionIndex === 0 || loading}>← Previous</button>
                      <button onClick={nextQuestion} disabled={loading || !currentAnswer.trim()}>
                        {loading ? 'Evaluating...' : (currentSession.currentQuestionIndex === currentSession.questions.length - 1 ? 'Complete & Get Feedback' : 'Next Question →')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="interview-grid">
              <div className="interview-types-card">
                <h3>Choose Interview Type</h3>
                <div className="interview-type-list">
                  {interviewTypes.map((type) => (
                    <button key={type.id} onClick={() => startInterview(type.id)} className="interview-type-button" disabled={loading}>
                      <div className="icon">{type.icon}</div>
                      <div className="details"><h4>{type.title}</h4><p>{type.description}</p></div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="recent-sessions-card">
                <div className="header">
                  <h3>Recent Sessions</h3>
                  {/* {sessions.length > 0 && <button onClick={clearSessions} className="clear-sessions-button">Clear All</button>} */}
                </div>
                <div className="session-list">
                  {sessions.length === 0 ? (
                    <div className="session-list-empty"><p>🎯 No sessions yet. Start an interview!</p></div>
                  ) : (
                    sessions.slice(0, 5).map((session) => (
                      <div key={session.id} className="session-item">
                        <div className="details">
                          <div className="title">{interviewTypes.find(t => t.id === session.type)?.icon} {session.type} Interview</div>
                          <div className="date">{new Date(session.createdAt || Date.now()).toLocaleDateString()}</div>
                        </div>
                        {session.score != null && <div className="score">⭐ {session.score}%</div>}
                        <button className="view-feedback-button" onClick={() => alert(`Overall Feedback:\n${session.feedback}`)}>View Feedback</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}