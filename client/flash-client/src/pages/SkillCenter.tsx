import React, { useState, useEffect, useCallback } from 'react';
import './SkillCenter.css'; // Your CSS file
import { useLocation, useNavigate } from 'react-router-dom';
import { useFlash } from '../contexts/FlashContext';

// Define the base URL for your backend API
// Define the base URL for your backend API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Custom SVG Icons (reused from other components for consistency)
const Icons = {
  Search: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  Zap: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  ),
  BookOpen: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Globe: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  ),
  Award: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="7"></circle>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
    </svg>
  ),
  Code: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <polyline points="16,18 22,12 16,6" />
      <polyline points="8,6 2,12 8,18" />
    </svg>
  ),
  Target: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  TrendingUp: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  ),
  Circle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  PlusCircle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="16"></line>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
  ),
  XCircle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  ),
  Lightbulb: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <path d="M12 18a6 6 0 0 0 0-12c-3.3 0-6 2.7-6 6a6 6 0 0 0 6 6z"></path>
      <path d="M12 22v-4"></path>
      <path d="M12 2l-1.5 3"></path>
      <path d="M5.5 19.5l1.5-1.5"></path>
      <path d="M18.5 19.5l-1.5-1.5"></path>
      <path d="M3 12h3"></path>
      <path d="M18 12h3"></path>
      <path d="M5.5 4.5l1.5 1.5"></path>
      <path d="M18.5 4.5l-1.5 1.5"></path>
    </svg>
  ),
  Brain: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
};

interface Skill {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  progress: number;
  category: string;
  lastUpdated: string; // Stored as 'last_updated' in backend
  timeline?: string; // Optional for RoadmapMentor integration
  priority?: string; // Optional for RoadmapMentor integration
  weeklyHours?: number; // Optional for RoadmapMentor integration
  strategy?: string; // Optional for RoadmapMentor integration
}

interface LearningStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  aiExplanation?: string;
  resources: string[]; // Stored as JSON string in backend
  order: number; // Added order for sorting
}

const SkillCenter: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'skills' | 'learning'>('skills');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [learningSteps, setLearningSteps] = useState<LearningStep[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stepLoadingId, setStepLoadingId] = useState<string | null>(null);
  const [overallAiGuidance, setOverallAiGuidance] = useState<string>('');

  const [newSkillSearchTerm, setNewSkillSearchTerm] = useState<string>('');
  const [isSearchingNewSkill, setIsSearchingNewSkill] = useState<boolean>(false);
  const [suggestedNewSkill, setSuggestedNewSkill] = useState<Skill | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isAddingSkillFromRoadmap, setIsAddingSkillFromRoadmap] = useState<boolean>(false);

  const [filterMySkillsTerm, setFilterMySkillsTerm] = useState<string>('');
  const [isInitialSkillsLoading, setIsInitialSkillsLoading] = useState<boolean>(true);


  /**
   * Helper function to extract JSON string from a markdown code block.
   */
  const extractJsonFromMarkdown = (text: string): string => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }
    return text.trim();
  };

  /**
   * Generic function for making API calls to the backend.
   */
  const callBackendApi = useCallback(async (endpoint: string, method: string = 'GET', body: any = null, isAiCall: boolean = false): Promise<any> => {
    if (isAiCall) setIsLoading(true);
    let data = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

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

      if (isAiCall && data.reply && typeof data.reply === 'string') {
        try {
          data.reply = JSON.parse(extractJsonFromMarkdown(data.reply));
        } catch (parseError) {
          console.warn("Could not parse AI reply as JSON from markdown, using raw reply:", parseError);
        }
      }

    } catch (error: any) {
      console.error(`Error calling ${endpoint}:`, error);
      let errorText = `Failed to process request to ${endpoint}.`;
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorText = `Request to ${endpoint} timed out. Please ensure your backend is responsive.`;
        } else if (error.message.includes('Failed to fetch')) {
          errorText = `Cannot connect to backend server. Please ensure your Python backend is running on \`http://localhost:5000\`.`;
        } else {
          errorText = `Error: ${error.message}`;
        }
      }
      throw new Error(errorText);
    } finally {
      if (isAiCall) setIsLoading(false);
    }
    return data;
  }, []);

  // --- Fetches learning steps for a selected skill from the backend. ---
  const fetchLearningPath = useCallback(async (skillId: string, skillName: string, skillLevel: string) => {
    setLearningSteps([]);
    setOverallAiGuidance('');
    setStepLoadingId(null);

    setOverallAiGuidance(`Loading your learning path for **${skillName}**...`);
    setIsLoading(true);

    try {
      // 1. Prioritize Database Check
      const data = await callBackendApi(`/api/skills/${skillId}/learning_steps`);

      if (data && Array.isArray(data.learning_steps) && data.learning_steps.length > 0) {
        console.log("Learning path found in database. Displaying existing steps.");
        setLearningSteps(data.learning_steps.map((step: any) => ({
          ...step,
          resources: JSON.parse(step.resources || '[]'),
          id: String(step.id),
          order: step.order || 0,
          aiExplanation: step.aiExplanation || step.ai_explanation || ''
        })));
        setOverallAiGuidance(data.overall_ai_guidance || `Here's your learning path for **${skillName}**!`);
      } else {
        // 2. No steps found, generate one with AI
        console.log("No existing learning path found. Generating with AI...");
        setOverallAiGuidance(`No learning steps found for **${skillName}**. Generating one now...`);

        const prompt = `Create a detailed learning roadmap for ${skillName} at a ${skillLevel} level. 
        Provide 5-7 distinct learning steps, each with a concise title (e.g., "Core JavaScript Fundamentals"), 
        a brief description (1-2 sentences), and 3-5 suggested resources (e.g., 'Official Docs', 'YouTube Tutorials', 
        'Interactive Course X', 'Practice Projects'). Ensure the response is a JSON array of objects, 
        formatted exactly as follows, with no additional text or markdown outside the JSON:
        [
          { "id": "unique-uuid-1", "title": "Step 1 Title", "description": "Description for step 1.", "resources": ["Resource A", "Resource B"], "order": 1, "aiExplanation": "Initial explanation." },
          { "id": "unique-uuid-2", "title": "Step 2 Title", "description": "Description for step 2.", "resources": ["Resource C", "Resource D"], "order": 2, "aiExplanation": "Second explanation." }
        ]
        Use short, descriptive resource names. Ensure 'id' is a unique string for each step and 'order' is a number.`;

        const aiResponse = await callBackendApi('/api/ai/generate_learning_path', 'POST', { skill_name: skillName, skill_level: skillLevel, prompt: prompt }, true);
        const parsedSteps: LearningStep[] = aiResponse.learning_steps;

        if (!Array.isArray(parsedSteps) || parsedSteps.length === 0) {
          throw new Error("AI did not return any valid learning steps.");
        }

        const stepsToSave = parsedSteps.map(step => ({
          skillId: skillId,
          title: step.title,
          description: step.description,
          resources: JSON.stringify(step.resources || []),
          completed: false,
          order: step.order || 0,
          ai_explanation: step.aiExplanation || ''
        }));

        const saveResponse = await callBackendApi('/api/learning_steps/batch', 'POST', stepsToSave);
        if (!saveResponse.learning_steps) {
          throw new Error("Backend did not return saved learning steps.");
        }

        setLearningSteps(saveResponse.learning_steps.map((s: any) => ({
          ...s,
          resources: JSON.parse(s.resources || '[]'),
          id: String(s.id),
          order: s.order || 0,
          aiExplanation: s.aiExplanation || s.ai_explanation || ''
        })));
        setOverallAiGuidance(aiResponse.overall_ai_guidance || `Your personalized learning path has been successfully generated!`);
      }
    } catch (e: any) {
      console.error("Failed to load learning path:", e);
      setOverallAiGuidance(`Failed to load learning path for **${skillName}**: ${e.message}.`);
      setLearningSteps([]);
    } finally {
      setIsLoading(false);
    }
  }, [callBackendApi]);


  /**
   * Generates and saves a learning path for a selected skill using AI.
   */
  const startLearning = useCallback(async (skill: Skill) => {
    setSelectedSkill(skill);
    setActiveTab('learning');
    fetchLearningPath(skill.id, skill.name, skill.level);
  }, [fetchLearningPath]);

  const handleSearchNewSkill = useCallback(async (e: React.FormEvent | null, initialSearchTerm?: string) => {
    const searchTerm = initialSearchTerm || newSkillSearchTerm.trim();
    if (e) e.preventDefault();
    if (!searchTerm) {
      setSearchError('Please enter a skill to search.');
      setSuggestedNewSkill(null);
      return;
    }
    setSearchError(null);
    setSuggestedNewSkill(null);
    setIsSearchingNewSkill(true);
    const prompt = `Generate 1 skill based on "${searchTerm}".
    For the skill, provide:
    - 'name' (string, e.g., "Python Programming")
    - 'level' ('beginner', 'intermediate', or 'advanced')
    - 'progress' (number, always 0 for new)
    - 'category' (string, e.g., "Programming Languages", "AI/ML", "Web Dev", "DSA", "core-cs", "communication", "career-prep")
    - 'lastUpdated' (string, 'YYYY-MM-DD' format, for a recent date, e.g., "${new Date().toISOString().slice(0, 10)}")
    - 'timeline' (string, e.g., "July 2025 - May 2026")
    - 'priority' (string, e.g., "High", "Medium", "Low")
    - 'weeklyHours' (integer, e.g., 10, 5)
    - 'strategy' (brief text, e.g., "1 subject per month + PYQs")
    
    Respond ONLY with a JSON array containing ONE skill object. Ensure no extra characters, text, or markdown outside the JSON array. Example:
    [
      { "name": "Python Programming", "level": "intermediate", "progress": 0, "category": "Programming Languages", "lastUpdated": "2025-07-03", "timeline": "Ongoing", "priority": "High", "weeklyHours": 5, "strategy": "Daily practice" }
    ]`;
    try {
      const aiResponse = await callBackendApi('/api/ai/generate_skills', 'POST', { category_hint: searchTerm, prompt: prompt }, true);
      if (!aiResponse || !Array.isArray(aiResponse.skills) || aiResponse.skills.length === 0) {
        throw new Error("AI did not return any valid skills, or the 'skills' array is missing/empty.");
      }
      const parsedSkill = aiResponse.skills[0];
      if (
        typeof parsedSkill.name === 'string' &&
        ['beginner', 'intermediate', 'advanced'].includes(parsedSkill.level) &&
        typeof parsedSkill.category === 'string' &&
        typeof parsedSkill.progress === 'number' &&
        typeof parsedSkill.timeline === 'string' &&
        typeof parsedSkill.priority === 'string' &&
        typeof parsedSkill.weeklyHours === 'number' &&
        typeof parsedSkill.strategy === 'string'
      ) {
        const completeSkill: Skill = {
          ...parsedSkill,
          id: parsedSkill.id || `suggested-${Date.now()}`,
          lastUpdated: parsedSkill.lastUpdated || new Date().toISOString().split('T')[0],
        };
        setSuggestedNewSkill(completeSkill);
      } else {
        const requiredKeys = ['name', 'level', 'category', 'progress', 'timeline', 'priority', 'weeklyHours', 'strategy'];
        const missingKeys = requiredKeys.filter(key => !(key in parsedSkill));
        const errorDetail = missingKeys.length > 0 ? `Missing keys: ${missingKeys.join(', ')}` : 'One or more keys have the wrong data type or format.';
        throw new Error(`AI returned invalid skill format. ${errorDetail}`);
      }
    } catch (e: any) {
      console.error("Failed to generate new skill:", e);
      setSearchError(`Flash AI could not suggest a new skill: ${e.message}. Please try again.`);
    } finally {
      setIsSearchingNewSkill(false);
      setIsAddingSkillFromRoadmap(false);
    }
  }, [newSkillSearchTerm, callBackendApi]);

  const handleAddSuggestedSkill = useCallback(async () => {
    if (!suggestedNewSkill) return;
    try {
      const skillToSend = {
        name: suggestedNewSkill.name,
        category: suggestedNewSkill.category,
        level: suggestedNewSkill.level,
        progress: suggestedNewSkill.progress,
        last_updated: suggestedNewSkill.lastUpdated,
        timeline: suggestedNewSkill.timeline,
        priority: suggestedNewSkill.priority,
        weekly_hours: suggestedNewSkill.weeklyHours,
        strategy: suggestedNewSkill.strategy
      };
      const response = await callBackendApi('/api/skills/batch', 'POST', [skillToSend]);
      if (response && response.skills && response.skills.length > 0) {
        const addedSkill = response.skills[0];
        setSkills(prevSkills => [...prevSkills, {
          ...addedSkill,
          lastUpdated: addedSkill.lastUpdated || addedSkill.last_updated,
          weeklyHours: addedSkill.weeklyHours || addedSkill.weekly_hours,
          id: String(addedSkill.id),
        }]);
        setSuggestedNewSkill(null);
        setNewSkillSearchTerm('');
        setSearchError(null);
        const newlyAddedSkill = {
          ...addedSkill,
          lastUpdated: addedSkill.lastUpdated || addedSkill.last_updated,
          weeklyHours: addedSkill.weeklyHours || addedSkill.weekly_hours,
          id: String(addedSkill.id),
        };
        setSelectedSkill(newlyAddedSkill);
        setActiveTab('learning');
        fetchLearningPath(newlyAddedSkill.id, newlyAddedSkill.name, newlyAddedSkill.level);
      } else {
        throw new Error("Backend did not confirm the skill was added.");
      }
    } catch (error: any) {
      console.error("Error adding suggested skill to backend:", error);
      setSearchError(`Failed to add skill to your profile: ${error.message}`);
    }
  }, [suggestedNewSkill, callBackendApi, fetchLearningPath, setSkills]);

  const updateSkillProgress = useCallback(async (skillId: string, newProgress: number) => {
    const clampedProgress = Math.min(100, Math.max(0, newProgress));
    setSkills(prevSkills => {
      return prevSkills.map(skill =>
        skill.id === skillId
          ? { ...skill, progress: clampedProgress, lastUpdated: new Date().toISOString().split('T')[0] }
          : skill
      );
    });
    try {
      await callBackendApi(`/api/skills/${skillId}`, 'PUT', { progress: clampedProgress });
    } catch (error: any) {
      console.error(`Failed to update skill progress for ${skillId}:`, error);
      setSkills(prevSkills => {
        const originalSkill = prevSkills.find(s => s.id === skillId);
        return prevSkills.map(s => s.id === skillId ? originalSkill! : s);
      });
      alert(`Failed to update skill progress: ${error.message}`);
    }
  }, [callBackendApi]);

  const { triggerMessage } = useFlash();

  const requestAiExplanation = useCallback(async (step: LearningStep) => {
    if (!selectedSkill) return;

    // Create a tutoring prompt
    const prompt = `I'm learning "${selectedSkill.name}" and I'm currently on the step "${step.title}". Can you explain this concept to me in detail, teach me the core principles, and maybe give me a small quiz or question to test my understanding? I want to master this specific topic.`;

    triggerMessage(prompt);
  }, [selectedSkill, triggerMessage]);

  const toggleLearningStep = useCallback(async (stepId: string) => {
    const stepToToggle = learningSteps.find(step => step.id === stepId);
    if (!stepToToggle || !selectedSkill) return;
    const newCompletedStatus = !stepToToggle.completed;
    setLearningSteps(prevSteps =>
      prevSteps.map(s =>
        s.id === stepId ? { ...s, completed: newCompletedStatus } : s
      )
    );
    try {
      await callBackendApi(`/api/learning_steps/${stepId}/complete`, 'POST', { completed: newCompletedStatus });
      const updatedLearningSteps = learningSteps.map(s =>
        s.id === stepId ? { ...s, completed: newCompletedStatus } : s
      );
      const completedCount = updatedLearningSteps.filter(s => s.completed).length;
      const totalCount = updatedLearningSteps.length;
      const newSkillProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      await callBackendApi(`/api/skills/${selectedSkill.id}`, 'PUT', { progress: newSkillProgress });
      setSkills(prevSkills =>
        prevSkills.map(s =>
          s.id === selectedSkill.id ? { ...s, progress: newSkillProgress, lastUpdated: new Date().toISOString().split('T')[0] } : s
        )
      );
    } catch (error: any) {
      console.error(`Failed to toggle step ${stepId} or update skill progress:`, error);
      setLearningSteps(prevSteps =>
        prevSteps.map(s =>
          s.id === stepId ? { ...s, completed: !newCompletedStatus } : s
        )
      );
      alert(`Failed to update learning step or skill progress: ${error.message}`);
    }
  }, [learningSteps, selectedSkill, callBackendApi, setSkills]);

  // --- Initial Skill Loading from Backend ---
  const fetchSkills = useCallback(async () => {
    setIsInitialSkillsLoading(true);
    try {
      const data = await callBackendApi('/api/skills');
      if (data && Array.isArray(data)) {
        setSkills(data.map((skill: any) => ({
          ...skill,
          lastUpdated: skill.lastUpdated || skill.last_updated,
          id: String(skill.id),
          timeline: skill.timeline || '',
          priority: skill.priority || '',
          weeklyHours: skill.weeklyHours || skill.weekly_hours || 0,
          strategy: skill.strategy || ''
        })));
      } else {
        setSkills([]);
      }
    } catch (error: any) {
      console.error("Failed to fetch skills:", error);
      setSkills([]);
      setSearchError(`Failed to load your skills: ${error.message}. Please try generating new skills.`);
    } finally {
      setIsInitialSkillsLoading(false);
    }
  }, [callBackendApi]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Handle navigation from RoadmapMentor via location state
  useEffect(() => {
    if (!isInitialSkillsLoading && skills.length > 0 && location.state?.subjectNameForSkill) {
      const subjectName = location.state.subjectNameForSkill;
      navigate(location.pathname, { replace: true, state: {} });

      const existingSkill = skills.find(s => s.name.toLowerCase() === subjectName.toLowerCase());

      if (existingSkill) {
        setSelectedSkill(existingSkill);
        setActiveTab('learning');
        fetchLearningPath(existingSkill.id, existingSkill.name, existingSkill.level);
        setSuggestedNewSkill(null);
        setNewSkillSearchTerm('');
        setSearchError(null);
      } else {
        setNewSkillSearchTerm(subjectName);
        setIsAddingSkillFromRoadmap(true);
        handleSearchNewSkill(null, subjectName);
        setActiveTab('skills');
      }
    }
  }, [location.state, location.pathname, navigate, skills, isInitialSkillsLoading, fetchLearningPath, handleSearchNewSkill]);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'beginner': return 'level-beginner';
      case 'intermediate': return 'level-intermediate';
      case 'advanced': return 'level-advanced';
      default: return '';
    }
  };

  const filterExistingSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(filterMySkillsTerm.toLowerCase()) ||
    skill.category.toLowerCase().includes(filterMySkillsTerm.toLowerCase())
  );

  // --- Missing Function Stub ---
  const generateAndSaveInitialSkills = useCallback(async () => {
    setIsInitialSkillsLoading(true);
    // Stub implementation to fix build error. 
    // Ideally this should use the AI to generate skills like handleSearchNewSkill but for initial setup.
    try {
      const prompt = `Generate 5 diverse, high-value technical skills for a full-stack developer. 
        Respond ONLY with a JSON array of 5 skill objects (name, category, level='beginner', progress=0, timeline='Ongoing', priority='High', weeklyHours=5, strategy='...').`;

      const aiResponse = await callBackendApi('/api/ai/generate_skills', 'POST', { category_hint: 'general', prompt: prompt }, true);
      if (aiResponse && aiResponse.skills) {
        await callBackendApi('/api/skills/batch', 'POST', aiResponse.skills);
        await fetchSkills();
      }
    } catch (e: any) {
      console.error("Error generating initial skills:", e);
      setSearchError("Failed to generate initial skills: " + e.message);
    } finally {
      setIsInitialSkillsLoading(false);
    }
  }, [callBackendApi, fetchSkills]);

  return (
    <div className="skill-center-container">
      <header className="skill-center-header">
        <div className="header-content">
          <h1>🎯 Skill Center</h1>
          <p>Track your progress, explore new skills, and get personalized learning paths.</p>
        </div>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'skills' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('skills');
              setSelectedSkill(null);
            }}
          >
            My Skills
          </button>
          <button
            className={`nav-tab ${activeTab === 'learning' ? 'active' : ''}`}
            onClick={() => setActiveTab('learning')}
            disabled={!selectedSkill && !isLoading && learningSteps.length === 0}
          >
            Learning Path
          </button>
        </nav>
      </header>

      <div className="skill-center-content-wrapper">
        {activeTab === 'skills' && (
          <section className="skills-section">
            <div className="search-bar-container">
              <form onSubmit={handleSearchNewSkill} className="search-form">
                <input
                  type="text"
                  placeholder="Search for NEW skills to add (e.g., 'AWS Cloud', 'Rust Lang')..."
                  value={newSkillSearchTerm}
                  onChange={(e) => setNewSkillSearchTerm(e.target.value)}
                  className="search-input"
                  disabled={isSearchingNewSkill}
                />
                <button type="submit" className="search-button" disabled={isSearchingNewSkill}>
                  {isSearchingNewSkill || isAddingSkillFromRoadmap ? <Icons.Clock /> : <Icons.Search />}
                  {isSearchingNewSkill || isAddingSkillFromRoadmap ? 'Searching AI...' : 'Search AI'}
                </button>
              </form>
              {searchError && <p className="search-error">{searchError}</p>}
            </div>
            {suggestedNewSkill && (
              <div className="suggested-skill-card skill-card">
                <div className="skill-header">
                  <div className="skill-icon"><Icons.PlusCircle /></div>
                  <h3>{suggestedNewSkill.name} (Suggested by AI)</h3>
                  <span className={`skill-level-badge ${getLevelColor(suggestedNewSkill.level)}`}>
                    {suggestedNewSkill.level}
                  </span>
                </div>
                <p className="skill-description">
                  Flash AI found this skill based on your search. Add it to your tracked skills to start learning!
                </p>
                <div className="skill-actions">
                  <button className="action-btn primary" onClick={handleAddSuggestedSkill}>
                    Add Skill
                  </button>
                  <button className="action-btn secondary" onClick={() => setSuggestedNewSkill(null)}>
                    <Icons.XCircle /> Dismiss
                  </button>
                </div>
              </div>
            )}
            <h3>My Tracked Skills</h3>
            <div className="filter-bar"> {/* New filter bar for existing skills */}
              <input
                type="text"
                placeholder="Filter my existing skills..."
                value={filterMySkillsTerm}
                onChange={(e) => setFilterMySkillsTerm(e.target.value)}
                className="search-input"
                aria-label="Filter my existing skills"
              />
            </div>
            {isInitialSkillsLoading ? (
              <div className="loading-state">
                <div className="loader"></div>
                <p>Loading your skills...</p>
              </div>
            ) : (
              <div className="skills-grid">
                {filterExistingSkills.length > 0 ? ( // Display filtered existing skills
                  filterExistingSkills.map(skill => (
                    <div key={skill.id} className="skill-card">
                      <div className="skill-header">
                        <div className="skill-icon">
                          {/* Dynamic icon based on category */}
                          {skill.category.toLowerCase().includes('programming') && <Icons.Code />}
                          {skill.category.toLowerCase().includes('web dev') && <Icons.Globe />}
                          {skill.category.toLowerCase().includes('ai/ml') && <Icons.Brain />}
                          {skill.category.toLowerCase().includes('core-cs') && <Icons.BookOpen />}
                          {skill.category.toLowerCase().includes('communication') && <Icons.Target />}
                          {skill.category.toLowerCase().includes('career-prep') && <Icons.Award />}
                          {skill.category.toLowerCase().includes('devops') || skill.category.toLowerCase().includes('cloud') ? <Icons.Zap /> : null}
                          {!['programming', 'web dev', 'ai/ml', 'core-cs', 'communication', 'career-prep', 'devops', 'cloud'].some(cat => skill.category.toLowerCase().includes(cat)) && <Icons.Globe />}
                        </div>
                        <h3>{skill.name}</h3>
                        <span className={`skill-level-badge ${getLevelColor(skill.level)}`}>
                          {skill.level}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${skill.progress}%` }}></div>
                      </div>
                      <div className="skill-stats">
                        <span className="progress-text">{skill.progress}% Complete</span>
                        <span className="last-updated">Last updated: {skill.lastUpdated}</span>
                      </div>
                      <div className="skill-actions">
                        <button
                          className="action-btn primary"
                          onClick={() => startLearning(skill)} // Call startLearning directly
                          disabled={isLoading} // Disable if learning path is already generating
                        >
                          {isLoading && selectedSkill?.id === skill.id ? 'Generating Path...' : '📖 Start/Continue Learning'}
                        </button>
                        <div className="progress-controls">
                          <button
                            className="progress-btn decrease"
                            onClick={() => updateSkillProgress(skill.id, skill.progress - 10)}
                            disabled={isLoading}
                          >
                            -10%
                          </button>
                          <button
                            className="progress-btn increase"
                            onClick={() => updateSkillProgress(skill.id, skill.progress + 10)}
                            disabled={isLoading}
                          >
                            +10%
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">🤔</div>
                    <h3>{filterMySkillsTerm ? `No skills found matching "${filterMySkillsTerm}".` : "No skills added yet."}</h3>
                    <p>Try searching for a new skill above, or generate an initial set of skills.</p>
                    <button
                      className="action-btn primary"
                      onClick={generateAndSaveInitialSkills}
                      disabled={isLoading || isSearchingNewSkill || isInitialSkillsLoading}
                    >
                      {isInitialSkillsLoading ? 'Generating Initial...' : '✨ Generate My Skills (AI)'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'learning' && (
          <div className="learning-section">
            {selectedSkill ? (
              <>
                <div className="learning-header">
                  <h2>🧠 Learning Path: <span className="skill-name-highlight">{selectedSkill.name}</span></h2>
                  <div className="skill-info">
                    <span className={`level-badge ${getLevelColor(selectedSkill.level)}`}>
                      {selectedSkill.level}
                    </span>
                    <span className="progress-info">
                      Progress: {selectedSkill.progress}%
                    </span>
                  </div>
                </div>

                {/* AI Guidance Display for the overall learning path */}
                {overallAiGuidance && (
                  <div className="ai-response">
                    <div className="ai-header">
                      <span className="ai-icon">🤖</span>
                      <span>Flash AI Guidance</span>
                    </div>
                    <div className="ai-content">
                      {isLoading && overallAiGuidance.includes('crafting your personalized learning roadmap') ? (
                        <div className="loading-message">
                          <div className="typing-indicator">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                          </div>
                          <p>Flash AI is crafting your personalized roadmap...</p>
                        </div>
                      ) : (
                        <p>{overallAiGuidance}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Learning Steps */}
                <div className="learning-steps">
                  {learningSteps.length > 0 ? (
                    learningSteps.map((step, index) => (
                      <div key={step.id} className="learning-step">
                        <div className="step-header">
                          <div className="step-number">{index + 1}</div>
                          <div className="step-info">
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                          </div>
                          <button
                            className="step-action"
                            onClick={() => requestAiExplanation(step)}
                            disabled={stepLoadingId === step.id || isLoading} // Disable if this specific step is loading OR if a general AI call is active
                          >
                            {stepLoadingId === step.id ? 'Getting Help...' : '🤖 Get AI Help'}
                          </button>
                        </div>

                        {step.aiExplanation && (
                          <div className="step-explanation">
                            <div className="explanation-header">💡 AI Explanation:</div>
                            <p>{step.aiExplanation}</p>
                          </div>
                        )}

                        <div className="step-resources">
                          <div className="resources-header">📚 Resources:</div>
                          <div className="resources-list">
                            {step.resources.map((resource, idx) => (
                              <span key={idx} className="resource-tag">{resource}</span>
                            ))}
                          </div>
                        </div>

                        <div className="step-actions">
                          <button
                            className={`complete-btn ${step.completed ? 'completed' : ''}`}
                            onClick={() => toggleLearningStep(step.id)}
                          >
                            {step.completed ? '✅ Completed' : '⭕ Mark Complete'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">🤔</div>
                      <h3>No learning steps available.</h3>
                      <p>
                        {isLoading && overallAiGuidance.includes('crafting')
                          ? 'Flash AI is still generating your roadmap. This might take a moment.'
                          : (overallAiGuidance || 'Select a skill from "My Skills" to generate a personalized learning path!')
                        }
                      </p>
                      {selectedSkill && ( // Only show generate button if a skill is selected and no steps exist
                        <button className="action-btn primary" onClick={() => startLearning(selectedSkill)} disabled={isLoading}>
                          {isLoading ? 'Generating...' : 'Generate Learning Path'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="no-skill-selected">
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <h3>Select a skill to start learning</h3>
                  <p>Go to "My Skills" tab and click "Start/Continue Learning" on any skill.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillCenter;