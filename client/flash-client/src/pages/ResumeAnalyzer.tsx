import React, { useState } from 'react';

const ResumeAnalyzer: React.FC = () => {
    const [resumeText, setResumeText] = useState('');
    const [targetRole, setTargetRole] = useState('Software Engineer');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleAnalyze = async () => {
        if (!resumeText.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const response = await fetch('http://localhost:5000/api/ai/analyze_resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_text: resumeText, target_role: targetRole })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setResult(data);
        } catch (error) {
            console.error("Analysis failed:", error);
            alert("Failed to analyze resume. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return '#00ff00'; // Green
        if (score >= 75) return '#ffff00'; // Yellow
        return '#ff4444'; // Red
    };

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '20px' }}>
            <header className="page-header" style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(to right, #00C6FF, #0072FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>📄 CV / Resume Scanner</h1>
                <p style={{ color: '#888', fontSize: '1.2rem' }}>Pass the ATS check before the recruiter even sees it.</p>
            </header>

            <div className="analyzer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '30px' }}>
                {/* Input Section */}
                <div className="input-section card" style={{ padding: '25px', background: '#1a1a1a', borderRadius: '16px', border: '1px solid #333', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                        <div style={{ flexGrow: 1 }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>Target Role</label>
                            <input
                                type="text"
                                value={targetRole}
                                onChange={(e) => setTargetRole(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: '#fff', outline: 'none' }}
                                placeholder="e.g. Frontend Developer"
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button
                                onClick={handleAnalyze}
                                disabled={loading || !resumeText.trim()}
                                className="primary-button"
                                style={{
                                    background: loading ? '#555' : 'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    padding: '12px 30px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    boxShadow: loading ? 'none' : '0 4px 15px rgba(0, 198, 255, 0.3)',
                                    height: '45px'
                                }}
                            >
                                {loading ? 'Scanning...' : '🔍 Analyze Resume'}
                            </button>
                        </div>
                    </div>

                    <textarea
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        placeholder="Paste your full resume text here (Ctrl+A, Ctrl+C from PDF)..."
                        style={{
                            width: '100%',
                            flexGrow: 1,
                            minHeight: '400px',
                            padding: '20px',
                            borderRadius: '12px',
                            background: '#0f0f0f',
                            color: '#ccc',
                            fontFamily: 'sans-serif',
                            border: '1px solid #333',
                            resize: 'none',
                            outline: 'none',
                            fontSize: '15px',
                            lineHeight: '1.6'
                        }}
                    />
                </div>

                {/* Output Section */}
                <div className="output-section" style={{ height: '100%' }}>
                    {result ? (
                        <div className="results-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>

                            {/* Score Card */}
                            <div className="card" style={{ padding: '30px', background: 'linear-gradient(135deg, #1e1e1e 0%, #151515 100%)', borderRadius: '16px', border: '1px solid #333', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '5px', background: getScoreColor(result.atsScore) }}></div>
                                <h3 style={{ color: '#aaa', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>ATS Compatibility Score</h3>
                                <div style={{ fontSize: '5rem', fontWeight: '800', color: getScoreColor(result.atsScore), textShadow: `0 0 20px ${getScoreColor(result.atsScore)}44` }}>
                                    {result.atsScore}<span style={{ fontSize: '2rem', color: '#555' }}>/100</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {/* Strengths */}
                                <div className="card" style={{ padding: '20px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #333' }}>
                                    <h3 style={{ color: '#00ff00', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>✅ Top Strengths</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#ddd' }}>
                                        {result.strengths.map((str: string, i: number) => (
                                            <li key={i} style={{ marginBottom: '8px' }}>{str}</li>
                                        ))}
                                    </ul>
                                </div>
                                {/* Weaknesses */}
                                <div className="card" style={{ padding: '20px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #333' }}>
                                    <h3 style={{ color: '#ff4444', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ Improvements</h3>
                                    <ul style={{ paddingLeft: '20px', color: '#ddd' }}>
                                        {result.weaknesses.map((wk: string, i: number) => (
                                            <li key={i} style={{ marginBottom: '8px' }}>{wk}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Missing Keywords */}
                            <div className="card" style={{ padding: '20px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #333' }}>
                                <h3 style={{ color: '#ffaa00', marginBottom: '15px' }}>🔑 Missing Critical Keywords</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {result.missingKeywords.map((kw: string, i: number) => (
                                        <span key={i} style={{ background: 'rgba(255, 170, 0, 0.15)', color: '#ffaa00', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', border: '1px solid rgba(255, 170, 0, 0.3)' }}>
                                            + {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Summary Rewrite */}
                            <div className="card" style={{ padding: '20px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #333', flexGrow: 1 }}>
                                <h3 style={{ color: '#00C6FF', marginBottom: '10px' }}>📝 Suggested Profile Summary</h3>
                                <p style={{ color: '#ccc', lineHeight: '1.6', fontStyle: 'italic', padding: '15px', background: '#111', borderRadius: '8px' }}>
                                    "{result.summarySuggestion}"
                                </p>
                            </div>

                        </div>
                    ) : (
                        <div className="empty-state card" style={{ height: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666', background: '#1a1a1a', borderRadius: '16px', border: '1px dashed #444' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.5 }}>📄</div>
                            <p style={{ fontSize: '1.2rem' }}>{loading ? 'Analyzing against 1,000+ job descriptions...' : 'Paste your resume to spot ability gaps.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResumeAnalyzer;
