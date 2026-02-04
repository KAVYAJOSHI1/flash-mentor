import os
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime
import logging
import google.api_core.exceptions
import uuid 
import json 
import re 
import random 
from groq import Groq 
from dotenv import load_dotenv # Import load_dotenv

# Load environment variables from .env file
load_dotenv() 

# Import blueprints
from routes.news import news_bp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    app.register_blueprint(news_bp)

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    db_path = os.path.join(project_root, 'flash_mentor.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default_secret')

    db.init_app(app)
    migrate.init_app(app, db)

    # --- AI Client Configuration ---
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    
    groq_client = None
    if GROQ_API_KEY:
        try:
            groq_client = Groq(api_key=GROQ_API_KEY)
            logger.info("✅ Groq API configured successfully.")
        except Exception as e:
            logger.error(f"❌ Failed to configure Groq API: {e}")

    if GEMINI_API_KEY:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            logger.info("✅ Gemini API configured successfully.")
        except Exception as e:
            logger.error(f"❌ Failed to configure Gemini API: {e}")

    # Helper function to generate content using available provider
    def generate_ai_content(prompt, system_instruction=None, model_type="fast"):
        """
        Tries Groq first, then Gemini. Returns the text response.
        """
        # 1. Try Groq
        if groq_client:
            try:
                # Select model based on type intent
                # Updated to use currently supported models
                model = "llama-3.3-70b-versatile" if model_type == "complex" else "llama-3.1-8b-instant"
                
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                messages.append({"role": "user", "content": prompt})

                completion = groq_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1024,
                )
                return completion.choices[0].message.content
            except Exception as e:
                logger.error(f"Groq generation failed: {e}. Falling back to Gemini.")
                logger.error (f"Debugging Groq: Key Present? {bool(groq_client.api_key)}")

        # 2. Try Gemini
        if GEMINI_API_KEY:
            try:
                model_name = "gemini-flash-latest" 
                # Note: Gemini python lib system_instruction is set at model init, 
                # but we can prepend it to prompt for single-use compatibility if needed, 
                # or just use the global flash_model if no custom system instruction.
                # For simplicity here, we'll create a lightweight model instance or prepend.
                
                final_prompt = prompt
                if system_instruction:
                    final_prompt = f"System Instruction: {system_instruction}\n\nUser Request: {prompt}"

                model = genai.GenerativeModel(model_name=model_name)
                response = model.generate_content(final_prompt, request_options={"timeout": 60})
                return response.text
            except Exception as e:
                 logger.error(f"Gemini generation failed: {e}")
                 raise e # Re-raise to trigger mock fallback in caller
        
        raise Exception("No AI providers available")

    # Keep the global flash_model for legacy routes not yet updated, but prefer helper
    # We will update the routes to use generate_ai_content

    # Define a system instruction
    DEFAULT_SYSTEM_INSTRUCTION = """
    You are Flash, a highly intelligent and encouraging mentor. Provide concise, accurate, and actionable advice in a supportive tone. 
    Keep responses to a maximum of 3-4 sentences. Focus on problem-solving and positive reinforcement. 
    If a query is unclear or outside your scope, politely ask for clarification or state your limitations. 
    Avoid giving medical, legal, or financial advice. Ensure your responses are helpful and do not generate harmful or inappropriate content.
    For general chat queries, respond with direct text.
    """
    
    TECH_RADAR_SYSTEM_INSTRUCTION = """
    You are Flash, an AI specialized in generating tech news for a 'Tech Radar'.
    Your task is to provide a list of 5 recent and relevant tech news articles.
    Format your response strictly as a JSON array of objects.
    """


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
                'weeklyHours': self.weekly_hours, # Corrected to camelCase
                'timeline': self.timeline,
                'priority': self.priority,
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
            
    # --- NEW MODELS START HERE ---
    class Note(db.Model):
        id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        content = db.Column(db.Text, nullable=False)
        timestamp = db.Column(db.DateTime, default=datetime.utcnow)

        def __repr__(self):
            return f"<Note {self.id}: {self.content[:30]}...>"

        def to_dict(self):
            return {
                'id': self.id,
                'content': self.content,
                'timestamp': self.timestamp.isoformat()
            }

    class WeeklyTask(db.Model):
        id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        description = db.Column(db.Text, nullable=False)
        completed = db.Column(db.Boolean, default=False)
        skill_id = db.Column(db.String(36), db.ForeignKey('skill.id'), nullable=True) # Optional link to a skill
        learning_step_id = db.Column(db.String(36), nullable=True) # Optional link to a specific learning step (not a foreign key here)
        type = db.Column(db.String(50), nullable=True) # e.g., 'review', 'practice', 'study', 'project'

        def __repr__(self):
            return f"<WeeklyTask {self.id}: {self.description[:30]}... (Completed: {self.completed})>"

        def to_dict(self):
            return {
                'id': self.id,
                'description': self.description,
                'completed': self.completed,
                'skillId': self.skill_id, # Frontend expects camelCase
                'learningStepId': self.learning_step_id, # Frontend expects camelCase
                'type': self.type
            }
    # --- NEW MODELS END HERE ---

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
                test_model = genai.GenerativeModel("gemini-flash-latest")
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
    @app.route('/flash', methods=['POST'])
    def chat_with_flash():
        """
        Handles general conversational chat with Flash AI.
        Prioritizes Groq, falls back to Gemini, then Mock.
        Saves chat history to DB.
        """
        session_id = request.headers.get('X-Session-ID', 'default_session')
        user_message = request.json.get('message')

        if not user_message or not isinstance(user_message, str) or user_message.strip() == "":
            return jsonify({
                "success": False,
                "error": "Message is required and must be a non-empty string."
            }), 400

        trimmed_message = user_message.strip()
        logger.info(f"Chat: Received message for session {session_id}: {trimmed_message[:50]}...")

        # 1. Save User Message
        try:
            new_user_entry = ChatHistory(session_id=session_id, role='user', content=trimmed_message)
            db.session.add(new_user_entry)
            db.session.commit()
        except Exception as e:
            logger.error(f"Chat: Failed to save user message: {e}")
            db.session.rollback()
            return jsonify({"success": False, "error": "Database error saving message."}), 500

        # 2. Build Context (History)
        history_records = ChatHistory.query.filter_by(session_id=session_id).order_by(ChatHistory.timestamp).all()
        
        # Prepare messages for Groq/OpenAI format
        groq_messages = [
            {"role": "system", "content": DEFAULT_SYSTEM_INSTRUCTION}
        ]
        
        # Prepare text for Gemini/Legacy format
        full_conversation_text = f"System: {DEFAULT_SYSTEM_INSTRUCTION}\n"

        for record in history_records:
            # Skip the message we just added to avoid duplications if not careful, 
            # but usually we want all history. The last one is the current user message.
            role = "user" if record.role == "user" else "assistant"
            groq_messages.append({"role": role, "content": record.content})
            full_conversation_text += f"{'User' if role == 'user' else 'Flash'}: {record.content}\n"

        flash_response = ""
        provider_used = "none"

        # 3. Generate Response (Groq -> Gemini -> Mock)
        try:
            # A. Try Groq
            if groq_client:
                try:
                    completion = groq_client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        messages=groq_messages,
                        temperature=0.7,
                        max_tokens=1000,
                    )
                    flash_response = completion.choices[0].message.content
                    provider_used = "groq"
                except Exception as e:
                    logger.error(f"Chat: Groq failed: {e}")

            # B. Try Gemini (if Groq failed or not configured)
            if not flash_response and GEMINI_API_KEY:
                try:
                    # Use simple generation with full context if chat session fails
                    model = genai.GenerativeModel("gemini-flash-latest")
                    response = model.generate_content(full_conversation_text)
                    flash_response = response.text
                    provider_used = "gemini"
                except Exception as e:
                    logger.error(f"Chat: Gemini failed: {e}")
            
            # C. Mock Fallback
            if not flash_response:
                logger.warning("Chat: All AI providers failed. Using Mock.")
                flash_response = "I'm currently experiencing high traffic and cannot connect to my AI brain. Please try again in a moment! (System: AI providers unavailable)"
                provider_used = "mock"

        except Exception as e:
            logger.exception("Chat: Critical error during generation.")
            flash_response = "I encountered a critical error. Please check the system logs."
            provider_used = "error"

        # 4. Save Assistant Response
        try:
            new_model_entry = ChatHistory(session_id=session_id, role='assistant', content=flash_response)
            db.session.add(new_model_entry)
            db.session.commit()
        except Exception as e:
            logger.error(f"Chat: Failed to save assistant response: {e}")
            # Don't fail request if just save failed, return response to user
        
        return jsonify({
            "success": True,
            "reply": flash_response,
            "metadata": {
                "model": provider_used,
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        }), 200
    
    # --- Motivation & Profile Routes ---
    
    @app.route('/api/motivation', methods=['GET'])
    def get_motivation_quote():
        quotes = [
          "🎯 Your future self is counting on today's efforts!",
          "🚀 Every algorithm you learn opens new possibilities!",
          "⚡ Consistency beats perfection - keep going!",
          "🧠 You're building the mind of tomorrow!",
          "🔥 Progress over perfection, always!",
          "💪 Your dedication today creates tomorrow's opportunities!"
        ]
        return jsonify({"quote": random.choice(quotes)}), 200

    @app.route('/api/user/profile', methods=['GET'])
    def get_user_profile():
        # In a real app, this would fetch from DB based on auth token
        return jsonify({"name": "Flash Learner"}), 200

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
                logger.error(f"Error processing skill data: {str(e)}") # Corrected line: Removed extra ')' here
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
            skills_json_str = generate_ai_content(prompt, model_type="complex")
            # Cleanup only if needed (the helper returns string, strip might still be useful if model is chatty)
            skills_json_str = strip_markdown_json(skills_json_str) 
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
            learning_path_json_str = generate_ai_content(prompt, model_type="complex")
            learning_path_json_str = strip_markdown_json(learning_path_json_str) 
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
            vocab_json_str = generate_ai_content(prompt)
            vocab_json_str = strip_markdown_json(vocab_json_str) 
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

        # Enhance prompt for Technical/CSE interviews
        cse_domains = ["Artificial Intelligence", "Database Management Systems", "Operating Systems", "Computer Networks", "Data Structures & Algorithms"]
        
        if interview_type.lower() == 'technical':
            domain_focus = random.choice(cse_domains)
            prompt_context = f"technical computer science interview questions focused on {domain_focus}. The questions should test core concepts, problem-solving, and database knowledge."
        else:
            prompt_context = f"{interview_type} interview questions suitable for a professional interview."

        prompt = f"""
        Generate 5 unique, relevant, and varied {prompt_context}. 
        For each question, provide a 'category' (e.g., "{domain_focus if interview_type.lower() == 'technical' else 'General'}", "Behavioral") and 'difficulty' (e.g., "Easy", "Medium", "Hard"). 
        Ensure there is a good mix of difficulty levels. 
        
        IMPORTANT: Respond ONLY with the JSON array. Do NOT include any markdown code block delimiters (e.g., ```json```) or any other text before or after the JSON. Ensure ALL strings within the JSON are properly escaped. The JSON should be valid for direct JSON.parse(). Format the response as a JSON array of objects, like this: 
        [
          {{ "question": "...", "category": "...", "difficulty": "..." }},
          {{ "question": "...", "category": "...", "difficulty": "..." }}
        ]
        """
        logger.info(f"AI: Generating {interview_type} interview questions with prompts: {prompt_context}")
        try:
            questions_json_str = generate_ai_content(prompt)
            questions_json_str = strip_markdown_json(questions_json_str) 
            logger.info(f"AI: Raw response for interview questions (after strip): {questions_json_str}")

            questions_data = json.loads(questions_json_str)

            if not isinstance(questions_data, list):
                raise ValueError("AI response is not a JSON array.")
            
            return jsonify({"message": "Interview questions generated", "questions": questions_data}), 200
        except Exception as e:
            logger.exception("AI: Error generating interview questions. Falling back to mock data.")
            # Fallback Mock Data
            mock_questions = [
                { "question": "Explain the difference between a process and a thread in an Operating System.", "category": "Operating Systems", "difficulty": "Medium" },
                { "question": "What is the time complexity of a binary search algorithm? Explain why.", "category": "Algorithms", "difficulty": "Easy" },
                { "question": "Describe the ACID properties in a Database Management System.", "category": "DBMS", "difficulty": "Medium" },
                { "question": "What is a deadlock? What are the necessary conditions for a deadlock to occur?", "category": "Operating Systems", "difficulty": "Hard" },
                { "question": "Explain the concept of Virtual Memory and Paging.", "category": "Operating Systems", "difficulty": "Medium" }
            ]
            if interview_type.lower() == 'hr':
                mock_questions = [
                    { "question": "Tell me about a time you faced a challenge and how you overcame it.", "category": "Behavioral", "difficulty": "Medium" },
                    { "question": "Where do you see yourself in 5 years?", "category": "Behavioral", "difficulty": "Easy" },
                    { "question": "Why do you want to join this company?", "category": "Behavioral", "difficulty": "Medium" },
                    { "question": "Describe a conflict you had with a team member and how you resolved it.", "category": "Behavioral", "difficulty": "Hard" },
                    { "question": "What are your greatest strengths and weaknesses?", "category": "Behavioral", "difficulty": "Medium" }
                ]
            
            # Return mock data handling the error gracefully
            return jsonify({
                "message": "AI rate limit reached. Returning cached/mock questions.", 
                "questions": mock_questions,
                "is_mock": True
            }), 200

    @app.route('/api/ai/generate_interview_feedback', methods=['POST'])
    def ai_generate_interview_feedback():
        """
        Generates feedback for an interview answer or overall interview using AI.
        Does NOT save to ChatHistory. Frontend will handle displaying/saving to LearningSession.
        """
        data = request.json
        prompt_text = data.get('prompt')
        user_answers = data.get('user_answers', [])
        questions = data.get('questions', [])
        
        if not prompt_text and not (user_answers and questions):
            return jsonify({"error": "Prompt text or QA data is required"}), 400
        
        # improved prompt construction
        final_prompt = prompt_text
        if not final_prompt:
            qa_pairs = ""
            for q, a in zip(questions, user_answers):
                 qa_pairs += f"Q: {q.get('question', '')}\nA: {a}\n---\n"
            
            final_prompt = f"""
            Analyze the following technical interview Q&A session. 
            Focus on:
            1. Technical Accuracy (CSE concepts, SQL, logic).
            2. Communication Style (clarity, confidence).
            
            Q&A Transcript:
            {qa_pairs}
            
            Provide a response in strict JSON format:
            {{
                "feedback": "Detailed overall feedback...",
                "score": 85 (integer out of 100),
                "strengths": ["..."],
                "improvements": ["..."]
            }}
            Do NOT use markdown blocks.
            """
        
        logger.info(f"AI: Generating interview feedback...")
        try:
            feedback_json_str = generate_ai_content(final_prompt, model_type="complex")
            feedback_json_str = strip_markdown_json(feedback_json_str) 
            logger.info(f"AI: Feedback generated (after strip): {feedback_json_str}")
            
            # Try to parse as JSON, but handle plain text fallback if AI fails to follow JSON strictness mostly for legacy prompts
            try:
                feedback_data = json.loads(feedback_json_str)
                return jsonify({"message": "Feedback generated", "feedback": feedback_data.get('feedback'), "score": feedback_data.get('score'), "details": feedback_data}), 200
            except json.JSONDecodeError:
                # Fallback for plain text response
                return jsonify({"message": "Feedback generated", "feedback": feedback_json_str, "score": 70}), 200

        except Exception as e:
            logger.error(f"AI: Error generating AI feedback: {e}")
            # Mock Feedback Fallback
            mock_feedback = {
                "feedback": "AI is currently unavailable due to high traffic. Based on standard metrics: Ensure your answers are concise and cover the core definition first. For technical questions, always mention time complexity. Your communication seems clear.",
                "score": 75,
                "strengths": ["Clear articulation", "Attempted all questions"],
                "improvements": ["Deepen technical depth", "Use more specific examples"]
            }
            return jsonify({
                 "message": "AI rate limit reached. Generated placeholder feedback.", 
                 "feedback": mock_feedback['feedback'], 
                 "score": mock_feedback['score'], 
                 "details": mock_feedback
            }), 200

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
            model_name="gemini-flash-latest",
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

    @app.route('/api/ai/optimize_code', methods=['POST'])
    def ai_optimize_code():
        """
        Analyzes code, provides complexity analysis, and suggests optimization.
        """
        data = request.json
        code_snippet = data.get('code')
        language = data.get('language', 'python')

        if not code_snippet:
            return jsonify({"error": "Code snippet is required"}), 400

        prompt = f"""
        Analyze the following {language} code snippet. 
        1. Determine the Time Complexity (Big O).
        2. Determine the Space Complexity.
        3. "Roast" the code (give a funny, sarcastic critique of the style/efficiency).
        4. Provide an OPTIMIZED version of the code (better performance or readability).
        
        Code Snippet:
        {code_snippet}

        Return STRICT JSON format:
        {{
            "timeComplexity": "O(n)",
            "spaceComplexity": "O(1)",
            "critique": "Your critique here...",
            "optimizedCode": "The optimized code string..."
        }}
        """
        
        try:
            logger.info("AI: Optimizing code...")
            response_json_str = generate_ai_content(prompt)
            response_json_str = strip_markdown_json(response_json_str)
            analysis_data = json.loads(response_json_str)
            return jsonify(analysis_data), 200
        except Exception as e:
            logger.error(f"AI: Error optimizing code: {e}")
            # Mock Fallback
            return jsonify({
                 "timeComplexity": "Unknown",
                 "spaceComplexity": "Unknown",
                 "critique": "I couldn't analyze this code right now (AI busy), but it probably needs more comments!",
                 "optimizedCode": code_snippet
            }), 200

    @app.route('/api/ai/analyze_resume', methods=['POST'])
    def ai_analyze_resume():
        """
        Analyzes resume text for ATS compatibility and scores it.
        """
        data = request.json
        resume_text = data.get('resume_text')
        target_role = data.get('target_role', 'Software Engineer')

        if not resume_text:
            return jsonify({"error": "Resume text is required"}), 400

        prompt = f"""
        Act as an expert Technical Recruiter and ATS (Applicant Tracking System) specialist.
        Analyze the following resume text for the role of "{target_role}".
        
        Resume Text:
        {resume_text[:4000]} (truncated if too long)
        
        Provide:
        1. An ATS Score (0-100) based on keyword matching, formatting (implied), and impact.
        2. Top 3 Strengths.
        3. Top 3 Weaknesses/Improvements.
        4. List of detailed Missing Keywords/Skills that are crucial for this role but missing.
        5. A brief professional summary rewrite suggestion.

        Return STRICT JSON format:
        {{
            "atsScore": 85,
            "strengths": ["Strong action verbs", "Good metric usage", "Clear education section"],
            "weaknesses": ["Missing cloud skills", "Typos in skills section"],
            "missingKeywords": ["Docker", "Kubernetes", "CI/CD"],
            "summarySuggestion": "Energetic Software Engineer with..."
        }}
        """
        
        try:
            logger.info(f"AI: Analyzing resume for role: {target_role}...")
            response_json_str = generate_ai_content(prompt, model_type="complex") # Use complex model for deep analysis
            response_json_str = strip_markdown_json(response_json_str)
            analysis_data = json.loads(response_json_str)
            return jsonify(analysis_data), 200
        except Exception as e:
            logger.error(f"AI: Error analyzing resume: {e}")
            return jsonify({"error": f"Failed to analyze resume: {str(e)}"}), 500

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

    # --- NEW NOTES API ROUTES START HERE ---
    @app.route('/api/notes', methods=['POST'])
    def create_note():
        data = request.json
        if not data or 'content' not in data:
            return jsonify({"error": "Note content is required"}), 400

        try:
            new_note = Note(content=data['content'])
            db.session.add(new_note)
            db.session.commit()
            return jsonify(new_note.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating note: {e}")
            return jsonify({"error": f"Failed to create note: {str(e)}"}), 500

    @app.route('/api/notes', methods=['GET'])
    def get_recent_notes():
        notes = Note.query.order_by(Note.timestamp.desc()).limit(5).all() 
        return jsonify([note.to_dict() for note in notes]), 200

    # --- NEW WEEKLY TASKS API ROUTES START HERE ---
    @app.route('/api/weekly_tasks', methods=['GET'])
    def get_weekly_tasks():
        tasks = WeeklyTask.query.order_by(WeeklyTask.completed, WeeklyTask.description).all()
        return jsonify([task.to_dict() for task in tasks]), 200

    @app.route('/api/weekly_tasks', methods=['POST'])
    def add_weekly_task():
        data = request.json
        if not data or 'description' not in data:
            return jsonify({"error": "Task description is required"}), 400
        
        try:
            new_task = WeeklyTask(
                description=data['description'],
                completed=data.get('completed', False),
                skill_id=data.get('skillId'),
                learning_step_id=data.get('learningStepId'),
                type=data.get('type')
            )
            db.session.add(new_task)
            db.session.commit()
            return jsonify(new_task.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding weekly task: {e}")
            return jsonify({"error": f"Failed to add weekly task: {str(e)}"}), 500

    @app.route('/api/weekly_tasks/<string:task_id>', methods=['PUT'])
    def update_weekly_task(task_id):
        task = WeeklyTask.query.get(task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        
        data = request.json
        task.description = data.get('description', task.description)
        task.completed = data.get('completed', task.completed) # Allow toggling completion
        task.skill_id = data.get('skillId', task.skill_id)
        task.learning_step_id = data.get('learningStepId', task.learning_step_id)
        task.type = data.get('type', task.type)

        try:
            db.session.commit()
            return jsonify(task.to_dict()), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating task {task_id}: {e}")
            return jsonify({"error": f"Failed to update task: {str(e)}"}), 500

    @app.route('/api/weekly_tasks/<string:task_id>', methods=['DELETE'])
    def delete_weekly_task(task_id):
        task = WeeklyTask.query.get(task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        
        try:
            db.session.delete(task)
            db.session.commit() # Commit the deletion
            return jsonify({"message": "Task deleted successfully"}), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting task {task_id}: {e}")
            return jsonify({"error": f"Failed to delete task: {str(e)}"}), 500

    @app.route('/api/learning_sessions', methods=['GET'])
    def get_learning_sessions():
        user_id = request.args.get('user_id', 1) # Default to 1 for now
        sessions = LearningSession.query.filter_by(user_id=user_id).order_by(LearningSession.timestamp.desc()).all()
        return jsonify([session.to_dict() for session in sessions]), 200

    @app.route('/api/learning_sessions', methods=['POST'])
    def create_learning_session():
        data = request.json
        if not data or 'session_type' not in data:
            return jsonify({"error": "Missing session_type"}), 400

        try:
            new_session = LearningSession(
                user_id=data.get('user_id', 1),
                session_type=data['session_type'],
                score=data.get('score'),
                feedback=data.get('feedback'),
                questions_data=json.dumps(data.get('questions', [])),
                answers_data=json.dumps(data.get('answers', [])),
                correct=data.get('correct') # Optional
            )
            db.session.add(new_session)
            db.session.commit()
            return jsonify(new_session.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating learning session: {e}")
            return jsonify({"error": f"Failed to create session: {str(e)}"}), 500

    return app