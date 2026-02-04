// Home.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css'; // Your CSS file for homepage styling

// Define the base URL for your backend API
// Define the base URL for your backend API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Custom SVG Icons (reused from other components for consistency)
const Icons = {
  Mic: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 18.5v3.5" /></svg>,
  Brain: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" /></svg>,
  Zap: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" /></svg>,
  Target: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  TrendingUp: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polyline points="22,7 13.5,15.5 8.5,10.5 2,17" /><polyline points="16,7 22,7 22,13" /></svg>,
  Clock: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>,
  Coffee: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>,
  Fire: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>,
  Play: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="5,3 19,12 5,21" /></svg>,
  BookOpen: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>,
  Globe: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  List: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
  CheckSquare: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polyline points="9,11 12,14 22,4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>,
  Plus: () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
};

// --- Interfaces for data fetched from the backend ---
interface Skill {
  id: string;
  name: string;
  category: string;
  progress: number;
  timeline?: string;
  priority?: string;
  weeklyHours?: number;
  lastUpdated: string;
}

interface SmartSuggestion {
  type: "focus" | "review" | "new" | "roadmap";
  text: string;
  actionLabel: string;
  actionLink: string;
}

interface Note {
  id: string;
  content: string;
  timestamp: string; // ISO 8601 string
}

interface WeeklyTask {
  id: string;
  description: string;
  completed: boolean;
  skillId?: string; // Optional: Link to a specific skill
  learningStepId?: string; // Optional: Link to a specific learning step
  type?: "review" | "practice" | "study" | "project"; // Type of task
}

// Sample Data (Only for non-database items)
// Sample Data removed - using API now


export default function Home() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState('Flash Learner');
  const [motivationQuote, setMotivationQuote] = useState("🚀 Ready to learn something new today?");

  // State to hold dynamic data from the database
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  // --- New states for Quick Capture Notes ---
  const [noteContent, setNoteContent] = useState<string>('');
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // --- New states for Weekly Task Planner ---
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTask[]>([]);
  const [isFetchingTasks, setIsFetchingTasks] = useState<boolean>(false);
  const [taskError, setTaskError] = useState<string | null>(null);


  // --- Data Fetching and Processing ---

  // Generic API caller for consistent error handling and loading
  const callBackendApi = useCallback(async (endpoint: string, method: string = 'GET', body: any = null): Promise<any> => {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`Error calling ${endpoint}:`, error);
      let errorText = `Failed to process request to ${endpoint}.`;
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorText = `Cannot connect to backend server. Please ensure your Python backend is running on \`http://localhost:5000\`.`;
        } else {
          errorText = `Error: ${error.message}`;
        }
      }
      throw new Error(errorText);
    }
  }, []);

  // Fetch Skills and dynamic data
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const skillsData: Skill[] = await callBackendApi('/api/skills');
        setSkills(skillsData);

        // Fetch user profile
        const profileData = await callBackendApi('/api/user/profile');
        if (profileData && profileData.name) {
          setUserName(profileData.name);
        }

        // Fetch motivation quote
        const motivationData = await callBackendApi('/api/motivation');
        if (motivationData && motivationData.quote) {
          setMotivationQuote(motivationData.quote);
        }

      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching initial data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();

    // Intervals for time
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timeInterval);
    };
  }, [callBackendApi]);

  // --- Quick Capture Notes Logic ---
  const handleSaveNote = useCallback(async () => {
    if (!noteContent.trim()) {
      setNoteError('Note cannot be empty.');
      return;
    }
    setIsSavingNote(true);
    setNoteError(null);
    try {
      const newNote: Note = await callBackendApi('/api/notes', 'POST', { content: noteContent });
      setRecentNotes(prev => [newNote, ...prev].slice(0, 3)); // Keep only the 3 most recent
      setNoteContent('');
    } catch (err: any) {
      setNoteError(`Failed to save note: ${err.message}`);
      console.error("Error saving note:", err);
    } finally {
      setIsSavingNote(false);
    }
  }, [noteContent, callBackendApi]);

  const fetchRecentNotes = useCallback(async () => {
    try {
      const data: Note[] = await callBackendApi('/api/notes', 'GET');
      setRecentNotes(data.slice(0, 3)); // Fetch and display max 3 recent notes
    } catch (err: any) {
      setNoteError(`Failed to fetch recent notes: ${err.message}`);
      console.error("Error fetching recent notes:", err);
    }
  }, [callBackendApi]);

  useEffect(() => {
    fetchRecentNotes();
  }, [fetchRecentNotes]);

  // --- Weekly Task Planner Logic ---
  const fetchWeeklyTasks = useCallback(async () => {
    setIsFetchingTasks(true);
    setTaskError(null);
    try {
      // In a real scenario, this endpoint would generate tasks based on skill progress
      const data: WeeklyTask[] = await callBackendApi('/api/weekly_tasks');
      setWeeklyTasks(data);
    } catch (err: any) {
      setTaskError(`Failed to fetch weekly tasks: ${err.message}`);
      console.error("Error fetching weekly tasks:", err);
    } finally {
      setIsFetchingTasks(false);
    }
  }, [callBackendApi]);

  const handleToggleTaskCompletion = useCallback(async (taskId: string) => {
    // Optimistic UI update
    setWeeklyTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
    try {
      // Send update to backend
      const taskToToggle = weeklyTasks.find(t => t.id === taskId);
      if (taskToToggle) {
        await callBackendApi(`/api/weekly_tasks/${taskId}`, 'PUT', { completed: !taskToToggle.completed });
      }
    } catch (err: any) {
      setTaskError(`Failed to update task: ${err.message}`);
      console.error("Error updating task:", err);
      // Revert optimistic update on error
      setWeeklyTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        )
      )
    }
  }, [weeklyTasks, callBackendApi]);

  const handleAddNewTask = useCallback(async () => {
    const taskDescription = window.prompt("Enter new weekly task description:");
    if (taskDescription && taskDescription.trim()) {
      try {
        // Send new task to backend
        const newTask: WeeklyTask = await callBackendApi('/api/weekly_tasks', 'POST', { description: taskDescription.trim() });
        setWeeklyTasks(prev => [...prev, newTask]); // Add the new task to the list
        setTaskError(null);
      } catch (err: any) {
        setTaskError(`Failed to add task: ${err.message}`);
        console.error("Error adding new task:", err);
      }
    }
  }, [callBackendApi, setWeeklyTasks]);


  useEffect(() => {
    fetchWeeklyTasks();
  }, [fetchWeeklyTasks]);


  // --- Dynamic Data Calculation ---
  const overallProgress = skills.length > 0
    ? Math.round(skills.reduce((sum, skill) => sum + skill.progress, 0) / skills.length)
    : 0;

  const activeLearningStreams = skills.filter(s => s.progress > 0 && s.progress < 100).length;

  const totalWeeklyHours = skills.reduce((sum, skill) => sum + (skill.weeklyHours || 0), 0);

  // --- Dynamic Content Generation ---
  const getOngoingActivities = () => {
    return skills
      .filter(skill => skill.progress < 100) // Show all skills that are not complete
      .sort((a, b) => b.progress - a.progress) // Show higher progress first
      .slice(0, 3); // Limit to top 3 ongoing activities
  };

  const getUpcomingMilestones = () => {
    // A milestone is a skill with low progress
    return skills
      .filter(skill => skill.progress < 50)
      .sort((a, b) => a.progress - b.progress) // Show lowest progress first
      .slice(0, 2); // Limit to 2 upcoming milestones
  };

  const getSmartSuggestions = (): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = [];
    if (skills.length === 0) return [];

    // Suggestion to focus on a high-priority, low-progress skill
    const highPriorityFocus = skills.find(s => s.priority?.toLowerCase() === 'high' && s.progress < 50);
    if (highPriorityFocus) {
      suggestions.push({
        type: 'focus',
        text: `Your high-priority skill '${highPriorityFocus.name}' is just getting started. Time to dig in!`,
        actionLabel: 'Focus on This Skill',
        actionLink: `/skills?skillId=${highPriorityFocus.id}`
      });
    }

    // Suggestion to review a skill that's nearly complete
    const reviewCandidate = skills.find(s => s.progress > 70 && s.progress < 100);
    if (reviewCandidate) {
      suggestions.push({
        type: 'review',
        text: `You're close to mastering '${reviewCandidate.name}'. A quick review can solidify your knowledge.`,
        actionLabel: 'Review Skill',
        actionLink: `/skills?skillId=${reviewCandidate.id}`
      });
    }

    // General suggestion to check the roadmap
    suggestions.push({
      type: 'roadmap',
      text: 'Check your overall learning roadmap to see how all your skills connect.',
      actionLabel: 'View Full Roadmap',
      actionLink: '/roadmap'
    });

    return suggestions.slice(0, 3); // Return a max of 3 suggestions
  };

  const ongoingActivities = getOngoingActivities();
  const upcomingMilestones = getUpcomingMilestones();
  const smartSuggestions = getSmartSuggestions();


  // Helper functions
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getTimeBasedEmoji = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '🌅';
    if (hour < 17) return '☀️';
    return '🌙';
  };

  const handleNavigation = (link: string) => {
    navigate(link);
  };

  if (isLoading) {
    return <div className="loading-state">Loading your dashboard...</div>;
  }

  if (error) {
    return <div className="error-state">Error: {error}</div>;
  }

  return (
    <div className="home-container">
      <header className="hero-section">
        <div className="hero-content">
          <div className="greeting-section">
            <h1>{getTimeBasedEmoji()} {getGreeting()}, {userName}!</h1>
            <p className="hero-subtitle">Your personalized learning journey awaits.</p>
            <div className="time-display">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card total-time">
            <Icons.Clock />
            <div className="stat-content">
              <span className="stat-number">{totalWeeklyHours} hrs</span>
              <span className="stat-label">Total Weekly Goal</span>
            </div>
          </div>
          <div className="stat-card active-sessions">
            <Icons.Play />
            <div className="stat-content">
              <span className="stat-number">{activeLearningStreams}</span>
              <span className="stat-label">Active Learning Streams</span>
            </div>
          </div>
          <div className="stat-card overall-progress">
            <Icons.TrendingUp />
            <div className="stat-content">
              <span className="stat-number">{overallProgress}%</span>
              <span className="stat-label">Roadmap Progress</span>
            </div>
          </div>
        </div>
      </header>

      <div className="motivation-banner">
        <div className="motivation-content">
          <Icons.Fire />
          <span className="motivation-text">{motivationQuote}</span>
        </div>
      </div>

      <div className="dashboard-grid">

        <div className="ongoing-activities-card">
          <div className="card-header">
            <Icons.Target />
            <h3>🔥 Ongoing Learning Activities</h3>
          </div>
          <div className="ongoing-content"> {/* This will become scrollable */}
            {ongoingActivities.length > 0 ? (
              ongoingActivities.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-info">
                    <strong>{activity.name}</strong>
                    <p className="activity-details">
                      <span className="activity-progress">{activity.progress}% Complete</span>
                      <span> • Category: {activity.category}</span>
                    </p>
                    <p className="activity-next-step">Next: Continue building on this skill.</p>
                  </div>
                  <button
                    className="continue-btn"
                    onClick={() => handleNavigation(`/skills?skillId=${activity.id}`)}
                  >
                    Continue <Icons.Play />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🎉</span>
                <h3>No active learning. Time to start!</h3>
                <p>Explore your <a href="/roadmap" onClick={(e) => { e.preventDefault(); navigate('/roadmap'); }}>Roadmap</a> or add new <a href="/skills" onClick={(e) => { e.preventDefault(); navigate('/skills'); }}>Skills</a>.</p>
              </div>
            )}
          </div>
        </div>

        <div className="roadmap-overview-card">
          <div className="card-header">
            <Icons.Globe />
            <h3>🗺️ Your Learning Roadmap</h3>
          </div>
          <div className="roadmap-content">
            <div className="roadmap-summary">
              <h4>Overall Progress</h4>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${overallProgress}%` }}></div>
              </div>
              <span className="progress-text">{overallProgress}% Completed Overall</span>
            </div>
            <div className="upcoming-milestones"> {/* This will become scrollable */}
              <h4>Upcoming Milestones</h4>
              {upcomingMilestones.length > 0 ? (
                upcomingMilestones.map(milestone => (
                  <div key={milestone.id} className="milestone-item">
                    <Icons.Zap />
                    <div className="milestone-details">
                      <strong>{milestone.name}</strong>
                      <p>Priority: {milestone.priority || 'Normal'}</p>
                    </div>
                    <button
                      className="view-milestone-btn"
                      onClick={() => handleNavigation(`/skills?skillId=${milestone.id}`)}
                    >
                      View
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-muted">No upcoming milestones. Keep up the great work!</p>
              )}
            </div>
            <button
              className="full-roadmap-btn"
              onClick={() => navigate('/roadmap')}
            >
              View Full Roadmap <Icons.BookOpen />
            </button>
          </div>
        </div>

        <div className="recommendations-card">
          <div className="card-header">
            <Icons.Brain />
            <h3>🎯 Smart Suggestions</h3>
          </div>
          <div className="recommendations-content"> {/* This will become scrollable */}
            {smartSuggestions.length > 0 ? (
              smartSuggestions.map((suggestion, index) => (
                <div key={index} className="recommendation-item">
                  <div className="suggestion-icon">
                    {suggestion.type === 'focus' && <Icons.Zap />}
                    {suggestion.type === 'review' && <Icons.BookOpen />}
                    {suggestion.type === 'roadmap' && <Icons.Globe />}
                    {suggestion.type === 'new' && <Icons.Fire />}
                  </div>
                  <div className="suggestion-text">
                    <p>{suggestion.text}</p>
                    <button
                      className="suggestion-action"
                      onClick={() => handleNavigation(suggestion.actionLink)}
                    >
                      {suggestion.actionLabel}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">✨</span>
                <p>Your journey is looking great! Add more skills to get new suggestions.</p>
              </div>
            )}
          </div>
        </div>

        {/* New: Quick Capture Notes - Moved to the end */}
        <div className="quick-notes-card">
          <div className="card-header">
            <Icons.Mic />
            <h3>📝 Quick Capture Notes</h3>
          </div>
          <div className="notes-content"> {/* This will become scrollable */}
            <textarea
              placeholder="Jot down a quick thought, new term, or idea..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              disabled={isSavingNote}
            ></textarea>
            <button onClick={handleSaveNote} disabled={isSavingNote}>
              {isSavingNote ? 'Saving...' : 'Save Note'}
            </button>
            {noteError && <p className="error-message">{noteError}</p>}
            {recentNotes.length > 0 && (
              <div className="recent-notes-list">
                <h4>Recent Notes:</h4>
                <ul>
                  {recentNotes.map(note => (
                    <li key={note.id} className="note-item">
                      <p>{note.content}</p>
                      <span>{new Date(note.timestamp).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recentNotes.length === 0 && !noteError && <p className="text-muted">No recent notes. Start capturing your thoughts!</p>}
          </div>
        </div>
        {/* End Quick Capture Notes */}

        {/* New: Weekly Task Planner - Moved to the end */}
        <div className="weekly-tasks-card">
          <div className="card-header">
            <Icons.CheckSquare />
            <h3>🗓️ Weekly Tasks</h3>
          </div>
          <div className="tasks-content"> {/* This will become scrollable */}
            {isFetchingTasks ? (
              <div className="loading-state small">Loading tasks...</div>
            ) : taskError ? (
              <p className="error-message">{taskError}</p>
            ) : weeklyTasks.length > 0 ? (
              <ul className="tasks-list">
                {weeklyTasks.map(task => (
                  <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTaskCompletion(task.id)}
                      id={`task-${task.id}`}
                    />
                    <label htmlFor={`task-${task.id}`}>
                      {task.description}
                      {task.type && <span className="task-type"> ({task.type.replace('_', ' ')})</span>}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">⭐</span>
                <p>No tasks planned for the week. Time to set some goals!</p>
              </div>
            )}
            <button onClick={handleAddNewTask} className="add-task-btn">
              <Icons.Plus /> Add New Task
            </button>
          </div>
        </div>
        {/* End Weekly Task Planner */}

      </div>
    </div>
  );
}