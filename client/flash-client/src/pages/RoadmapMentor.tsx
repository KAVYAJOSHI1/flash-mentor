import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import './RoadmapMentor.css';

// Custom SVG Icons (no dependencies)
const Icons = {
  BookOpen: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Code: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <polyline points="16,18 22,12 16,6" />
      <polyline points="8,6 2,12 8,18" />
    </svg>
  ),
  Brain: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" width="24" height="24">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  Target: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  MessageCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  Trophy: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55.47.98.97 1.21C11.25 18.4 11.61 18.5 12 18.5s.75-.1 1.03-.29c.5-.23.97-.66.97-1.21v-2.34" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  CheckCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  ),
  Clock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  ),
  Circle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  ),
  Pause: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  RotateCcw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <polyline points="1,4 1,10 7,10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
};

const ROADMAP_DATA = {
  "GATE CSE": {
    icon: Icons.BookOpen,
    subjects: [
      "Data Structures & Algorithms",
      "Operating Systems",
      "Computer Networks",
      "DBMS",
      "Compiler Design",
      "Digital Logic",
      "Theory of Computation",
      "Discrete Mathematics",
      "Engineering Mathematics",
      "General Aptitude"
    ],
    timeline: "July 2025 - May 2026",
    priority: "High",
    weeklyHours: 12,
    strategy: "1 subject per month + PYQs + Test series from Jan 2026"
  },
  "DSA Mastery": {
    icon: Icons.Code,
    subjects: [
      "Arrays & Strings & Recursion",
      "Hashing & Two Pointers",
      "Linked List & Stack & Queue",
      "Trees & Tries",
      "Graphs & BFS/DFS",
      "Dynamic Programming",
      "Greedy & Backtracking",
      "Bit Manipulation & Advanced"
    ],
    timeline: "Ongoing - 1hr daily",
    priority: "High",
    weeklyHours: 5,
    strategy: "Leetcode + Codeforces + GFG practice"
  },
  "AI/ML Core": {
    icon: Icons.Brain,
    subjects: [
      "Python & Libraries (Numpy, Pandas)",
      "Statistics & Linear Algebra",
      "Scikit-learn Basics",
      "Deep Learning Foundations",
      "CNNs & Computer Vision",
      "RNNs & NLP",
      "Transformers & Advanced NLP",
      "MLOps & Deployment"
    ],
    timeline: "Aug 2025 - Dec 2026",
    priority: "High",
    weeklyHours: 5,
    strategy: "Hands-on projects + Theory + Research papers"
  },
  "Full Stack Dev": {
    icon: Icons.Target,
    subjects: [
      "HTML/CSS/JavaScript",
      "React & TypeScript",
      "Node.js & Express",
      "PostgreSQL & Prisma",
      "Authentication & APIs",
      "DevOps & Docker",
      "AWS & Cloud Deploy",
      "System Design Basics"
    ],
    timeline: "Jan 2026 - Jun 2027",
    priority: "Medium",
    weeklyHours: 4,
    strategy: "Build real projects + Deploy to production"
  },
  "Communication": {
    icon: Icons.MessageCircle,
    subjects: [
      "Voice & Pronunciation",
      "HR Interview Questions",
      "Technical Communication",
      "Group Discussions",
      "Presentation Skills",
      "Resume & LinkedIn"
    ],
    timeline: "Ongoing - 2hrs weekly",
    priority: "Medium",
    weeklyHours: 2,
    strategy: "Daily practice + Mock interviews"
  },
  "Career Prep": {
    icon: Icons.Trophy,
    subjects: [
      "Hackathons Participation",
      "Internship Applications",
      "Portfolio Building",
      "GitHub Profile",
      "Networking & Events",
      "Personal Branding"
    ],
    timeline: "Ongoing",
    priority: "Medium",
    weeklyHours: 2,
    strategy: "6 hackathons + 2-3 internships target"
  }
};

const MILESTONES = [
  {
    date: "Dec 2025",
    title: "Foundation Complete",
    description: "Core GATE subjects + ML foundations",
    status: "upcoming"
  },
  {
    date: "May 2026",
    title: "Skill Mastery",
    description: "DSA + 1 major AI project complete",
    status: "upcoming"
  },
  {
    date: "Aug 2026",
    title: "GATE Ready",
    description: "Mock tests + AI deployment skills",
    status: "upcoming"
  },
  {
    date: "Dec 2026",
    title: "Industry Ready",
    description: "Resume + System design + Major project",
    status: "upcoming"
  },
  {
    date: "Feb 2027",
    title: "GATE & Interviews",
    description: "GATE exam + Interview calls",
    status: "upcoming"
  },
  {
    date: "Jun 2027",
    title: "Career Launch",
    description: "Placement + AI/ML career ready",
    status: "upcoming"
  }
];

const AI_SUGGESTIONS = [
  "🎯 Focus on Dynamic Programming this week - it's crucial for both GATE and interviews",
  "🤖 Your ML foundation is strong, time to start your first major project",
  "🏆 Consider participating in a hackathon to boost your portfolio",
  "📊 Review your GATE mock test results and identify weak areas",
  "💼 Update your LinkedIn profile with recent projects and skills",
  "⚡ Practice system design concepts - they're trending in interviews",
  "📚 Complete at least 2 GATE subjects this month to stay on track"
];

export default function RoadmapMentor() {
  const navigate = useNavigate(); // Initialize navigate hook
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [currentSuggestion, setCurrentSuggestion] = useState(0);
  const [studyTimer, setStudyTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [todayGoals, setTodayGoals] = useState([
    { id: 1, text: "Complete OS Process Scheduling chapter", completed: false },
    { id: 2, text: "Solve 3 DP problems on Leetcode", completed: false },
    { id: 3, text: "Read 1 ML research paper abstract", completed: true },
    { id: 4, text: "Practice HR questions for 30 mins", completed: false },
    { id: 5, text: "Review yesterday's GATE notes", completed: true }
  ]);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null); // Re-introduced state for expanded track

  // Initialize progress from localStorage or default values
  useEffect(() => {
    const savedProgress = localStorage.getItem('roadmapProgress');
    if (savedProgress) {
      setProgress(JSON.parse(savedProgress));
    } else {
      const defaultProgress: { [key: string]: number } = {
        "GATE CSE": 45,
        "DSA Mastery": 62,
        "AI/ML Core": 38,
        "Full Stack Dev": 25,
        "Communication": 55,
        "Career Prep": 30
      };
      setProgress(defaultProgress);
      localStorage.setItem('roadmapProgress', JSON.stringify(defaultProgress));
    }
  }, []);

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('roadmapProgress', JSON.stringify(progress));
  }, [progress]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setStudyTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // Rotate AI suggestions
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSuggestion(prev => (prev + 1) % AI_SUGGESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateProgress = (track: string, newProgress: number) => {
    setProgress(prev => ({
      ...prev,
      [track]: Math.min(100, Math.max(0, newProgress))
    }));
  };

  const toggleGoal = (goalId: number) => {
    setTodayGoals(prev =>
      prev.map(goal =>
        goal.id === goalId
          ? { ...goal, completed: !goal.completed }
          : goal
      )
    );
  };

  const getStatusIcon = (progressValue: number) => {
    if (progressValue >= 80) return <Icons.CheckCircle className="status-icon completed" />;
    if (progressValue >= 30) return <Icons.Clock className="status-icon inprogress" />;
    return <Icons.Circle className="status-icon notstarted" />;
  };

  const getPriorityBadge = (priority: string) => {
    return <span className={`priority-badge ${priority.toLowerCase()}`}>{priority}</span>;
  };

  const completedGoals = todayGoals.filter(goal => goal.completed).length;
  // Ensure that initial calculation handles cases where progress might be empty
  const overallProgress = Object.keys(progress).length > 0
    ? Math.round(Object.values(progress).reduce((a, b) => a + b, 0) / Object.keys(progress).length)
    : 0;

  // Function to handle clicking on a track card (to expand/collapse)
  const handleTrackCardClick = (trackName: string) => {
    setSelectedTrack(prevTrack => (prevTrack === trackName ? null : trackName));
  };

  // Modified: Function to handle clicking on a subject within an expanded track (to navigate)
  const handleSubjectClick = (subjectName: string) => {
    // Navigate to SkillCenter, passing the subjectName in the state object
    navigate('/skills', { state: { subjectNameForSkill: subjectName } });
  };

  return (
    <div className="roadmap-mentor">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <h1>🎓 Roadmap Mentor</h1>
          <p>AI-Powered Progress Tracking & Personalized Guidance</p>
          <div className="header-subtitle">
            <span>📅 2-Year Master Plan (June 2025 - June 2027)</span>
          </div>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <div className="stat-value">{completedGoals}/{todayGoals.length}</div>
            <div className="stat-label">Today's Goals</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatTime(studyTimer)}</div>
            <div className="stat-label">Study Time</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overallProgress}%</div>
            <div className="stat-label">Overall Progress</div>
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="ai-suggestions">
        <div className="ai-header">
          <Icons.Brain className="ai-icon" />
          <span>🤖 AI Mentor Says</span>
        </div>
        <div className="suggestion-content">
          <p>{AI_SUGGESTIONS[currentSuggestion]}</p>
        </div>
      </div>

      {/* Study Timer & Today's Goals Row*/}
      <div className="dashboard-row">
        <div className="study-timer">
          <div className="timer-display">
            <h3>⏱️ Study Timer: {formatTime(studyTimer)}</h3>
            <div className="timer-controls">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`timer-btn ${isTimerRunning ? 'pause' : 'play'}`}
              >
                {isTimerRunning ? <Icons.Pause /> : <Icons.Play />}
                {isTimerRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => {
                  setStudyTimer(0);
                  setIsTimerRunning(false);
                }}
                className="timer-btn reset"
              >
                <Icons.RotateCcw />
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="today-goals">
          <h3>📋 Today's Goals ({completedGoals}/{todayGoals.length})</h3>
          <div className="goals-progress-bar">
            <div
              className="goals-progress-fill"
              style={{ width: `${(completedGoals / todayGoals.length) * 100}%` }}
            ></div>
          </div>
          <div className="goals-list">
            {todayGoals.map(goal => (
              <div
                key={goal.id}
                className={`goal-item ${goal.completed ? 'completed' : ''}`}
                onClick={() => toggleGoal(goal.id)}
              >
                <div className="goal-checkbox">
                  {goal.completed ? <Icons.CheckCircle /> : <Icons.Circle />}
                </div>
                <span className="goal-text">{goal.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="progress-overview">
        <h3>📊 Progress Overview</h3>
        <div className="tracks-grid">
          {Object.entries(ROADMAP_DATA).map(([trackName, trackData]) => {
            const IconComponent = trackData.icon;
            const trackProgress = progress[trackName] || 0;

            return (
              <div
                key={trackName}
                className={`track-card ${selectedTrack === trackName ? 'selected' : ''}`} // Re-added selected state
                onClick={() => handleTrackCardClick(trackName)} // Click to expand/collapse
              >
                <div className="track-header">
                  <div className="track-icon">
                    <IconComponent />
                  </div>
                  <div className="track-info">
                    <h4>{trackName}</h4>
                    <p>{trackData.timeline}</p>
                  </div>
                  <div className="track-status">
                    {getStatusIcon(trackProgress)}
                    {getPriorityBadge(trackData.priority)}
                  </div>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${trackProgress}%` }}
                  ></div
                  >                </div>

                <div className="track-stats">
                  <span className="progress-text">{trackProgress}% Complete</span>
                  <span className="hours-text">{trackData.weeklyHours}h/week</span>
                </div>

                {selectedTrack === trackName && ( // Re-added conditional rendering for details
                  <div className="track-details">
                    <div className="strategy">
                      <strong>📋 Strategy:</strong> {trackData.strategy}
                    </div>
                    <div className="subjects-list">
                      <strong>📚 Subjects:</strong>
                      {trackData.subjects.map((subject, index) => (
                        <div
                          key={index}
                          className="subject-item"
                          onClick={(e) => { // Click on subject item to navigate
                            e.stopPropagation(); // Prevent card from collapsing
                            handleSubjectClick(subject);
                          }}
                        >
                          <span className="subject-name">{subject}</span>
                          <div className="subject-progress">
                            <div
                              className="subject-fill"
                              // This is a simplified progress simulation, adjust as needed
                              style={{
                                width: `${Math.min(100, Math.max(0, trackProgress - (index * 12.5)))}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="progress-controls">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateProgress(trackName, trackProgress - 5);
                        }}
                        className="progress-btn decrease"
                      >
                        -5%
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateProgress(trackName, trackProgress + 5);
                        }}
                        className="progress-btn increase"
                      >
                        +5%
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestones & Weekly Schedule Row */}
      <div className="bottom-row">
        <div className="milestones">
          <h3>🎯 Key Milestones</h3>
          <div className="timeline">
            {MILESTONES.map((milestone, index) => (
              <div key={index} className="milestone-item">
                <div className="milestone-date">{milestone.date}</div>
                <div className="milestone-content">
                  <h4>{milestone.title}</h4>
                  <p>{milestone.description}</p>
                </div>
                <div className={`milestone-status ${milestone.status}`}>
                  {milestone.status === 'completed' ? <Icons.CheckCircle /> : <Icons.Clock />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="weekly-schedule">
          <h3>⏰ Weekly Time Allocation</h3>
          <div className="schedule-grid">
            {Object.entries(ROADMAP_DATA).map(([track, data]) => (
              <div key={track} className="schedule-item">
                <div className="schedule-track">{track}</div>
                <div className="schedule-hours">{data.weeklyHours}h</div>
                <div className="schedule-bar">
                  <div
                    className="schedule-fill"
                    style={{ width: `${(data.weeklyHours / 12) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
            <div className="total-hours">
              <strong>Total: {Object.values(ROADMAP_DATA).reduce((sum, data) => sum + data.weeklyHours, 0)} hours/week</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}