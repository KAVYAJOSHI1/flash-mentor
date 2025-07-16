import React, { useState, useEffect, useCallback } from 'react';
import './TechRadar.css'; // The CSS file remains the same

// --- NEW: Configuration for News API ---
const NEWS_API_KEY = '5df57fc852c44866b24b01f2b5a725ad';
// We'll search for broad technology terms. `sortBy=publishedAt` ensures we get the latest.
const NEWS_API_URL = `https://newsapi.org/v2/everything?q=technology OR programming OR developer OR startup OR cybersecurity&sortBy=publishedAt&language=en&apiKey=${NEWS_API_KEY}`;

// --- UPDATED: NewsArticle Interface ---
// Removed `aiInsight` as it's no longer generated.
interface NewsArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  category: string;
  tags: string[];
  date: string;
  url: string;
}

// --- Helper function to format date from ISO string to a user-friendly format ---
const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    // Check if it was within the last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    if (date > oneWeekAgo) {
        return 'This Week';
    }
    // Fallback for older dates
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// --- Helper function to categorize news based on keywords ---
const getCategoryAndTags = (title: string, description: string): { category: string, tags: string[] } => {
    const content = (`${title} ${description}`).toLowerCase();
    
    if (/\b(ai|artificial intelligence|machine learning|llm|openai|gemini)\b/.test(content)) {
        return { category: 'AI & ML', tags: ['AI', 'ML'] };
    }
    if (/\b(react|angular|vue|javascript|typescript|web dev|app dev|node.js)\b/.test(content)) {
        return { category: 'Web & App Dev', tags: ['WebDev', 'AppDev'] };
    }
    // --- FIXED: Escaped the forward slash in "ci/cd" ---
    if (/\b(devops|docker|kubernetes|ci\/cd|automation|terraform)\b/.test(content)) {
        return { category: 'DevOps & Tools', tags: ['DevOps', 'Tools'] };
    }
    if (/\b(cybersecurity|breach|malware|phishing|ransomware|security)\b/.test(content)) {
        return { category: 'Cybersecurity', tags: ['Security', 'Cyber'] };
    }
    if (/\b(startup|funding|venture|acquisition|ipo)\b/.test(content)) {
        return { category: 'Startups & Industry', tags: ['Startups', 'Business'] };
    }

    return { category: 'Startups & Industry', tags: ['Tech', 'News'] }; // Default category
};


export default function TechRadar() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [newsData, setNewsData] = useState<NewsArticle[]>([]);
  const [savedNews, setSavedNews] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    { id: 'all', name: 'All News', icon: '📰' },
    { id: 'AI & ML', name: 'AI & ML', icon: '🤖' },
    { id: 'Web & App Dev', name: 'Web & App Dev', icon: '💻' },
    { id: 'DevOps & Tools', name: 'DevOps & Tools', icon: '🔧' },
    { id: 'Startups & Industry', name: 'Startups & Industry', icon: '🚀' },
    { id: 'Cybersecurity', name: 'Cybersecurity', icon: '🔒' }
  ];

  // --- REWRITTEN: Function to fetch news from the News API ---
  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(NEWS_API_URL);
      if (!response.ok) {
        // News API provides error messages in the response body
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      
      const data = await response.json();

      // Filter out articles that don't have essential content
      const validArticles = data.articles.filter(
        (article: any) => article.title && article.description && article.url && article.source.name
      );

      // Map the API response to our NewsArticle interface
      const formattedNews: NewsArticle[] = validArticles.map((article: any, index: number) => {
        const { category, tags } = getCategoryAndTags(article.title, article.description);
        return {
          id: index, // Use index as a simple unique ID for rendering
          headline: article.title,
          summary: article.description,
          source: article.source.name,
          url: article.url,
          date: formatDate(article.publishedAt),
          category: category,
          tags: tags,
        };
      });

      setNewsData(formattedNews);

    } catch (err: any) {
      console.error("Error fetching news from News API:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to load news. ${errorMessage}`);
      setNewsData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch news on initial component mount
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const filteredNews: NewsArticle[] = selectedCategory === 'all'
    ? newsData
    : newsData.filter(news => news.category === selectedCategory);

  const toggleSaved = useCallback((newsId: number) => {
    setSavedNews(prev =>
      prev.includes(newsId)
        ? prev.filter(id => id !== newsId)
        : [...prev, newsId]
    );
  }, []);

  // The refresh function now calls our new fetchNews function
  const refreshNews = useCallback(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    <main className="tech-radar-container">
      <section className="tech-radar-wrapper">
        <header className="tech-radar-header">
          <div>
            <h1 className="tech-radar-title">🚀 Tech Radar</h1>
            <p className="tech-radar-subtitle">
              Stay ahead with the latest updates from the tech world
            </p>
          </div>
          <button 
            className="sync-button" 
            onClick={refreshNews} 
            disabled={isLoading}
            aria-label={isLoading ? 'Syncing news...' : 'Sync now to refresh news'}
          >
            {isLoading ? 'Syncing...' : 'Sync Now'}
          </button>
        </header>

        <nav className="category-filter" aria-label="News Categories">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-button ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
              aria-pressed={selectedCategory === category.id}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </nav>

        <div className="news-grid">
          {error && (
            <div className="error-message">
              <h3>{error}</h3>
              <p>This could be due to an invalid API key, network issues, or reaching the API rate limit. Please check the console for more details.</p>
            </div>
          )}

          {isLoading ? (
            // Skeleton loading remains the same
            Array.from({ length: 6 }).map((_, index) => (
              <article key={index} className="news-card skeleton-card">
                <div className="skeleton-header">
                  <div className="skeleton-line-small"></div>
                  <div className="skeleton-line-small"></div>
                </div>
                <div className="skeleton-line-large"></div>
                <div className="skeleton-line-medium"></div>
                <div className="skeleton-tags">
                  <div className="skeleton-tag"></div>
                  <div className="skeleton-tag"></div>
                </div>
                <div className="skeleton-ai-insight">
                  <div className="skeleton-line-small"></div>
                  <div className="skeleton-line-medium"></div>
                </div>
              </article>
            ))
          ) : filteredNews.length > 0 ? (
            filteredNews.map(news => (
              <article 
                key={news.id}
                className="news-card" 
                onClick={() => window.open(news.url, '_blank', 'noopener,noreferrer')}
                style={{ cursor: 'pointer' }}
              >
                <header className="news-header">
                  <div className="news-meta">
                    <span className={`date-badge ${news.date.toLowerCase().replace(/\s+/g, '-')}`}>{news.date}</span>
                    <span className="news-source">{news.source}</span>
                  </div>
                  <button
                    className={`save-button ${savedNews.includes(news.id) ? 'saved' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleSaved(news.id); }} 
                    aria-label={savedNews.includes(news.id) ? 'Unsave this article' : 'Save this article'}
                  >
                    {savedNews.includes(news.id) ? '★' : '☆'}
                  </button>
                </header>
                <h3 className="news-headline">{news.headline}</h3>
                <p className="news-summary">{news.summary}</p>
                <footer className="news-tags">
                  {news.tags.map(tag => (
                    <span key={tag} className="news-tag">#{tag}</span>
                  ))}
                </footer>
                {/* --- REMOVED: AI Insight section is no longer needed --- */}
              </article>
            ))
          ) : (
            <div className="empty-state">
              <span className="empty-icon">😔</span>
              <h3>No news found in this category.</h3>
              <p>Try selecting a different category or syncing for new updates.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
