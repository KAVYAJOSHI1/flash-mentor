import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

// Define the shape of a learning session
interface LearningSession {
  isActive: boolean;
  skillId: string | null;
  skillName: string | null;
  stepId: string | null;
  stepName: string | null;
  startTime: number | null; // Timestamp when session started
  elapsedTime: number;     // Time spent in current active session (in seconds)
  totalLearningTime: number; // Cumulative time across all completed/ended sessions (in seconds)
}

// Define the shape of the context values
interface LearningSessionContextType {
  currentSession: LearningSession;
  startSession: (skillId: string, skillName: string, stepId: string, stepName: string) => void;
  pauseSession: () => void;
  endSession: () => void;
  resetSession: () => void; // Added for a clean restart if needed
}

// Default session state
const defaultSession: LearningSession = {
  isActive: false,
  skillId: null,
  skillName: null,
  stepId: null,
  stepName: null,
  startTime: null,
  elapsedTime: 0,
  totalLearningTime: 0, // This will be loaded from localStorage
};

// Create the context
const LearningSessionContext = createContext<LearningSessionContextType | undefined>(undefined);

// Provider component
export const LearningSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage
  const [currentSession, setCurrentSession] = useState<LearningSession>(() => {
    try {
      const storedSession = localStorage.getItem('learningSession');
      const storedTotalTime = localStorage.getItem('totalLearningTime');
      return {
        ...defaultSession,
        ...storedSession ? JSON.parse(storedSession) : {},
        totalLearningTime: storedTotalTime ? parseInt(storedTotalTime, 10) : 0,
        isActive: false, // Ensure session is not active on initial load/refresh
        startTime: null, // Reset start time on load to avoid inaccurate elapsed time
        elapsedTime: 0,  // Reset elapsed time on load
      };
    } catch (error) {
      console.error("Failed to parse learning session from localStorage", error);
      return defaultSession;
    }
  });

  // Effect to persist session state and total learning time to localStorage
  useEffect(() => {
    localStorage.setItem('learningSession', JSON.stringify({
      isActive: currentSession.isActive,
      skillId: currentSession.skillId,
      skillName: currentSession.skillName,
      stepId: currentSession.stepId,
      stepName: currentSession.stepName,
      // Do NOT save startTime or elapsedTime directly here if session is active
      // as they are dynamic and recalculated.
      // Saving totalLearningTime separately for clarity and reliability
    }));
    localStorage.setItem('totalLearningTime', currentSession.totalLearningTime.toString());
  }, [currentSession.isActive, currentSession.skillId, currentSession.skillName, currentSession.stepId, currentSession.stepName, currentSession.totalLearningTime]);


  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (currentSession.isActive && currentSession.startTime !== null) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsedSinceStart = Math.floor((now - currentSession.startTime!) / 1000);
        setCurrentSession(prev => ({
          ...prev,
          elapsedTime: elapsedSinceStart,
        }));
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession.isActive, currentSession.startTime]);


  const startSession = useCallback((skillId: string, skillName: string, stepId: string, stepName: string) => {
    setCurrentSession(prev => {
      // If a session is already active, end it first to add its time to total,
      // unless it's the exact same session being restarted (which should be handled by the UI preventing re-start)
      if (prev.isActive) {
        const timeSpent = Math.floor((Date.now() - (prev.startTime || Date.now())) / 1000);
        return {
          isActive: true,
          skillId,
          skillName,
          stepId,
          stepName,
          startTime: Date.now(),
          elapsedTime: 0,
          totalLearningTime: prev.totalLearningTime + timeSpent,
        };
      }
      return {
        isActive: true,
        skillId,
        skillName,
        stepId,
        stepName,
        startTime: Date.now(),
        elapsedTime: 0,
        totalLearningTime: prev.totalLearningTime,
      };
    });
  }, []);

  const pauseSession = useCallback(() => {
    setCurrentSession(prev => {
      if (!prev.isActive) return prev; // Do nothing if not active

      const timeSpent = Math.floor((Date.now() - (prev.startTime || Date.now())) / 1000);
      return {
        ...prev,
        isActive: false,
        startTime: null, // Reset start time when paused
        elapsedTime: 0,  // Reset elapsed time when paused (or keep if you want to resume from where it left off)
        totalLearningTime: prev.totalLearningTime + timeSpent,
      };
    });
  }, []);

  const endSession = useCallback(() => {
    setCurrentSession(prev => {
      if (!prev.isActive) return prev; // Do nothing if not active

      const timeSpent = Math.floor((Date.now() - (prev.startTime || Date.now())) / 1000);
      return {
        ...defaultSession, // Reset to default state
        totalLearningTime: prev.totalLearningTime + timeSpent, // Add current session time to total
      };
    });
  }, []);

  const resetSession = useCallback(() => {
    setCurrentSession(prev => ({
      ...defaultSession,
      totalLearningTime: prev.totalLearningTime, // Keep total learning time
    }));
  }, []);


  const value = {
    currentSession,
    startSession,
    pauseSession,
    endSession,
    resetSession
  };

  return (
    <LearningSessionContext.Provider value={value}>
      {children}
    </LearningSessionContext.Provider>
  );
};

// Custom hook to use the learning session context
export const useLearningSession = () => {
  const context = useContext(LearningSessionContext);
  if (context === undefined) {
    throw new Error('useLearningSession must be used within a LearningSessionProvider');
  }
  return context;
};
