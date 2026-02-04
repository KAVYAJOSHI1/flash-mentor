import os
import requests
import logging
from flask import Blueprint, jsonify, request

news_bp = Blueprint('news', __name__)
logger = logging.getLogger(__name__)

NEWS_API_KEY = os.environ.get('NEWS_API_KEY')
NEWS_API_URL = "https://newsapi.org/v2/everything"

@news_bp.route('/api/news', methods=['GET'])
def get_news():
    if not NEWS_API_KEY:
        return jsonify({"error": "News API key not configured on server."}), 500

    # Default parameters, but allow overriding from client query params
    query = request.args.get('q', 'technology OR programming OR developer OR startup OR cybersecurity')
    sort_by = request.args.get('sortBy', 'publishedAt')
    language = request.args.get('language', 'en')
    
    params = {
        'q': query,
        'sortBy': sort_by,
        'language': language,
        'apiKey': NEWS_API_KEY
    }

    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        return jsonify(data), 200
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching news from NewsAPI: {e}")
        return jsonify({"error": "Failed to fetch news from external API."}), 502
