import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import RoadmapMentor from "./pages/RoadmapMentor";
import SkillCenter from "./pages/SkillCenter";
import CommunicationCoach from "./pages/CommunicationCoach";
import TechRadar from "./pages/TechRadar";
import FlashAssistantButton from "./components/FlashAssistantButton";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 text-gray-900">
        <Navbar />

        <main className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/roadmap" element={<RoadmapMentor />} />
            <Route path="/skills" element={<SkillCenter />} />
            <Route path="/communication" element={<CommunicationCoach />} />
            <Route path="/tech" element={<TechRadar />} />
          </Routes>
        </main>

        <FlashAssistantButton />
      </div>
    </Router>
  );
}

export default App;
