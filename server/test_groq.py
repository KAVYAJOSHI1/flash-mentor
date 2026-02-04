import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

key = os.environ.get("GROQ_API_KEY")
print(f"Key loaded: '{key}'")

try:
    client = Groq(api_key=key)
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": "Explain the importance of fast language models",
            }
        ],
        model="llama3-8b-8192",
    )
    print(chat_completion.choices[0].message.content)
    print("SUCCESS: Groq is working!")
except Exception as e:
    print(f"ERROR: {e}")
