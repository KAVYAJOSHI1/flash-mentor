import React, { useState } from 'react';
import '../App.css';

const CodeOptimizer: React.FC = () => {
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleOptimize = async () => {
        if (!code.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const response = await fetch('http://localhost:5000/api/ai/optimize_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language })
            });
            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error("Optimization failed:", error);
            alert("Failed to analyze code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '20px' }}>
            <header className="page-header" style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(to right, #FFD700, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⚡ Code Booster</h1>
                <p style={{ color: '#888', fontSize: '1.2rem' }}>Analyze complexity, fix bugs, and get roasted by AI.</p>
            </header>

            <div className="optimizer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '30px' }}>
                <div className="input-section card" style={{ padding: '25px', background: '#1a1a1a', borderRadius: '16px', border: '1px solid #333', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="controls" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            style={{
                                padding: '10px 15px',
                                borderRadius: '8px',
                                border: '1px solid #444',
                                background: '#2a2a2a',
                                color: '#fff',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="javascript">JavaScript / TypeScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="cpp">C++</option>
                        </select>
                        <button
                            onClick={handleOptimize}
                            disabled={loading || !code.trim()}
                            className="primary-button"
                            style={{
                                background: loading ? '#555' : 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                color: '#000',
                                fontWeight: 'bold',
                                padding: '10px 25px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'transform 0.2s',
                                boxShadow: loading ? 'none' : '0 4px 15px rgba(255, 215, 0, 0.3)'
                            }}
                            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.05)')}
                            onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
                        >
                            {loading ? 'Analyzing...' : '🔥 Roast & Optimize'}
                        </button>
                    </div>
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Paste your code here..."
                        style={{
                            width: '100%',
                            flexGrow: 1,
                            minHeight: '500px',
                            padding: '20px',
                            borderRadius: '12px',
                            background: '#0f0f0f',
                            color: '#00ff9d',
                            fontFamily: 'Fira Code, monospace',
                            border: '1px solid #333',
                            resize: 'none',
                            outline: 'none',
                            fontSize: '14px',
                            lineHeight: '1.6'
                        }}
                    />
                </div>

                <div className="output-section" style={{ height: '100%' }}>
                    {result ? (
                        <div className="results-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                            <div className="stats-card card" style={{ padding: '25px', display: 'flex', gap: '30px', background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', borderRadius: '16px', border: '1px solid #333' }}>
                                <div className="stat">
                                    <h3 style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Time Complexity</h3>
                                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00ccff', textShadow: '0 0 10px rgba(0, 204, 255, 0.3)' }}>{result.timeComplexity}</span>
                                </div>
                                <div className="stat" style={{ borderLeft: '1px solid #444', paddingLeft: '30px' }}>
                                    <h3 style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Space Complexity</h3>
                                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#db00ff', textShadow: '0 0 10px rgba(219, 0, 255, 0.3)' }}>{result.spaceComplexity}</span>
                                </div>
                            </div>

                            <div className="critique-card card" style={{ padding: '25px', borderLeft: '5px solid #ff4444', background: '#1a1a1a', borderRadius: '0 16px 16px 0', border: '1px solid #333', borderLeftColor: '#ff4444' }}>
                                <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>AI Roast 🤖 <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'normal' }}>(Emotional Damage)</span></h3>
                                <p style={{ fontStyle: 'italic', color: '#e0e0e0', lineHeight: '1.6', fontSize: '1.1rem' }}>"{result.critique}"</p>
                            </div>

                            <div className="code-card card" style={{ padding: '25px', background: '#1a1a1a', borderRadius: '16px', border: '1px solid #333', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ marginBottom: '15px', color: '#ffd700' }}>✨ Optimized Version</h3>
                                <pre style={{
                                    background: '#0f0f0f',
                                    padding: '20px',
                                    borderRadius: '12px',
                                    overflowX: 'auto',
                                    color: '#ffff00',
                                    border: '1px solid #333',
                                    flexGrow: 1,
                                    margin: 0,
                                    fontFamily: 'Fira Code, monospace',
                                    fontSize: '14px',
                                    lineHeight: '1.6'
                                }}>
                                    <code>{result.optimizedCode}</code>
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state card" style={{ height: '100%', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666', background: '#1a1a1a', borderRadius: '16px', border: '1px dashed #444' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.5 }}>⚡</div>
                            <p style={{ fontSize: '1.2rem' }}>{loading ? 'Crunching numbers & judging your code...' : 'Paste logic to unlock performance.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CodeOptimizer;
