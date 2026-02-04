# ⚡ Flash Mentor - AI-Powered Learning Assistant

**Flash Mentor** is an intelligent, personalized learning assistant designed to help students and professionals master technical skills, prepare for exams (like GATE), and stay updated with the latest tech trends. It combines roadmap tracking, AI-powered guidance, and productivity tools into a unified dashboard.

## 🚀 Features

### 🎓 Roadmap Mentor
*   **Structured Learning Paths**: Pre-built roadmaps for GATE CSE, DSA Mastery, AI/ML Service, Full Stack Development, and more.
*   **Progress Tracking**: Visualize your journey with detailed progress bars for each track and subject.
*   **Milestone Tracking**: Keep track of key dates and goals (e.g., "Foundation Complete", "Industry Ready").
*   **Study Timer**: Built-in focus timer to track your daily study sessions.

### 🤖 AI Companion ("Flash")
*   **Contextual Chat**: Integrated AI chat to ask questions, get explanations, or seek advice.
*   **Powered by Groq & Gemini**: Leverages advanced LLMs (Llama via Groq, Gemini Flash) for fast and accurate responses.
*   **Smart Suggestions**: Dynamic recommendations based on your current progress (e.g., "Focus on Dynamic Programming this week").

### 📰 Tech Radar
*   **Tech News Aggregator**: Stay ahead with curated tech news classified into categories like AI & ML, Web Dev, DevOps, and Startups.
*   **Smart Filtering**: Filter news by category to focus on what matters to you.

### 📝 Productivity Tools
*   **Weekly Task Planner**: Organize your week with actionable tasks.
*   **Quick Capture Notes**: Jot down ideas or concepts instantly without leaving the dashboard.
*   **Motivation**: Daily motivational quotes to keep you inspired.

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React (Vite)
*   **Language**: TypeScript
*   **Styling**: Custom CSS / Module CSS
*   **Key Libraries**: `react-router-dom`, `lucide-react` (icons)

### Backend
*   **Framework**: Flask (Python)
*   **Database**: SQLite (via SQLAlchemy)
*   **AI Integration**: `groq`, `google-generativeai`
*   **Tools**: `flask-cors`, `flask-migrate`

## ⚙️ Installation & Setup

Follow these steps to run the project locally.

### Prerequisites
*   Node.js (v18+)
*   Python (v3.10+)
*   Git

### 1. Clone the Repository
```bash
git clone https://github.com/KAVYAJOSHI1/flash-mentor.git
cd flash-mentor
```

### 2. Backend Setup
Navigate to the server directory and set up the Python environment.

```bash
cd server

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Configuration**:
Create a `.env` file in the `server` directory and add your API keys:
```env
# server/.env
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_google_gemini_api_key_here
SECRET_KEY=your_secret_key
```

**Run the Server**:
```bash
python run.py
```
The backend will start at `http://localhost:5000`.

### 3. Frontend Setup
Open a new terminal and navigate to the client directory.

```bash
cd client/flash-client

# Install dependencies
npm install

# Run the development server
npm run dev
```
The frontend will start at `http://localhost:5173` (or the port shown in your terminal).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.
