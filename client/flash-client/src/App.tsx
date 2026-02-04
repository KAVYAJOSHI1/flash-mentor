import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import RoadmapMentor from "./pages/RoadmapMentor";
import SkillCenter from "./pages/SkillCenter";
import CommunicationCoach from "./pages/CommunicationCoach";
import TechRadar from "./pages/TechRadar";
import CodeOptimizer from "./pages/CodeOptimizer";
import ResumeAnalyzer from "./pages/ResumeAnalyzer";
import FlashAssistantButton from "./components/FlashAssistantButton";
import { FlashProvider } from "./contexts/FlashContext";

function App() {
  return (
    <FlashProvider>
      <Router>
        <div className="min-h-screen bg-gray-100 text-gray-900">
          <Navbar />

          <main className="pt-16 w-full">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/roadmap" element={<RoadmapMentor />} />
              <Route path="/skills" element={<SkillCenter />} />
              <Route path="/communication" element={<CommunicationCoach />} />
              <Route path="/tech" element={<TechRadar />} />
              <Route path="/optimize" element={<CodeOptimizer />} />
              <Route path="/resume" element={<ResumeAnalyzer />} />
            </Routes>
          </main>

          <FlashAssistantButton />
        </div>
      </Router>
    </FlashProvider>
  );
}

export default App;
