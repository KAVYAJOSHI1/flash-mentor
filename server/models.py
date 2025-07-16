from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Flashcard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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
    user_id = db.Column(db.Integer, nullable=False) # Assuming a simple user ID, expand if you add User model
    flashcard_id = db.Column(db.Integer, db.ForeignKey('flashcard.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    correct = db.Column(db.Boolean, nullable=False)

    flashcard = db.relationship('Flashcard', backref=db.backref('sessions', lazy=True))

    def __repr__(self):
        return f'<LearningSession {self.id} User:{self.user_id} Card:{self.flashcard_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'flashcard_id': self.flashcard_id,
            'timestamp': self.timestamp.isoformat(),
            'correct': self.correct
        }