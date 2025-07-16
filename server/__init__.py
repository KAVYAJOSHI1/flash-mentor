import os
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime
import logging
import google.api_core.exceptions
import uuid # For generating UUIDs for skill and learning step IDs
import json # Import json module
import re # NEW: Import regex module for stripping markdown

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize extensions outside of the factory, but without app binding initially
db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    # Configure CORS to allow requests from any origin (for development)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # ===========================================================================
    # Configuration for Flask and Database
    # ===========================================================================
    # Construct an absolute path for the SQLite database
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    db_path = os.path.join(project_root, 'flash_mentor.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a_default_secret_key_if_not_set_securely') # Added a secret key

    # Bind extensions to the app within the factory
    db.init_app(app)
    migrate.init_app(app, db)

    # ===========================================================================
    # Configuration for Gemini API
    # ===========================================================================
    # --- IMPORTANT: Replace "YOUR_ACTUAL_GEMINI_API_KEY_GOES_HERE" with your key ---
    GEMINI_API_KEY: str = "AIzaSyCB1pReRNIWwuZ-cWRgcnOhych-PFS2kdQ" # Your API key hardcoded
    
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_ACTUAL_GEMINI_API_KEY_GOES_HERE":
        logger.warning("🚨 WARNING: Gemini API key is not set. Gemini AI functionality will be limited or unavailable. Please update GEMINI_API_KEY in server/__init__.py")
    else:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            logger.info("✅ Gemini API configured successfully.")
        except Exception as e:
            logger.error(f"❌ Failed to configure Gemini API: {e}")

    # Define a system instruction that differentiates behavior
    # This system instruction will be applied *conditionally* or refined based on request type
    DEFAULT_SYSTEM_INSTRUCTION = """
    You are Flash, a highly intelligent and encouraging mentor. Provide concise, accurate, and actionable advice in a supportive tone. 
    Keep responses to a maximum of 3-4 sentences. Focus on problem-solving and positive reinforcement. 
    If a query is unclear or outside your scope, politely ask for clarification or state your limitations. 
    Avoid giving medical, legal, or financial advice. Ensure your responses are helpful and do not generate harmful or inappropriate content.
    For general chat queries, respond with direct text.
    """

    # This system instruction is for the Tech Radar, which is a specific AI generation task
    TECH_RADAR_SYSTEM_INSTRUCTION = """
    You are Flash, an AI specialized in generating tech news for a 'Tech Radar'.
    Your task is to provide a list of 5 recent and relevant tech news articles.
    For each article, extract the following information:
    - **headline**: A concise and engaging title of the news article.
    - **source**: The origin of the news (e.g., TechCrunch, The Verge, official company blog).
    - **category**: The main tech category it belongs to (e.g., AI, Cybersecurity, Quantum Computing, Space, Web Development, Hardware, Software, Biotech).
    - **aiInsight**: A brief (1-2 sentence) insightful comment or analysis from your perspective on the article's importance or implication.
    
    Format your response strictly as a JSON array of objects. Each object should represent one news article.
    Example JSON structure for a single article:
    {
        "headline": "Example Headline",
        "source": "Example Source",
        "category": "Example Category",
        "aiInsight": "This is an example AI insight."
    }
    Ensure the JSON is valid and can be directly parsed. Do NOT include any conversational text outside the JSON.
    """

    flash_model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=DEFAULT_SYSTEM_INSTRUCTION 
    )

    # In-memory chat history for active sessions. Used for maintaining Gemini chat state for /flash endpoint.
    chat_sessions = {}

    # ===========================================================================
    # Database Models (Defined within create_app after db.init_app(app))
    # ===========================================================================

    class ChatHistory(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        session_id = db.Column(db.String(255), nullable=False, index=True)
        role = db.Column(db.String(50), nullable=False) # 'user' or 'model'
        content = db.Column(db.Text, nullable=False)
        timestamp = db.Column(db.DateTime, default=datetime.utcnow)

        def __repr__(self):
            return f"<ChatHistory {self.id} {self.role} Session:{self.session_id}>"

        def to_dict(self):
            return {
                'id': self.id,
                'session_id': self.session_id,
                'role': self.role,
                'content': self.content,
                'timestamp': self.timestamp.isoformat()
            }

    class Flashcard(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        question = db.Column(db.Text, nullable=False)
        answer = db.Column(db.Text, nullable=False)
        category = db.Column(db.String(100), nullable=True)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)

        sessions = db.relationship('LearningSession', backref='flashcard', lazy=True, cascade="all, delete-orphan")

        def __repr__(self):
            return f'<Flashcard {self.question}>'

        def to_dict(self):
            return {
                'id': self.id,
                'question': self.question,
                'answer': self.answer,
                'category': self.category,
                'created_at': self.created_at.isoformat()
            }

    class LearningSession(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, nullable=False) # User ID, for simplicity, could be fixed or random for now
        flashcard_id = db.Column(db.Integer, db.ForeignKey('flashcard.id'), nullable=True) # Made nullable as sessions might not always link to a specific flashcard (e.g., interview session)
        timestamp = db.Column(db.DateTime, default=datetime.utcnow)
        correct = db.Column(db.Boolean, nullable=True) # Made nullable as it might not apply to all session types
        session_type = db.Column(db.String(100), nullable=False) # e.g., 'interview', 'vocabulary_practice'
        score = db.Column(db.Integer, nullable=True) # Score for interviews
        feedback = db.Column(db.Text, nullable=True) # Overall feedback for interviews
        questions_data = db.Column(db.Text, nullable=True) # Store questions as JSON string
        answers_data = db.Column(db.Text, nullable=True) # Store answers as JSON string


        # flashcard relationship is already set via backref in Flashcard model

        def __repr__(self):
            return f'<LearningSession {self.id} User:{self.user_id} Type:{self.session_type}>'

        def to_dict(self):
            questions = json.loads(self.questions_data) if self.questions_data else []
            answers = json.loads(self.answers_data) if self.answers_data else []
            return {
                'id': self.id,
                'user_id': self.user_id,
                'flashcard_id': self.flashcard_id,
                'timestamp': self.timestamp.isoformat(),
                'correct': self.correct,
                'type': self.session_type, # Frontend expects 'type'
                'score': self.score,
                'feedback': self.feedback,
                'questions': questions,
                'answers': answers
            }

    class Skill(db.Model):
        id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        name = db.Column(db.String(255), nullable=False)
        category = db.Column(db.String(100), nullable=True)
        level = db.Column(db.String(50), nullable=True)
        progress = db.Column(db.Integer, default=0)
        last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
        # New fields for RoadmapMentor integration
        timeline = db.Column(db.String(255), nullable=True)
        priority = db.Column(db.String(50), nullable=True)
        weekly_hours = db.Column(db.Integer, nullable=True)
        strategy = db.Column(db.Text, nullable=True)


        learning_steps = db.relationship('LearningStep', backref='skill', lazy=True, cascade="all, delete-orphan")

        def __repr__(self):
            return f"<Skill {self.id}: {self.name} ({self.level}) - {self.progress}%>"

        def to_dict(self):
            return {
                'id': self.id,
                'name': self.name,
                'category': self.category,
                'level': self.level,
                'progress': self.progress,
                'lastUpdated': self.last_updated.isoformat(), # Corrected to camelCase
                'timeline': self.timeline,
                'priority': self.priority,
                'weeklyHours': self.weekly_hours, # Corrected to camelCase
                'strategy': self.strategy
            }

    class LearningStep(db.Model):
        id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        skill_id = db.Column(db.String(36), db.ForeignKey('skill.id'), nullable=False)
        title = db.Column(db.String(255), nullable=False)
        description = db.Column(db.Text, nullable=True)
        resources = db.Column(db.Text, nullable=True) # Stored as JSON string
        completed = db.Column(db.Boolean, default=False)
        order = db.Column(db.Integer, nullable=False, server_default='0') # Added order column with default
        ai_explanation = db.Column(db.Text, nullable=True) # NEW FIELD: for AI-generated explanation of the step
        created_at = db.Column(db.DateTime, default=datetime.utcnow) # Added created_at for consistency

        def __repr__(self):
            return f"<LearningStep {self.id}: {self.title} (Skill:{self.skill_id}) - {'Completed' if self.completed else 'Pending'}>"

        def to_dict(self):
            return {
                'id': self.id,
                'skillId': self.skill_id, # Corrected to camelCase
                'order': self.order, # Added order
                'title': self.title,
                'description': self.description,
                'resources': json.loads(self.resources) if self.resources else [], # Deserialize JSON string to list
                'completed': self.completed,
                'aiExplanation': self.ai_explanation, # NEW FIELD: Frontend expects camelCase
                'createdAt': self.created_at.isoformat()
            }


    # Create tables within the application context after app and db are initialized
    with app.app_context():
        db.create_all()
        logger.info(f"💾 Database tables checked/created at: {db_path}")

    # NEW HELPER FUNCTION: To strip markdown JSON wrappers
    def strip_markdown_json(text: str) -> str:
        # This regex looks for '```' optionally followed by 'json', then captures everything until the next '```'
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            return match.group(1).strip()
        return text.strip() # Return original text if no markdown block found

    # ===========================================================================
    # API Routes
    # ===========================================================================

    @app.route('/')
    def home():
        logger.info("Welcome to Flash Mentor Backend!")
        return jsonify({"message": "Welcome to Flash Mentor Backend!", "status": "operational"})

    @app.route('/health', methods=['GET'])
    def health_check():
        try:
            has_api_key = bool(GEMINI_API_KEY) and len(GEMINI_API_KEY.strip()) > 0
            
            if not has_api_key:
                return jsonify({
                    "status": "unhealthy",
                    "backend": "operational",
                    "gemini_api_key_status": "missing_or_empty",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "suggestion": "The GEMINI_API_KEY is missing or empty in app.py. Please ensure it's set."
                }), 503

            try:
                # Test basic connectivity with a dummy request
                test_model = genai.GenerativeModel("gemini-1.5-flash")
                # Using an empty string or a simple "ping" message, and blocking safety settings for health check
                test_response = test_model.generate_content("ping", safety_settings={'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE'})
                
                if test_response.text:
                    gemini_connectivity_status = "successful"
                else:
                    gemini_connectivity_status = "no_text_response_but_connected" # Model might not always return text for "ping"

                return jsonify({
                    "status": "healthy",
                    "backend": "operational",
                    "gemini_api_key_status": "present_and_connected",
                    "gemini_connectivity": gemini_connectivity_status,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }), 200

            except Exception as gemini_error:
                logger.error(f"Gemini API connectivity test failed during health check: {gemini_error}")
                return jsonify({
                    "status": "unhealthy",
                    "backend": "operational",
                    "gemini_api_key_status": "present_but_connectivity_issue",
                    "gemini_connectivity": "failed",
                    "details": str(gemini_error),
                    "suggestion": "Gemini API key is present but could not connect to Gemini API. Check network or API key validity.",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }), 503

        except Exception as e:
            logger.exception("Backend health check failed unexpectedly.")
            return jsonify({
                "status": "error",
                "error": "Health check failed to execute due to an internal error.",
                "details": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }), 500

    @app.route('/flash', methods=['POST'])
    def chat_with_flash():
        """
        Handles general conversational chat with Flash AI.
        This endpoint saves user messages and AI responses to the ChatHistory table.
        This is the ONLY endpoint that saves to ChatHistory.
        """
        session_id = request.headers.get('X-Session-ID', 'default_session')
        user_message = request.json.get('message')

        if not user_message or not isinstance(user_message, str) or user_message.strip() == "":
            logger.warning(f"Received invalid or empty message for session {session_id}.")
            return jsonify({
                "success": False,
                "error": "Message is required and must be a non-empty string.",
                "code": "INVALID_MESSAGE_TYPE"
            }), 400

        MAX_MESSAGE_LENGTH = 4000
        trimmed_message = user_message.strip()
        if len(trimmed_message) > MAX_MESSAGE_LENGTH:
            logger.warning(f"Message too long for session {session_id}. Length: {len(trimmed_message)}")
            return jsonify({
                "success": False,
                "error": f"Message too long. Maximum {MAX_MESSAGE_LENGTH} characters allowed.",
                "code": "MESSAGE_TOO_LONG",
                "maxLength": MAX_MESSAGE_LENGTH,
                "currentLength": len(trimmed_message)
            }), 400

        logger.info(f"User chat message received for session {session_id}. Message: '{trimmed_message[:70]}{'...' if len(trimmed_message) > 70 else ''}'")

        # Load/continue chat history from DB for conversational context
        if session_id not in chat_sessions:
            logger.info(f"Creating new chat session for {session_id} from DB history.")
            history_records = ChatHistory.query.filter_by(session_id=session_id).order_by(ChatHistory.timestamp).all()
            history = []
            for record in history_records:
                role_for_gemini = 'model' if record.role == 'assistant' or record.role == 'flash' else record.role
                history.append({'role': role_for_gemini, 'parts': [{'text': record.content}]})
            
            chat_sessions[session_id] = flash_model.start_chat(history=history)
        
        chat_session = chat_sessions[session_id]

        try:
            # Save user message to DB (only for conversational chat)
            new_user_entry = ChatHistory(session_id=session_id, role='user', content=trimmed_message)
            db.session.add(new_user_entry)
            db.session.commit()
            logger.info(f"User message saved to DB for session {session_id}.")

            # Send message to Gemini
            response = chat_session.send_message(trimmed_message)
            flash_response = response.text
            logger.info(f"Flash response received for session {session_id}. Length: {len(flash_response)}.")

            # Save model response to DB (only for conversational chat)
            new_model_entry = ChatHistory(session_id=session_id, role='model', content=flash_response)
            db.session.add(new_model_entry)
            db.session.commit()
            logger.info(f"Flash response saved to DB for session {session_id}.")

            return jsonify({
                "success": True,
                "reply": flash_response,
                "metadata": {
                    "model": "gemini-1.5-flash",
                    "session_id": session_id,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
            }), 200

        except genai.types.BlockedPromptException as e:
            logger.warning(f"Prompt blocked by safety settings for session {session_id}: {e.response.prompt_feedback}")
            db.session.rollback() # Rollback user message if AI interaction fails
            return jsonify({
                "success": False,
                "error": "Your message was blocked by AI safety settings. Please try rephrasing your query.",
                "suggestion": "Please try rephrasing your query to adhere to safety guidelines.",
                "code": "PROMPT_BLOCKED",
                "details": str(e.response.prompt_feedback)
            }), 400
        except google.api_core.exceptions.ResourceExhausted as e:
            logger.error(f"Gemini API Quota Exceeded for session {session_id}: {e}")
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "Flash is experiencing high traffic or your API quota has been exhausted. Please try again in a few minutes or after some time.",
                "code": "RATE_LIMIT_EXCEEDED",
                "suggestion": "You might have exceeded your Gemini API quota (e.g., 50 requests/day for gemini-1.5-flash-free-tier). Please wait or consider upgrading your plan.",
                "details": str(e)
            }), 429
        except google.api_core.exceptions.InvalidArgument as e:
            logger.error(f"Gemini API Invalid Argument for session {session_id}: {e}")
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "Invalid input provided to the AI model. This might be an internal configuration error or an issue with the prompt.",
                "code": "INVALID_ARGUMENT",
                "details": str(e)
            }), 400
        except google.api_core.exceptions.DeadlineExceeded as e:
            logger.error(f"Gemini API Timeout for session {session_id}: {e}")
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "AI processing timed out. The model took too long to generate a response.",
                "code": "TIMEOUT",
                "suggestion": "Try simplifying your message, asking a more direct question, or try again later. If this persists, your internet connection might be unstable or Google's API is slow.",
                "details": str(e)
            }), 408
        except google.api_core.exceptions.PermissionDenied as e:
            logger.error(f"Gemini API Permission Denied (403) for session {session_id}: {e}")
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "Permission Denied: Your Gemini API key might be invalid or lacks necessary permissions.",
                "code": "PERMISSION_DENIED_API_KEY",
                "suggestion": "Double-check your API key in app.py and ensure it's correctly enabled in Google AI Studio for the Generative Language API.",
                "details": str(e)
            }), 403
        except google.api_core.exceptions.Unauthorized as e:
            logger.error(f"Gemini API Unauthorized (401) for session {session_id}: {e}")
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "Unauthorized: Invalid or missing Gemini API Key. Please check the key in app.py.",
                "code": "UNAUTHORIZED_API_KEY",
                "suggestion": "The API key provided is not valid. Please ensure it's correct and enabled for the Generative Language API. Remember that hardcoding keys is not recommended for production.",
                "details": str(e)
            }), 401
        except google.api_core.exceptions.ServiceUnavailable as e:
            logger.error(f"Gemini API Service Unavailable (503) for session {session_id}: {e}")
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "Gemini AI service is temporarily unavailable or experiencing issues.",
                "code": "SERVICE_UNAVAILABLE",
                "suggestion": "This is likely a temporary issue with Google's API. Please try again in a few minutes.",
                "details": str(e)
            }), 503
        except google.api_core.exceptions.InternalServerError as e:
            logger.error(f"Gemini API Internal Server Error (500) for session {session_id}: {e}")
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "An internal error occurred with the Gemini API. Please try again later.",
                "code": "GEMINI_API_INTERNAL_ERROR",
                "suggestion": "This is likely a temporary issue with Google's API. Try again in a few moments.",
                "details": str(e)
            }), 500
        except google.api_core.exceptions.GoogleAPIError as e:
            logger.error(f"Generic Google API Error for session {session_id}: {e}")
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "An unexpected error occurred with the Gemini API. Please try again later.",
                "code": "GEMINI_API_GENERIC_ERROR",
                "details": str(e)
            }), 500
        except Exception as e:
            logger.exception(f"An unexpected error occurred during AI interaction for session {session_id}.")
            db.session.rollback()
            return jsonify({"success": False, "error": f"An unexpected server error occurred: {str(e)}"}), 500
    
    # --- Database-related API Routes --- (These routes interact with the DB directly)

    @app.route('/api/chat', methods=['POST'])
    def add_chat_message():
        data = request.json
        if not data or 'session_id' not in data or 'role' not in data or 'content' not in data:
            return jsonify({"error": "Missing required fields (session_id, role, content)"}), 400

        try:
            new_message = ChatHistory(
                session_id=data['session_id'],
                role=data['role'],
                content=data['content']
            )
            db.session.add(new_message)
            db.session.commit()
            return jsonify(new_message.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding chat message: {e}")
            return jsonify({"error": "Failed to add chat message"}), 500

    @app.route('/api/chat/<string:session_id>', methods=['GET'])
    def get_chat_history(session_id):
        chat_messages = ChatHistory.query.filter_by(session_id=session_id).order_by(ChatHistory.timestamp).all()
        return jsonify([msg.to_dict() for msg in chat_messages]), 200

    @app.route('/api/skills', methods=['GET'])
    def get_all_skills():
        skills = Skill.query.all()
        return jsonify([skill.to_dict() for skill in skills]), 200

    @app.route('/api/skills/batch', methods=['POST'])
    def add_skills_batch():
        data = request.json
        if not isinstance(data, list):
            return jsonify({"error": "Expected a list of skills"}), 400

        added_skills = []
        for skill_data in data:
            try:
                skill = Skill(
                    id=skill_data.get('id', str(uuid.uuid4())),
                    name=skill_data['name'],
                    category=skill_data.get('category'),
                    level=skill_data.get('level'),
                    progress=skill_data.get('progress', 0),
                    last_updated=datetime.fromisoformat(skill_data['last_updated']) if 'last_updated' in skill_data else datetime.utcnow(),
                    timeline=skill_data.get('timeline'),
                    priority=skill_data.get('priority'),
                    weekly_hours=skill_data.get('weeklyHours'),
                    strategy=skill_data.get('strategy')
                )
                db.session.add(skill)
                db.session.flush()
                added_skills.append(skill)
            except KeyError as e:
                db.session.rollback()
                return jsonify({"error": f"Missing required field in skill data: {e}"}), 400
            except Exception as e:
                db.session.rollback()
                logger.error(f"Error adding skill: {e}")
                return jsonify({"error": f"Error processing skill data: {str(e)}"}), 500

        try:
            db.session.commit()
            results_to_return = []
            for skill in added_skills:
                db.session.refresh(skill) 
                results_to_return.append(skill.to_dict())

            return jsonify({"message": "Skills added successfully", "skills": results_to_return}), 201
        except Exception as e:
            db.session.rollback()
            logger.exception("Database commit failed for batch skills.")
            return jsonify({"error": f"Failed to save skills to database: {str(e)}"}), 500

    @app.route('/api/skills/<string:skill_id>', methods=['PUT'])
    def update_skill(skill_id):
        skill = Skill.query.get(skill_id)
        if not skill:
            return jsonify({"error": "Skill not found"}), 404

        data = request.json
        skill.name = data.get('name', skill.name)
        skill.category = data.get('category', skill.category)
        skill.level = data.get('level', skill.level)
        skill.progress = data.get('progress', skill.progress)
        if 'last_updated' in data:
            skill.last_updated = datetime.fromisoformat(data['last_updated'])
        
        skill.timeline = data.get('timeline', skill.timeline)
        skill.priority = data.get('priority', skill.priority)
        skill.weekly_hours = data.get('weeklyHours', skill.weekly_hours)
        skill.strategy = data.get('strategy', skill.strategy)

        try:
            db.session.commit()
            return jsonify({"message": "Skill updated successfully", "skill": skill.to_dict()}), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating skill {skill_id}: {e}")
            return jsonify({"error": f"Failed to update skill: {str(e)}"}), 500

    @app.route('/api/skills/<string:skill_id>', methods=['DELETE'])
    def delete_skill(skill_id):
        skill = Skill.query.get(skill_id)
        if not skill:
            return jsonify({"error": "Skill not found"}), 404
        
        try:
            db.session.delete(skill)
            db.session.commit()
            return jsonify({"message": "Skill deleted successfully"}), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting skill {skill_id}: {e}")
            return jsonify({"error": f"Failed to delete skill: {str(e)}"}), 500

    @app.route('/api/skills/<string:skill_id>/learning_steps', methods=['GET'])
    def get_skill_learning_steps(skill_id):
        skill = Skill.query.get(skill_id)
        if not skill:
            return jsonify({"error": "Skill not found"}), 404
        
        learning_steps = LearningStep.query.filter_by(skill_id=skill_id).order_by(LearningStep.order).all()
        return jsonify({
            "learning_steps": [step.to_dict() for step in learning_steps],
            "overall_ai_guidance": "Learning path loaded successfully." if learning_steps else "No learning steps found for this skill. Generate one!"
        }), 200
    
    @app.route('/api/learning_steps', methods=['GET'])
    def get_all_learning_steps():
        """Fetches all learning steps across all skills."""
        learning_steps = LearningStep.query.order_by(LearningStep.created_at).all()
        return jsonify([step.to_dict() for step in learning_steps]), 200


    @app.route('/api/learning_steps/batch', methods=['POST'])
    def add_learning_steps_batch():
        data = request.json
        if not isinstance(data, list):
            return jsonify({"error": "Expected a list of learning steps"}), 400

        added_steps_dicts = []
        try:
            for step_data in data:
                step_id = step_data.get('id', str(uuid.uuid4()))
                step = LearningStep(
                    id=step_id,
                    skill_id=step_data['skillId'],
                    title=step_data['title'],
                    description=step_data.get('description'),
                    resources=json.dumps(step_data.get('resources', [])),
                    completed=step_data.get('completed', False),
                    order=step_data.get('order', 0),
                    ai_explanation=step_data.get('aiExplanation')
                )
                db.session.add(step)
                db.session.flush() 
                added_steps_dicts.append(step.to_dict()) 
            
            db.session.commit()
            return jsonify({"message": "Learning steps added successfully", "learning_steps": added_steps_dicts}), 201
        except KeyError as e:
            db.session.rollback()
            return jsonify({"error": f"Missing required field in learning step: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding learning steps batch: {e}")
            return jsonify({"error": f"Error processing learning step data: {str(e)}"}), 500

    @app.route('/api/learning_steps/<string:step_id>/complete', methods=['POST'])
    def mark_learning_step_complete(step_id):
        step = LearningStep.query.get(step_id)
        if not step:
            return jsonify({"error": "Learning step not found"}), 404
        
        step.completed = True
        try:
            db.session.commit()
            
            # Recalculate skill progress
            skill = Skill.query.get(step.skill_id)
            if skill:
                total_steps = LearningStep.query.filter_by(skill_id=skill.id).count()
                completed_steps = LearningStep.query.filter_by(skill_id=skill.id, completed=True).count()
                new_progress = int((completed_steps / total_steps) * 100) if total_steps > 0 else 0
                skill.progress = new_progress
                db.session.commit()

            return jsonify({"message": "Learning step marked complete", "step": step.to_dict()}), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error marking step {step_id} complete: {e}")
            return jsonify({"error": f"Failed to mark step complete: {str(e)}"}), 500

    @app.route('/api/skills/<string:skill_id>/add_progress', methods=['POST'])
    def add_skill_progress(skill_id):
        skill = Skill.query.get(skill_id)
        if not skill:
            return jsonify({"error": "Skill not found"}), 404
        
        data = request.json
        progress_to_add = data.get('progress_to_add', 0)
        if not isinstance(progress_to_add, (int, float)) or progress_to_add < 0:
            return jsonify({"error": "Invalid progress_to_add value"}), 400
        
        skill.progress = min(100, skill.progress + progress_to_add)
        try:
            db.session.commit()
            return jsonify({"message": "Progress updated successfully", "skill": skill.to_dict()}), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding progress to skill {skill_id}: {e}")
            return jsonify({"error": f"Failed to add progress: {str(e)}"}), 500

    @app.route('/api/flashcards', methods=['GET'])
    def get_all_flashcards():
        flashcards = Flashcard.query.all()
        return jsonify([card.to_dict() for card in flashcards]), 200

    @app.route('/api/flashcards', methods=['POST'])
    def add_flashcard():
        data = request.json
        if not data or 'question' not in data or 'answer' not in data:
            return jsonify({"error": "Missing required fields (question, answer)"}), 400
        
        try:
            new_card = Flashcard(
                question=data['question'],
                answer=data['answer'],
                category=data.get('category')
            )
            db.session.add(new_card)
            db.session.commit()
            return jsonify(new_card.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding flashcard: {e}")
            return jsonify({"error": "Failed to add flashcard"}), 500

    @app.route('/api/learning_sessions', methods=['GET'])
    def get_all_learning_sessions():
        sessions = LearningSession.query.order_by(LearningSession.timestamp.desc()).all()
        return jsonify([s.to_dict() for s in sessions]), 200

    @app.route('/api/learning_sessions', methods=['POST'])
    def add_learning_session():
        data = request.json
        if not data or 'user_id' not in data or 'session_type' not in data:
            return jsonify({"error": "Missing required fields (user_id, session_type)"}), 400
        
        try:
            new_session = LearningSession(
                user_id=data['user_id'],
                flashcard_id=data.get('flashcard_id'),
                correct=data.get('correct'),
                session_type=data['session_type'],
                score=data.get('score'),
                feedback=data.get('feedback'),
                questions_data=json.dumps(data.get('questions', [])),
                answers_data=json.dumps(data.get('answers', []))
            )
            db.session.add(new_session)
            db.session.commit()
            return jsonify(new_session.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding learning session: {e}")
            return jsonify({"error": "Failed to add learning session"}), 500

    # --- AI Generation Endpoints (These DO NOT save to ChatHistory) ---

    @app.route('/api/ai/generate_skills', methods=['POST'])
    def ai_generate_skills():
        """
        Generates a list of skills using AI and returns them.
        Frontend is responsible for saving to Skill table (e.g., via /api/skills/batch).
        """
        data = request.json
        category_hint = data.get('category_hint', 'general programming or computer science')
        
        prompt = f"""
        Generate 5 diverse and relevant technical skills for a learning platform. 
        Focus on skills related to "{category_hint}".
        
        For each skill, you MUST provide the following keys with appropriate values:
        - 'name': (string) A concise and descriptive title (e.g., "Data Structures & Algorithms", "Cloud Fundamentals (AWS/Azure/GCP)").
        - 'category': (string) The main tech category (e.g., "Programming", "DevOps & Cloud", "AI/ML", "Core CS Concepts").
        - 'level': (string) The proficiency level (MUST be one of: "beginner", "intermediate", "advanced").
        - 'progress': (integer) Initial progress, always 0.
        - 'timeline': (string) A general timeframe (e.g., "July 2025 - May 2026", "Ongoing - 1hr daily").
        - 'priority': (string) Importance level (MUST be one of: "High", "Medium", "Low").
        - 'weeklyHours': (integer) Recommended hours per week (e.g., 10, 5).
        - 'strategy': (string) A brief learning strategy (2-3 sentences, e.g., "1 subject per month + PYQs").
        
        Your response MUST be a valid JSON array of exactly 5 skill objects. 
        Do NOT include any conversational text, explanations, or markdown code block delimiters (e.g., ```json```) outside the JSON array.
        Ensure all string values are properly escaped within the JSON.
        
        Example of the STRICTLY REQUIRED JSON structure for ONE skill object:
        {{
            "name": "Example Skill",
            "category": "Example Category",
            "level": "beginner",
            "progress": 0,
            "timeline": "Ongoing",
            "priority": "High",
            "weeklyHours": 5,
            "strategy": "Practice daily with mock tests."
        }}
        """
        logger.info(f"AI: Generating skills with hint: {category_hint}")
        try:
            response = flash_model.generate_content(
                prompt,
                request_options={"timeout": 120} # Added timeout
            )
            skills_json_str = strip_markdown_json(response.text) # Applied stripping
            logger.info(f"AI: Raw response for generate_skills (after strip): {skills_json_str}")
            
            skills_data = json.loads(skills_json_str)
            
            if not isinstance(skills_data, list):
                raise ValueError("AI response is not a JSON array.")

            # NEW: Validate each skill object in the list
            required_keys = ["name", "category", "level", "progress", "timeline", "priority", "weeklyHours", "strategy"]
            validated_skills = []
            for skill_obj in skills_data:
                if not isinstance(skill_obj, dict):
                    raise ValueError(f"AI response contains non-object item: {skill_obj}")
                
                for key in required_keys:
                    if key not in skill_obj:
                        raise KeyError(f"Missing required key '{key}' in AI generated skill: {skill_obj}")
                
                # Optional: Add type checks if needed, e.g., isinstance(skill_obj['progress'], int)
                # For now, just checking presence of keys.
                validated_skills.append(skill_obj) # Add to validated list if all checks pass

            # Use validated_skills instead of skills_data for the response
            return jsonify({"message": "Skills generated", "skills": validated_skills}), 200
        except json.JSONDecodeError as e:
            logger.error(f"AI: Failed to parse AI response for skills: {e}. Raw response: {skills_json_str}")
            return jsonify({"error": "AI generated malformed JSON for skills. Please try again.", "details": str(e)}), 500
        except KeyError as e:
            logger.error(f"AI: Missing key in AI generated skill data: {e}. Raw response: {skills_json_str}")
            return jsonify({"error": f"AI generated incomplete skill data: Missing key {e}. Please try again."}), 500
        except Exception as e:
            logger.exception("AI: Error generating skills.")
            return jsonify({"error": f"Failed to generate skills: {str(e)}"}), 500

    @app.route('/api/ai/generate_learning_path', methods=['POST'])
    def ai_generate_learning_path():
        """
        Generates a learning path for a skill using AI and returns it.
        Frontend is responsible for saving to LearningStep table (e.g., via /api/learning_steps/batch).
        """
        data = request.json
        skill_name = data.get('skill_name')
        skill_level = data.get('skill_level')

        if not all([skill_name, skill_level]):
            return jsonify({"error": "Missing skill_name or skill_level"}), 400

        prompt = f"""
        Generate a detailed learning roadmap for the skill "{skill_name}" at a "{skill_level}" level.
        Break it down into 5-7 logical learning steps.
        For each step, provide:
        - 'order': A numerical order for the step (starting from 1).
        - 'title': A concise title for the learning step.
        - 'description': A brief explanation of what the learner will achieve or learn in this step (2-3 sentences).
        - 'resources': A JSON array of 1-3 relevant, hypothetical resource URLs or names (e.g., ["Resource A", "Resource B"]).
        - 'completed': Always false initially.
        - 'aiExplanation': A brief (1-2 sentences) AI-generated explanation or insight for this specific step.

        Ensure the output is a JSON array of learning step objects. Do NOT include any conversational text.
        Example JSON structure for a single learning step:
        {{
            "order": 1,
            "title": "Introduction to Data Structures",
            "description": "Understand the basics of data structures and their importance.",
            "resources": ["https://www.geeksforgeeks.org/data-structures/"],
            "completed": false,
            "aiExplanation": "This foundational step is crucial for building robust algorithms."
        }}
        """
        logger.info(f"AI: Generating learning path for skill: {skill_name} ({skill_level})")
        try:
            response = flash_model.generate_content(
                prompt,
                request_options={"timeout": 120} # Added timeout
            )
            learning_path_json_str = strip_markdown_json(response.text) # Applied stripping
            logger.info(f"AI: Raw response for learning path (after strip): {learning_path_json_str}")

            learning_path_data = json.loads(learning_path_json_str)

            if not isinstance(learning_path_data, list):
                raise ValueError("AI response is not a JSON array.")

            return jsonify({
                "message": "Learning path generated", 
                "learning_steps": learning_path_data,
                "overall_ai_guidance": "Your personalized learning path has been successfully generated by Flash AI!"
            }), 200
        except json.JSONDecodeError as e:
            logger.error(f"AI: Failed to parse AI response for learning path: {e}. Raw response: {learning_path_json_str}")
            return jsonify({"error": "AI generated malformed JSON for learning path. Please try again.", "details": str(e)}), 500
        except KeyError as e:
            logger.error(f"AI: Missing key in AI generated learning path data: {e}. Raw response: {learning_path_json_str}")
            return jsonify({"error": f"AI generated incomplete learning path data: Missing key {e}. Please try again."}), 500
        except Exception as e:
            logger.exception("AI: Error generating learning path.")
            return jsonify({"error": f"Failed to generate learning path: {str(e)}"}), 500

    @app.route('/api/ai/generate_vocabulary', methods=['POST'])
    def ai_generate_vocabulary():
        """
        Generates new vocabulary words using AI and returns them.
        Frontend is responsible for saving to Flashcard table (e.g., via /api/flashcards).
        """
        data = request.json
        prompt_text = data.get('prompt', 'Generate 5 new, distinct English vocabulary words.')

        prompt = f"""
        {prompt_text} For each word, provide:
        1. The word itself.
        2. Its meaning.
        3. An example sentence demonstrating its usage.
        4. At least one synonym.
        5. At least one antonym (if applicable, otherwise state "N/A").
        
        IMPORTANT: Respond ONLY with the JSON array. Do NOT include any markdown code block delimiters (e.g., ```json```) or any other text before or after the JSON. Ensure ALL strings within the JSON are properly escaped, especially double quotes and newlines. The JSON should be valid for direct JSON.parse(). Example structure for one word:
        {{ "word": "Ephemeral", "meaning": "Lasting for a very short time.", "example": "The beauty of the cherry blossoms is ephemeral.", "synonyms": "Transient, fleeting", "antonyms": "Permanent, eternal" }}
        """
        logger.info(f"AI: Generating vocabulary with prompt: {prompt_text[:70]}...")
        try:
            response = flash_model.generate_content(
                prompt,
                request_options={"timeout": 120} # Added timeout
            )
            vocab_json_str = strip_markdown_json(response.text) # Applied stripping
            logger.info(f"AI: Raw response for generate_vocabulary (after strip): {vocab_json_str}")
            
            vocab_data = json.loads(vocab_json_str)
            
            if not isinstance(vocab_data, list):
                raise ValueError("AI response is not a JSON array.")

            return jsonify({"message": "Vocabulary generated", "vocabulary": vocab_data}), 200
        except json.JSONDecodeError as e:
            logger.error(f"AI: Failed to parse AI response for vocabulary: {e}. Raw response: {vocab_json_str}")
            return jsonify({"error": "AI generated malformed JSON for vocabulary. Please try again.", "details": str(e)}), 500
        except KeyError as e:
            logger.error(f"AI: Missing key in AI generated vocabulary data: {e}. Raw response: {vocab_json_str}")
            return jsonify({"error": f"AI generated incomplete vocabulary data: Missing key {e}. Please try again."}), 500
        except Exception as e:
            logger.exception("AI: Error generating vocabulary.")
            return jsonify({"error": f"Failed to generate vocabulary: {str(e)}"}), 500

    @app.route('/api/ai/generate_interview_questions', methods=['POST'])
    def ai_generate_interview_questions():
        """
        Generates interview questions using AI and returns them.
        Frontend is responsible for using these questions to start a LearningSession.
        """
        data = request.json
        interview_type = data.get('interview_type')
        if not interview_type:
            return jsonify({"error": "Missing interview_type"}), 400

        prompt = f"""
        Generate 5 unique, relevant, and varied {interview_type} interview questions suitable for a GATE exam preparation coaching session. For each question, provide a 'category' (e.g., "Data Structures", "Behavioral") and 'difficulty' (e.g., "Easy", "Medium", "Hard"). Ensure there is a good mix of difficulty levels. IMPORTANT: Respond ONLY with the JSON array. Do NOT include any markdown code block delimiters (e.g., ```json```) or any other text before or after the JSON. Ensure ALL strings within the JSON are properly escaped, especially double quotes and newlines. The JSON should be valid for direct JSON.parse(). Format the response as a JSON array of objects, like this: 
        [
          {{ "question": "...", "category": "...", "difficulty": "..." }},
          {{ "question": "...", "category": "...", "difficulty": "..." }}
        ]
        """
        logger.info(f"AI: Generating {interview_type} interview questions.")
        try:
            response = flash_model.generate_content(
                prompt,
                request_options={"timeout": 120} # Added timeout
            )
            questions_json_str = strip_markdown_json(response.text) # Applied stripping
            logger.info(f"AI: Raw response for interview questions (after strip): {questions_json_str}")

            questions_data = json.loads(questions_json_str)

            if not isinstance(questions_data, list):
                raise ValueError("AI response is not a JSON array.")
            
            return jsonify({"message": "Interview questions generated", "questions": questions_data}), 200
        except json.JSONDecodeError as e:
            logger.error(f"AI: Failed to parse AI response for interview questions: {e}. Raw response: {questions_json_str}")
            return jsonify({"error": "AI generated malformed JSON for questions. Please try again.", "details": str(e)}), 500
        except KeyError as e:
            logger.error(f"AI: Missing key in AI generated questions data: {e}. Raw response: {questions_json_str}")
            return jsonify({"error": f"AI generated incomplete question data: Missing key {e}. Please try again."}), 500
        except Exception as e:
            logger.exception("AI: Error generating interview questions.")
            return jsonify({"error": f"Failed to generate interview questions: {str(e)}"}), 500

    @app.route('/api/ai/generate_interview_feedback', methods=['POST'])
    def ai_generate_interview_feedback():
        """
        Generates feedback for an interview answer or overall interview using AI.
        Does NOT save to ChatHistory. Frontend will handle displaying/saving to LearningSession.
        """
        data = request.json
        prompt_text = data.get('prompt')
        if not prompt_text:
            return jsonify({"error": "Prompt text is required"}), 400
        
        # If the feedback generation needs conversational context, you would pass history here.
        # For now, assuming the prompt_text itself contains enough context.
        
        logger.info(f"AI: Generating interview feedback with prompt: {prompt_text[:100]}...")
        try:
            response = flash_model.generate_content(
                prompt_text,
                request_options={"timeout": 120} # Added timeout
            )
            feedback_text = strip_markdown_json(response.text) # Applied stripping
            logger.info(f"AI: Feedback generated (after strip): {feedback_text}")
            return jsonify({"message": "Feedback generated", "feedback": feedback_text}), 200
        except Exception as e:
            logger.exception("AI: Error generating interview feedback.")
            return jsonify({"error": f"Failed to generate interview feedback: {str(e)}"}), 500

    @app.route('/api/ai/generate_tech_news', methods=['POST'])
    def ai_generate_tech_news():
        """
        Generates tech news articles using AI and returns them.
        Uses a specific system instruction for tech news.
        Does NOT save to ChatHistory. Frontend is responsible for displaying.
        """
        data = request.json
        prompt_text = data.get('prompt', 'Generate 6 recent, relevant technology news articles.')

        # Temporarily override the model's system instruction for this specific call
        tech_news_model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=TECH_RADAR_SYSTEM_INSTRUCTION
        )
        logger.info(f"AI: Generating tech news with prompt: {prompt_text[:70]}...")
        try:
            response = tech_news_model.generate_content(
                prompt_text,
                request_options={"timeout": 120} # Added timeout
            )
            news_json_str = strip_markdown_json(response.text) # Applied stripping
            logger.info(f"AI: Raw response for generate_tech_news (after strip): {news_json_str}")
            
            news_data = json.loads(news_json_str)
            
            if not isinstance(news_data, list):
                raise ValueError("AI response is not a JSON array.")

            return jsonify({"message": "Tech news generated", "news": news_data}), 200
        except json.JSONDecodeError as e:
            logger.error(f"AI: Failed to parse AI response for tech news: {e}. Raw response: {news_json_str}")
            return jsonify({"error": "AI generated malformed JSON for tech news. Please try again.", "details": str(e)}), 500
        except KeyError as e:
            logger.error(f"AI: Missing key in AI generated tech news data: {e}. Raw response: {news_json_str}")
            return jsonify({"error": f"AI generated incomplete tech news data: Missing key {e}. Please try again."}), 500
        except Exception as e:
            logger.exception("AI: Error generating tech news.")
            return jsonify({"error": f"Failed to generate tech news: {str(e)}"}), 500


    @app.route('/api/ai/suggestion', methods=['POST'])
    def ai_suggestion():
        """
        Generates a general AI suggestion.
        Does NOT save to ChatHistory.
        """
        data = request.json
        skill_name = data.get('skill_name', 'General Learning')
        # The 'prompt' from the frontend is intentionally ignored here
        # because this endpoint is specifically for generating simple text suggestions.

        # Construct a fixed, simple prompt for a general learning suggestion.
        # This ensures the AI always returns a plain text string for this endpoint.
        fixed_suggestion_prompt = f"""
        As Flash AI, an encouraging mentor, provide a concise and actionable learning tip or motivational message (1-2 sentences) related to "{skill_name}".
        Focus on positive reinforcement and practical advice. Do NOT include any JSON, markdown, or special formatting. Just the plain text suggestion.
        """
        logger.info(f"AI: Generating simple AI suggestion for skill: {skill_name}")
        try:
            response = flash_model.generate_content(
                fixed_suggestion_prompt, # Use the fixed, simple prompt
                request_options={"timeout": 120}
            )
            # Since we explicitly ask for plain text, strip_markdown_json might not be strictly necessary
            # but it's harmless to keep it as a safeguard.
            suggestion = strip_markdown_json(response.text) 
            logger.info(f"AI: Simple suggestion generated: {suggestion}")
            return jsonify({"suggestion": suggestion}), 200
        except Exception as e:
            logger.error(f"AI: Error generating AI suggestion: {e}")
            return jsonify({"error": f"Failed to generate AI suggestion: {str(e)}"}), 500

    return app
