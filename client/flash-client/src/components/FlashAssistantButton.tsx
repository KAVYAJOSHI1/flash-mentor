import { useRef, useState, useEffect } from "react";
import { useFlash } from "../contexts/FlashContext";
import "./FlashAssistantBox.css"; // Assuming you have your CSS for the component

// TypeScript declarations for Web Speech API (keep these as they are)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance;
    // speechSynthesis is already defined in lib.dom.d.ts as readonly
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

// Define a type for your chat messages
type ChatMessage = { role: "user" | "flash"; text: string };

export default function FlashAssistantBox() {
  const { isOpen, setIsOpen, messageQueue, clearMessageQueue } = useFlash();
  const [input, setInput] = useState("");
  // Initialize messages from sessionStorage, or an empty array if not found
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const storedMessages = sessionStorage.getItem("flashChatHistory");
      return storedMessages ? JSON.parse(storedMessages) : [];
    } catch (error) {
      console.error("Failed to parse stored chat history:", error);
      return [];
    }
  });
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false); // Indicates if backend request is in progress
  const [isSpeaking, setIsSpeaking] = useState(false); // Indicates if Flash is currently speaking
  const [position, setPosition] = useState({ x: 20, y: 20 }); // Initial position from bottom-right
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Offset for drag
  const [isExpanded, setIsExpanded] = useState(false); // New state for full size

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Handle Context Triggers ---
  useEffect(() => {
    if (messageQueue.length > 0) {
      const msg = messageQueue[0];
      sendMessage(msg);
      clearMessageQueue();
    }
  }, [messageQueue, clearMessageQueue]);

  // --- Session Storage for Persistent Chat History ---
  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem("flashChatHistory", JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to save chat history to session storage:", error);
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize speech synthesis voices
  useEffect(() => {
    const loadVoices = () => {
      // console.log("🎤 Available voices:", window.speechSynthesis.getVoices().length);
    };

    loadVoices(); // Load voices immediately if available

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices; // Also load when voices change
    }
  }, []);

  const speak = (text: string) => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      console.warn("Speech synthesis not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel(); // Cancel any ongoing speech to prevent overlap
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.1; // Slightly faster speech
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      console.error("❌ Speech synthesis error:", event.error);
      setIsSpeaking(false);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Prioritize Google US English voice if available
      const preferredVoice = voices.find(voice =>
        voice.lang === 'en-US' && voice.name.includes('Google')
      ) || voices.find(voice => voice.lang.includes('en')) || voices[0];

      utterance.voice = preferredVoice;
    }

    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("❌ Failed to speak:", error);
      setIsSpeaking(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    window.speechSynthesis.cancel(); // Clear any ongoing speech when sending a new message
    setIsSpeaking(false);

    // Add user message immediately to the UI
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    // Add a placeholder for the AI response while loading
    setMessages((prev) => [...prev, { role: "flash", text: "loading-placeholder" }]); // Use a special text for placeholder

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // --- Determine if this is a Tech Radar request ---
      // We assume tech radar requests contain a specific phrase in the message
      // A more robust solution might involve a separate button/action for tech radar.
      const isTechRadarPrompt = text.toLowerCase().includes("tech news") || text.toLowerCase().includes("tech radar");

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-Session-ID": "default_session" // You can make this dynamic if users have sessions
      };

      if (isTechRadarPrompt) {
        // Add the custom header for tech radar requests
        headers["X-Request-Type"] = "tech_radar";
      }

      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${baseUrl}/flash`, {
        method: "POST",
        headers: headers, // Use the dynamically created headers
        body: JSON.stringify({ message: text }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        // Attempt to parse error response from backend if available
        let errorDetails = `HTTP error! status: ${res.status}`;
        try {
          const errorData = await res.json();
          errorDetails = errorData.error || errorDetails;
        } catch (parseError) {
          console.warn("Could not parse error response JSON:", parseError);
        }
        throw new Error(errorDetails);
      }

      const data = await res.json();
      let replyContent: string | { [key: string]: any } | any[] = "No reply from Flash.";

      if (data.success && data.reply) {
        // If the AI reply is an object (for general chat JSON) or an array (for tech radar JSON)
        if (typeof data.reply === 'object' && data.reply !== null) {
          if (Array.isArray(data.reply)) {
            // This is likely the tech radar array
            // We're converting the array of objects into a more readable string for display
            // This specific display format is for the chat box, not for persistent storage
            replyContent = data.reply.map((item: any, index: number) =>
              `${index + 1}. **${item.headline}**\nSource: ${item.source}, Category: ${item.category}\nInsight: ${item.aiInsight}\n`
            ).join('\n---\n');
            // console.log("Frontend received Tech Radar data:", data.reply);
          } else if (data.reply.reply) {
            // This is a general chat response in the format { "reply": "..." }
            replyContent = data.reply.reply;
            // console.log("Frontend received General Chat data:", data.reply.reply);
          } else {
            // Fallback for unexpected JSON structure
            replyContent = JSON.stringify(data.reply, null, 2);
            console.warn("Unexpected JSON structure for AI reply:", data.reply);
          }
        } else {
          // Plain text reply (shouldn't happen often with system_instruction, but good fallback)
          replyContent = data.reply;
          // console.log("Frontend received plain text data:", data.reply);
        }
      } else if (data.error) {
        replyContent = `Error from Flash: ${data.error}`;
      }

      // Update the messages state
      setMessages((prev) => {
        const updatedMessages = [...prev];
        let lastFlashMessageIndex = -1;
        for (let i = updatedMessages.length - 1; i >= 0; i--) {
          if (updatedMessages[i].role === "flash" && updatedMessages[i].text === "loading-placeholder") {
            lastFlashMessageIndex = i;
            break;
          }
        }

        const finalReplyContent = typeof replyContent === 'string' ? replyContent : JSON.stringify(replyContent);

        if (lastFlashMessageIndex !== -1) {
          updatedMessages[lastFlashMessageIndex] = { role: "flash", text: finalReplyContent };
        } else {
          updatedMessages.push({ role: "flash", text: finalReplyContent });
        }
        return updatedMessages;
      });

      // Speak the response after a slight delay for UI update
      setTimeout(() => speak(String(replyContent)), 200); // Ensure replyContent is string for speech

    } catch (err) {
      console.error("❌ Error fetching from backend:", err);
      let errorText = "Sorry, I couldn't connect to Flash backend.";

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorText = "Request timed out. Flash is taking too long to respond. Try a shorter message.";
        } else if (err.message.includes('Failed to fetch')) {
          errorText = "Cannot connect to Flash server. Is the backend running on localhost:5000?";
        } else if (err.message.includes('NetworkError')) {
          errorText = "Network error. Check your internet connection.";
        } else {
          errorText = `Error: ${err.message}`;
        }
      }

      // Replace loading placeholder with error message
      setMessages((prev) => {
        const updatedMessages = [...prev];
        let lastFlashMessageIndex = -1;
        for (let i = updatedMessages.length - 1; i >= 0; i--) {
          if (updatedMessages[i].role === "flash" && updatedMessages[i].text === "loading-placeholder") {
            lastFlashMessageIndex = i;
            break;
          }
        }

        if (lastFlashMessageIndex !== -1) {
          updatedMessages[lastFlashMessageIndex] = { role: "flash", text: errorText };
        } else {
          updatedMessages.push({ role: "flash", text: errorText });
        }
        return updatedMessages;
      });

      speak(errorText);
    }
    setLoading(false);
  };

  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser doesn't support Speech Recognition. Try Chrome or Edge.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop(); // Stop any ongoing recognition before starting new one
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // We want a single utterance

    recognition.onstart = () => {
      setIsListening(true);
      // console.log("🎤 Listening started...");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      // console.log("📝 Heard:", transcript);
      sendMessage(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("🚫 Speech recognition error:", event.error);
      setIsListening(false);

      if (event.error === 'not-allowed') {
        alert("Microphone access denied. Please allow microphone access and try again.");
      } else if (event.error === 'no-speech') {
        // Optionally, don't show an error for no speech, just end listening
        // console.log("No speech detected.");
      } else {
        alert(`Speech recognition error: ${event.error}. Please try again.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // console.log("🎤 Listening ended");
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Drag functionality - only header is draggable
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging if the target is the header itself, AND not expanded
    if ((e.target as HTMLElement).classList.contains('flash-header') && !isExpanded) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      chatBoxRef.current?.classList.add('dragging');
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      // Calculate new position relative to the right and bottom
      const newRight = window.innerWidth - e.clientX - (chatBoxRef.current?.offsetWidth || 350) + dragStart.x;
      const newBottom = window.innerHeight - e.clientY - (chatBoxRef.current?.offsetHeight || 500) + dragStart.y;

      // Ensure box stays within window bounds
      const clampedRight = Math.max(0, Math.min(window.innerWidth - 50, newRight)); // 50px buffer from left
      const clampedBottom = Math.max(0, Math.min(window.innerHeight - 50, newBottom)); // 50px buffer from top

      setPosition({
        x: clampedRight,
        y: clampedBottom,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    chatBoxRef.current?.classList.remove('dragging');
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, position]); // Add position to dependencies for accurate clamping

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setIsExpanded(false); // Reset expansion on close
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Minimized Button */}
      {!isOpen && (
        <div
          className="flash-toggle-btn"
          style={{
            position: 'fixed',
            right: `${position.x}px`,
            bottom: `${position.y}px`,
            cursor: 'pointer',
            zIndex: 1000
          }}
          onClick={toggleChat}
        >
          <button className="w-14 h-14 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform">
            ⚡
          </button>
        </div>
      )}

      {/* Expanded Chat Box */}
      {isOpen && (
        <div
          ref={chatBoxRef}
          className="flash-box"
          style={{
            right: isExpanded ? '5vw' : `${position.x}px`,
            bottom: isExpanded ? '5vh' : `${position.y}px`,
            width: isExpanded ? '90vw' : '380px', // Responsive width
            height: isExpanded ? '90vh' : 'auto', // Responsive height
            maxHeight: isExpanded ? '90vh' : '600px', // Ensure it doesn't get too tall when small
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', // Smooth expansion
            position: 'fixed',
            zIndex: 1001, // Ensure above everything
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            borderRadius: '16px',
            overflow: 'hidden' // Clip children
          }}
        >
          <div className="flash-header" onMouseDown={handleMouseDown} style={{ justifyContent: 'space-between', display: 'flex', cursor: isExpanded ? 'default' : 'move' }}>
            <div className="flex items-center">
              <span>Flash Assistant 💬</span>
              {isSpeaking && <span style={{ marginLeft: '10px', animation: 'pulse 1s infinite' }}>🔊</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleExpand} className="text-white hover:text-gray-200 focus:outline-none px-2" title={isExpanded ? "Collapse" : "Expand"}>
                {isExpanded ? '↙️' : '↗️'}
              </button>
              <button onClick={toggleChat} className="text-white hover:text-gray-200 focus:outline-none text-xl font-bold px-2">
                &times;
              </button>
            </div>
          </div>

          <div className="flash-body">
            {messages.length === 0 ? (
              <p className="flash-placeholder">Start chatting or speak to Flash...</p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={msg.text === "loading-placeholder" ? "typing-indicator-wrapper" : `flash-msg ${msg.role === "user" ? "user-msg" : "flash-msg-ai"}`}
                >
                  {msg.text === "loading-placeholder" ? (
                    <>
                      <div className="typing-indicator">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                      </div>
                      <span style={{ fontSize: '12px', opacity: 0.7 }}>
                        Flash is thinking...
                      </span>
                    </>
                  ) : (
                    msg.role === "flash" ? (
                      <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
                    ) : (
                      msg.text
                    )
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flash-footer"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flash-input"
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flash-btn send-btn"
              onMouseDown={(e) => e.stopPropagation()}
              title="Send message"
            >
              📤
            </button>
            <button
              type="button"
              onClick={handleVoice}
              disabled={isListening || loading}
              className={`flash-btn mic-btn ${isListening ? "listening" : ""}`}
              onMouseDown={(e) => e.stopPropagation()} // Prevent drag
              title={isListening ? "Listening..." : "Click to speak"}
            >
              🎤
            </button>

            {isSpeaking && ( // Show stop speaking button only when speaking
              <button
                type="button"
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }}
                className="flash-btn"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }} // Red stop button
                onMouseDown={(e) => e.stopPropagation()} // Prevent drag
                title="Stop speaking"
              >
                🔇
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}