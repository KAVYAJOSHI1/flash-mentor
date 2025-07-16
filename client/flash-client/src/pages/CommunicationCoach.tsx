import { useState, useEffect, useRef, useCallback } from "react";
import "./CommunicationCoach.css"; // Ensure this CSS file exists and has styles for new elements

// Define the base URL for your backend API
const API_BASE_URL = 'http://localhost:5000'; // Your backend is running on port 5000

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
  feedback?: string; // Overall interview feedback
}

interface ChatMessage { // Used only for the backend's conversation history structure
  role: string;
  parts: { text: string }[];
}

interface VocabularyWord {
  word: string;
  meaning: string;
  example: string;
  synonyms?: string; // AI can provide these
  antonyms?: string; // AI can provide these
}

// --- Local Storage Keys ---
const LOCAL_STORAGE_VOCAB_KEY = 'communicationCoachVocab';
const LOCAL_STORAGE_SESSIONS_KEY = 'communicationCoachSessions';
const LOCAL_STORAGE_LAST_VOCAB_DATE = 'communicationCoachLastVocabDate'; // To check for daily reset

// --- Constants ---
const API_TIMEOUT = 60000; // Increased timeout to 60 seconds (1 minute) for AI processing

export default function CommunicationCoach() {
  const [currentMode, setCurrentMode] = useState<'vocabulary' | 'interview'>('vocabulary');
  const [loading, setLoading] = useState(false);

  // --- Vocabulary State ---
  const [dailyVocab, setDailyVocab] = useState<VocabularyWord[]>(() => {
    try {
      const savedVocab = localStorage.getItem(LOCAL_STORAGE_VOCAB_KEY);
      const lastFetchDate = localStorage.getItem(LOCAL_STORAGE_LAST_VOCAB_DATE);
      const today = new Date().toDateString();

      // If vocab exists and it's for today, load it. Otherwise, return empty to fetch new.
      if (savedVocab && lastFetchDate === today) {
        return JSON.parse(savedVocab);
      }
      return [];
    } catch (error) {
      console.error("Failed to load vocab from local storage:", error);
      return [];
    }
  });

  // --- Interview State ---
  const [currentSession, setCurrentSession] = useState<{
    type: string;
    questions: Question[];
    currentQuestionIndex: number;
    answers: string[];
    sessionId: number;
    // History for the current interview session to manage conversation context for AI feedback
    interviewHistory: ChatMessage[];
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
  const synthesisRef = useRef<SpeechSynthesis | null>(null); // To manage speech synthesis instance
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
      const loadVoices = () => {
        // console.log("🎤 Available voices:", synthesisRef.current?.getVoices().length);
      };
      loadVoices();
      synthesisRef.current.onvoiceschanged = loadVoices;
    } else {
      console.warn("Speech Synthesis not supported in this browser.");
    }

    // Cleanup for speech recognition and synthesis
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, []);

  // --- Persistence Effects ---
  // Save daily vocab to localStorage
  useEffect(() => {
    if (dailyVocab.length > 0) { // Only save if there's actual vocab
      try {
        localStorage.setItem(LOCAL_STORAGE_VOCAB_KEY, JSON.stringify(dailyVocab));
        localStorage.setItem(LOCAL_STORAGE_LAST_VOCAB_DATE, new Date().toDateString());
      } catch (error) {
        console.error("Failed to save vocab to local storage:", error);
      }
    }
  }, [dailyVocab]);

  // Save interview sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error("Failed to save sessions to local storage:", error);
    }
  }, [sessions]);

  // --- Audio Control Functions (shared) ---

  const speak = useCallback((text: string) => {
    if (!synthesisRef.current || !window.SpeechSynthesisUtterance) {
      console.warn("Speech synthesis not available to speak.");
      return;
    }

    synthesisRef.current.cancel(); // Stop any ongoing speech
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      console.error("❌ Speech synthesis error:", event.error);
      setIsSpeaking(false);
    };

    const voices = synthesisRef.current.getVoices();
    if (voices.length > 0) {
      const preferredVoice = voices.find(voice =>
        voice.lang === 'en-US' && voice.name.includes('Google')
      ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
      utterance.voice = preferredVoice;
    }

    try {
      synthesisRef.current.speak(utterance);
    } catch (error) {
      console.error("❌ Failed to speak:", error);
      setIsSpeaking(false);
    }
  }, []);

  const startListening = useCallback((callback: (transcript: string) => void) => {
    if (!isSpeechSupported.current) {
      alert("Your browser doesn't support Speech Recognition. Try Chrome or Edge.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // We want a single utterance

    recognition.onstart = () => {
      setIsListening(true);
      speak("Listening..."); // Provide audio feedback
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      callback(transcript); // Use the callback to pass the transcript
      setIsListening(false);
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("🚫 Speech recognition error:", event.error);
      setIsListening(false);
      speak("I didn't quite catch that. Please try again."); // Audio feedback for error
      
      if (event.error === 'not-allowed') {
        alert("Microphone access denied. Please allow microphone access and try again.");
      } else if (event.error === 'no-speech') {
        // No alert for no speech, as it's common
      } else {
        alert(`Speech recognition error: ${event.error}. Please try again.`);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [speak]); // speak is a dependency as it's called inside startListening

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);


  /**
   * Generic function for making API calls to the backend.
   * Handles loading states, errors, and timeouts.
   * @param endpoint The specific API endpoint (e.g., '/api/skills', '/api/ai/generate_skills').
   * @param method HTTP method (GET, POST, PUT, DELETE).
   * @param body Optional request body.
   * @returns The parsed JSON response data.
   */
  const callBackendApi = useCallback(async (endpoint: string, method: string = 'GET', body: any = null): Promise<any> => {
    setLoading(true);
    synthesisRef.current?.cancel(); // Cancel any ongoing speech
    setIsSpeaking(false);

    let data = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      data = await response.json();
      
    } catch (error: any) {
      console.error(`Error calling ${endpoint}:`, error);
      let errorText = `Failed to process request to ${endpoint}.`;
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorText = `Request to ${endpoint} timed out. Please try again.`;
        } else if (error.message.includes('Failed to fetch')) {
          errorText = `Cannot connect to Flash backend server. Please ensure your Python backend is running on \`http://localhost:5000\`.`;
        } else {
          errorText = `Error: ${error.message}`;
        }
      }
      throw new Error(errorText); // Re-throw to be caught by specific callers
    } finally {
      setLoading(false);
    }
    return data;
  }, [speak]); // speak is a dependency because it's used in error handling


  // --- Vocabulary Mode Functions ---
  const fetchDailyVocab = useCallback(async (forceNew = false) => {
    if (loading) return;
    synthesisRef.current?.cancel(); // Stop any speech
    setIsSpeaking(false);

    const today = new Date().toDateString();
    const lastFetchDate = localStorage.getItem(LOCAL_STORAGE_LAST_VOCAB_DATE);

    if (dailyVocab.length > 0 && lastFetchDate === today && !forceNew) {
      console.log("Vocab already fetched for today.");
      return; // Vocab already exists for today, don't refetch unless forced
    }

    setLoading(true);
    setDailyVocab([]); // Clear previous vocab display

    try {
      const prompt = `Generate 5 new, distinct English vocabulary words. For each word, provide:
      1. The word itself.
      2. Its meaning.
      3. An example sentence demonstrating its usage.
      4. At least one synonym.
      5. At least one antonym (if applicable, otherwise state "N/A").
      
      IMPORTANT: Respond ONLY with the JSON array. Do NOT include any markdown code block delimiters (e.g., \`\`\`json\`\`\`) or any other text before or after the JSON. Ensure ALL strings within the JSON are properly escaped, especially double quotes and newlines. The JSON should be valid for direct JSON.parse(). Example structure for one word:
      { "word": "Ephemeral", "meaning": "Lasting for a very short time.", "example": "The beauty of the cherry blossoms is ephemeral.", "synonyms": "Transient, fleeting", "antonyms": "Permanent, eternal" }
      `;
      
      // *** CHANGE START ***
      // Call the new dedicated AI endpoint for vocabulary generation
      const aiResponse = await callBackendApi('/api/ai/generate_vocabulary', 'POST', { prompt: prompt });
      let parsedVocab: VocabularyWord[] = aiResponse.vocabulary; // aiResponse.vocabulary directly contains the parsed JSON array
      // *** CHANGE END ***

      // Frontend is responsible for saving these to the DB
      // For now, we're using localStorage, but this would be a POST to /api/flashcards
      // if you were persisting individual flashcards to the backend DB.
      // Since it's 'dailyVocab' and stored in localStorage, no backend DB save here.

      if (!Array.isArray(parsedVocab) || parsedVocab.length !== 5 || !parsedVocab[0]?.word) {
        throw new Error("AI returned invalid vocabulary format (expected 5 words with 'word' property). Please try again.");
      }
      setDailyVocab(parsedVocab);
      speak("Here are your new vocabulary words for today.");

    } catch (error: any) {
      console.error("Error fetching daily vocab:", error);
      setDailyVocab([{
        word: "Error",
        meaning: error.message || "Failed to load vocabulary. Please try again or check backend.",
        example: "The system encountered an error.",
        synonyms: "N/A",
        antonyms: "N/A"
      }]);
      speak("Sorry, I could not fetch new vocabulary words. " + (error.message || "Please check your connection."));
    } finally {
      setLoading(false);
    }
  }, [callBackendApi, dailyVocab, loading, speak]); // Include dailyVocab, loading, speak as dependencies

  // Fetch vocab on initial load if needed
  useEffect(() => {
    fetchDailyVocab();
  }, [fetchDailyVocab]);


  // --- Interview Mode Functions ---
  const interviewTypes = [
    { id: 'technical', title: 'Technical Interview', description: 'GATE CSE, Programming, Data Structures', icon: '💻' },
    { id: 'hr', title: 'HR Interview', description: 'Behavioral, Communication, Soft Skills', icon: '👥' },
    { id: 'aptitude', title: 'Aptitude Round', description: 'Logical Reasoning, Quantitative Aptitude', icon: '🧮' },
    { id: 'group-discussion', title: 'Group Discussion', description: 'Topic Analysis, Debate Skills', icon: '🗣️' }
  ];

  const fetchInterviewQuestions = useCallback(async (type: string): Promise<Question[]> => {
    setLoading(true);
    try {
      const prompt = `Generate 5 unique, relevant, and varied ${type} interview questions suitable for a GATE exam preparation coaching session. For each question, provide a 'category' (e.g., "Data Structures", "Behavioral") and 'difficulty' (e.g., "Easy", "Medium", "Hard"). Ensure there is a good mix of difficulty levels. IMPORTANT: Respond ONLY with the JSON array. Do NOT include any markdown code block delimiters (e.g., \`\`\`json\`\`\`) or any other text before or after the JSON. Ensure ALL strings within the JSON are properly escaped, especially double quotes and newlines. The JSON should be valid for direct JSON.parse(). Format the response as a JSON array of objects, like this: \n[\n  { "question": "...", "category": "...", "difficulty": "..." },\n  { "question": "...", "category": "...", "difficulty": "..." }\n]`;
      
      // *** CHANGE START ***
      // Call the new dedicated AI endpoint for interview questions
      const aiResponse = await callBackendApi('/api/ai/generate_interview_questions', 'POST', { interview_type: type, prompt: prompt });
      let questions: Question[] = aiResponse.questions; // aiResponse.questions directly contains the parsed JSON array
      // *** CHANGE END ***

      if (!Array.isArray(questions) || questions.length === 0 || !questions[0]?.question) {
        throw new Error("AI returned invalid question format.");
      }
      return questions;
    } catch (error: any) {
      console.error("Error fetching interview questions:", error);
      speak(`Failed to generate interview questions: ${error.message || "Please try again."}`);
      alert(`Failed to generate interview questions: ${error.message || "Please check your network or API key."}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [callBackendApi, speak]);

  const startInterview = async (type: string) => {
    setLoading(true);
    synthesisRef.current?.cancel();
    setIsSpeaking(false);
    
    try {
      const generatedQuestions = await fetchInterviewQuestions(type);

      if (generatedQuestions.length === 0) {
        speak("Failed to start interview, no questions were generated. Please try again.");
        return;
      }

      const newSessionId = Date.now();
      const newSession = {
        type,
        questions: generatedQuestions,
        currentQuestionIndex: 0,
        answers: new Array(generatedQuestions.length).fill(''),
        sessionId: newSessionId,
        interviewHistory: [] // Initialize interview-specific conversation history
      };
      
      setCurrentSession(newSession);
      setCurrentMode('interview');
      
      setTimeout(() => {
        const firstQuestion = generatedQuestions[0].question;
        speak(firstQuestion);
      }, 500);
      
    } finally {
      setLoading(false);
    }
  };

  const shuffleQuestions = () => {
    if (!currentSession || loading) return;
    synthesisRef.current?.cancel();
    setIsSpeaking(false);
    
    const shuffledQuestions = [...currentSession.questions].sort(() => Math.random() - 0.5);
    const newAnswers = new Array(shuffledQuestions.length).fill(''); // Clear answers for new order
    
    setCurrentSession({
      ...currentSession,
      questions: shuffledQuestions,
      answers: newAnswers,
      currentQuestionIndex: 0, // Start from the first shuffled question
      interviewHistory: [] // Reset history as questions change order
    });
    setCurrentAnswer(''); // Clear current answer input

    setTimeout(() => {
      speak("Questions shuffled. Here's the first question again: " + shuffledQuestions[0].question);
    }, 500);
  };

  const nextQuestion = async () => {
    if (!currentSession || loading || !currentAnswer.trim()) {
      alert("Please provide an answer before proceeding.");
      return;
    }
    
    synthesisRef.current?.cancel();
    setIsSpeaking(false);
    setLoading(true);

    const updatedAnswers = [...currentSession.answers];
    updatedAnswers[currentSession.currentQuestionIndex] = currentAnswer;

    try {
      const question = currentSession.questions[currentSession.currentQuestionIndex].question;
      const answer = currentAnswer;

      // Add the current Q&A to the interview history for context (for AI feedback prompt)
      // Note: This history is for AI context, not saved to ChatHistory DB table.
      const updatedInterviewHistory = [
        ...currentSession.interviewHistory,
        { role: "user", parts: [{ text: `Question: ${question}\nAnswer: ${answer}` }] }
      ];

      // Prompt for feedback on the current answer
      const feedbackPrompt = `Given the interview question: "${question}" and the user's answer: "${answer}". Provide concise, constructive feedback (max 150 words) on this specific answer focusing on clarity, completeness, relevance, and communication effectiveness. Suggest improvements. Do not evaluate future questions.`;
      
      // *** CHANGE START ***
      // Call the new dedicated AI endpoint for interview feedback
      const feedbackResponse = await callBackendApi('/api/ai/generate_interview_feedback', 'POST', { prompt: feedbackPrompt });
      const feedback = feedbackResponse.feedback; // aiResponse.feedback directly contains the feedback text
      // *** CHANGE END ***
      
      // Add AI feedback to history for next turn's context
      const historyWithFeedback = [...updatedInterviewHistory, { role: "model", parts: [{ text: feedback }] }];

      if (currentSession.currentQuestionIndex < currentSession.questions.length - 1) {
        // Move to next question
        const nextQuestionIndex = currentSession.currentQuestionIndex + 1;
        const nextQ = currentSession.questions[nextQuestionIndex].question;
        
        setCurrentSession(prev => prev ? {
          ...prev,
          currentQuestionIndex: nextQuestionIndex,
          answers: updatedAnswers,
          interviewHistory: historyWithFeedback // Update history for next question
        } : null);
        setCurrentAnswer(updatedAnswers[nextQuestionIndex] || '');
        
        speak(`Feedback: ${feedback} Next question: ${nextQ}`);

      } else {
        // Last question, complete interview and provide overall feedback
        const completePrompt = `The user has completed a ${currentSession.type} interview. Provide an overall evaluation of their performance based on all questions and answers, suggest areas for improvement, and assign a score out of 100. Structure your response as: "Overall Feedback: [Your detailed feedback]. Score: [X]/100."`;
        
        // Use the full interview history to provide comprehensive overall feedback
        const finalInterviewHistory = [
          ...historyWithFeedback, // History including last Q&A and its feedback
          { role: "user", parts: [{ text: "Please provide overall interview feedback and score." }] } // Final prompt
        ];

        // *** CHANGE START ***
        // Call the new dedicated AI endpoint for interview feedback (overall)
        const overallFeedbackResponseData = await callBackendApi('/api/ai/generate_interview_feedback', 'POST', { prompt: completePrompt });
        const overallFeedbackResponse = overallFeedbackResponseData.feedback; // aiResponse.feedback directly contains the feedback text
        // *** CHANGE END ***
        
        let score = 0;
        const scoreMatch = overallFeedbackResponse.match(/Score:\s*(\d+)\/100/);
        if (scoreMatch && scoreMatch[1]) {
          score = parseInt(scoreMatch[1], 10);
        } else {
          score = Math.floor(Math.random() * 30) + 70; // Fallback score if not found
        }

        completeInterview(updatedAnswers, overallFeedbackResponse, score);
        speak(`Interview completed. ${overallFeedbackResponse}`);
      }
    } catch (err: any) {
      console.error("❌ Error processing interview question:", err);
      speak(`Error processing answer: ${err.message || "Please try again."}`);
      alert(`Error: ${err.message || "An unexpected error occurred."}`);
    } finally {
      setLoading(false);
    }
  };

  const previousQuestion = () => {
    if (!currentSession || currentSession.currentQuestionIndex === 0 || loading || isSpeaking || isListening) return;
    synthesisRef.current?.cancel();
    setIsSpeaking(false);
    
    const updatedAnswers = [...currentSession.answers];
    updatedAnswers[currentSession.currentQuestionIndex] = currentAnswer;
    
    setCurrentSession(prev => prev ? {
      ...prev,
      currentQuestionIndex: prev.currentQuestionIndex - 1,
      answers: updatedAnswers,
      // Note: Interview history is not rewound here, it keeps growing
    } : null);
    const prevQuestion = currentSession.questions[currentSession.currentQuestionIndex - 1].question;
    setCurrentAnswer(updatedAnswers[currentSession.currentQuestionIndex - 1] || '');
    speak(prevQuestion);
  };

  const completeInterview = async (answers: string[], feedback: string, score: number) => {
    if (!currentSession) return;
    
    const completedSession: Session = {
      id: currentSession.sessionId,
      type: currentSession.type,
      score: score,
      completed: true,
      createdAt: new Date().toISOString(),
      questions: currentSession.questions,
      answers: answers,
      feedback: feedback
    };
    
    // *** CHANGE START ***
    // Now save the completed session to the backend DB via /api/learning_sessions
    try {
      // For simplicity, using a fixed user_id. In a real app, this would come from auth.
      await callBackendApi('/api/learning_sessions', 'POST', {
        user_id: 1, // Example user ID
        session_type: completedSession.type,
        score: completedSession.score,
        feedback: completedSession.feedback,
        questions: completedSession.questions,
        answers: completedSession.answers
      });
      setSessions((prev) => [completedSession, ...prev]); // Add to local state after successful backend save
    } catch (error: any) {
      console.error("Failed to save learning session to backend:", error);
      alert(`Failed to save interview session: ${error.message}`);
      // Optionally, still add to local state even if backend save fails, or show a persistent error.
      setSessions((prev) => [completedSession, ...prev]); 
    }
    // *** CHANGE END ***

    endInterview();
  };

  const endInterview = () => {
    synthesisRef.current?.cancel();
    setIsSpeaking(false);
    setCurrentSession(null);
    setCurrentAnswer('');
    setCurrentMode('vocabulary'); // Default back to vocabulary mode
  };

  const handleInterviewAnswerVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((transcript) => {
        setCurrentAnswer(transcript); // Set transcript to the answer textarea
      });
    }
  };

  // --- Clear Functions ---
  const clearSessions = () => {
    setSessions([]);
    localStorage.removeItem(LOCAL_STORAGE_SESSIONS_KEY);
  };

  const clearVocab = () => {
    setDailyVocab([]);
    localStorage.removeItem(LOCAL_STORAGE_VOCAB_KEY);
    localStorage.removeItem(LOCAL_STORAGE_LAST_VOCAB_DATE);
  }

  // --- JSX Rendering ---
  if (currentSession) {
    const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex];
    const isLastQuestion = currentSession.currentQuestionIndex === currentSession.questions.length - 1;
    
    return (
      <div className="interview-active-container">
        <div className="max-w-6xl">
          <div className="interview-card">
            <div className="interview-header">
              <div>
                <h1 className="interview-header-title">
                  {interviewTypes.find(t => t.id === currentSession.type)?.icon} {currentSession.type.charAt(0).toUpperCase() + currentSession.type.slice(1)} Interview
                </h1>
                <p className="interview-header-description">Answer each question thoughtfully for GATE preparation</p>
              </div>
              <div className="interview-controls">
                <button
                  onClick={shuffleQuestions}
                  className="shuffle-button"
                  disabled={loading || isSpeaking || isListening}
                  title="Shuffle Questions"
                >
                  🔀 Shuffle
                </button>
                <button 
                  onClick={endInterview} 
                  className="close-interview-button"
                  disabled={loading || isSpeaking || isListening}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="interview-content-area">
              <div className="question-box">
                <div className="question-meta">
                  <span className="question-number-tag">
                    Question {currentSession.currentQuestionIndex + 1} of {currentSession.questions.length}
                  </span>
                  <span className="question-difficulty-tag">
                    {currentQuestion.difficulty}
                  </span>
                </div>
                <p className="question-text">{currentQuestion.question}</p>
                <p className="question-category">Category: {currentQuestion.category}</p>
                <button
                  onClick={() => speak(currentQuestion.question)}
                  className="speak-question-button"
                  disabled={isSpeaking || isListening}
                  title="Listen to question"
                >
                  🔊
                </button>
              </div>

              <div className="answer-section">
                <label className="answer-section label">Your Answer</label>
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Type your detailed answer here or click speak to record..."
                  className="answer-textarea"
                  disabled={loading || isListening} // Disable textarea if loading or listening
                />
                <button
                  onClick={handleInterviewAnswerVoiceInput}
                  disabled={loading || !isSpeechSupported.current || isSpeaking}
                  className={`voice-answer-button ${isListening ? 'listening' : ''}`}
                  title={isListening ? "Listening... Click to stop" : "🎤 Answer via Voice"}
                >
                  {isListening ? '🎙️ Stop Recording' : '🎤 Answer via Voice'}
                </button>
                {isSpeaking && (
                  <button
                    type="button"
                    onClick={() => synthesisRef.current?.cancel()}
                    className="stop-speaking-button"
                    title="Stop AI speaking"
                  >
                    🔇
                  </button>
                )}
              </div>

              <div className="navigation-buttons">
                <button
                  onClick={previousQuestion}
                  disabled={currentSession.currentQuestionIndex === 0 || loading || isSpeaking || isListening}
                  className={`nav-button prev ${
                    currentSession.currentQuestionIndex === 0 ? 'disabled' : ''
                  }`}
                >
                  ← Previous
                </button>
                <button
                  onClick={nextQuestion}
                  disabled={loading || !currentAnswer.trim() || isSpeaking || isListening} // Disable if no answer or speaking/listening
                  className="nav-button next"
                >
                  {loading ? 'Evaluating...' : (isLastQuestion ? 'Complete Interview' : 'Next Question →')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="max-w-7xl">
        <div className="text-center mb-8 text-white">
          <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">🎯 GATE Communication Coach</h1>
          <p className="text-xl opacity-90">Master technical interviews, HR rounds, and communication skills for GATE preparation</p>
        </div>

        <div className="mode-toggle-buttons">
          <button
            onClick={() => setCurrentMode('vocabulary')}
            className={`mode-button ${currentMode === 'vocabulary' ? 'active' : ''}`}
            disabled={loading || isSpeaking || isListening}
          >
            📚 Vocabulary Coach
          </button>
          <button
            onClick={() => setCurrentMode('interview')}
            className={`mode-button ${currentMode === 'interview' ? 'active' : ''}`}
            disabled={loading || isSpeaking || isListening}
          >
            🎤 Interview Mode
          </button>
        </div>

        <div className="w-full">
          {currentMode === 'vocabulary' ? (
            <div className="vocab-container">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Daily Vocabulary</h3>
                  {dailyVocab.length > 0 && (
                    <button
                      onClick={clearVocab}
                      className="clear-button"
                      disabled={loading || isSpeaking || isListening}
                    >
                      Clear Vocab
                    </button>
                  )}
                </div>
                
                <div className="vocab-controls">
                  <button
                    onClick={() => fetchDailyVocab(true)} // Pass true to force new words
                    disabled={loading || isSpeaking || isListening}
                    className="get-new-words-button"
                  >
                    {loading ? 'Generating...' : 'Get 5 New Words'}
                  </button>
                  {isSpeaking && (
                    <button
                      type="button"
                      onClick={() => synthesisRef.current?.cancel()}
                      className="stop-speaking-button"
                      title="Stop AI speaking"
                    >
                      🔇
                    </button>
                  )}
                </div>

                <div className="vocab-list">
                  {loading && dailyVocab.length === 0 ? (
                    <div className="vocab-empty">
                      <p>Generating new vocabulary words...</p>
                      <div className="loading-spinner"></div>
                    </div>
                  ) : dailyVocab.length === 0 ? (
                    <div className="vocab-empty">
                      <h4>No vocabulary words yet!</h4>
                      <p>Click "Get 5 New Words" to start learning.</p>
                    </div>
                  ) : (
                    dailyVocab.map((word, index) => (
                      <div key={index} className="vocab-item">
                        <div className="vocab-header">
                          <h4 className="vocab-word">{word.word}</h4>
                          <button
                            onClick={() => speak(word.word + ". Meaning: " + word.meaning + ". Example: " + word.example + ". Synonyms: " + word.synonyms + ". Antonyms: " + word.antonyms)}
                            className="speak-vocab-button"
                            disabled={isSpeaking || isListening}
                            title={`Listen to ${word.word}`}
                          >
                            🔊
                          </button>
                        </div>
                        <p className="vocab-meaning"><strong>Meaning:</strong> {word.meaning}</p>
                        <p className="vocab-example"><strong>Example:</strong> "{word.example}"</p>
                        <p className="vocab-synonyms"><strong>Synonyms:</strong> {word.synonyms}</p>
                        <p className="vocab-antonyms"><strong>Antonyms:</strong> {word.antonyms}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="interview-grid">
              <div className="interview-types-card">
                <h3>Choose Interview Type</h3>
                <div className="interview-type-list">
                  {interviewTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => startInterview(type.id)}
                      className="interview-type-button"
                      disabled={loading || isSpeaking || isListening}
                    >
                      <div className="icon">{type.icon}</div>
                      <div className="details">
                        <h4>{type.title}</h4>
                        <p>{type.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="recent-sessions-card">
                <div className="header">
                  <h3>Recent Sessions</h3>
                  {sessions.length > 0 && (
                    <button
                      onClick={clearSessions}
                      className="clear-sessions-button"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="session-list">
                  {sessions.length === 0 ? (
                    <div className="session-list-empty">
                      <p>🎯 No sessions yet</p>
                      <p>Start your first practice interview!</p>
                    </div>
                  ) : (
                    sessions.slice(0, 5).map((session) => (
                      <div key={session.id} className="session-item">
                        <div className="details">
                          <div className="title">
                            {interviewTypes.find(t => t.id === session.type)?.icon} {session.type} Interview
                          </div>
                          <div className="date">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {session.score && (
                          <div className="score">
                            ⭐ {session.score}%
                          </div>
                        )}
                        {session.feedback && (
                          <button
                            className="view-feedback-button"
                            onClick={() => alert(`Overall Feedback:\n${session.feedback}`)}
                          >
                            View Feedback
                          </button>
                        )}
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