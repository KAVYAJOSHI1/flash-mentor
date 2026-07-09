import express, { Request, Response, NextFunction } from "express";
import fetch from "node-fetch";

const router = express.Router();

// ===========================================================================
// CONFIGURATION FOR GEMINI API
// ===========================================================================

const GEMINI_API_KEY: string = process.env.GEMINI_API_KEY || "";

// Gemini API endpoint for gemini-1.5-flash-latest model
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const TIMEOUT_MS = 90000; // Increased timeout to 90 seconds (1.5 minutes) for more complex queries
const RETRY_ATTEMPTS = 5; // Increased retry attempts for improved resilience
const MAX_MESSAGE_LENGTH = 4000; // Increased max input message length, as Gemini models support large contexts.

// This array stores the conversation history in memory.
// For a production app with multiple users or persistent history,
// you would store this in a database (e.g., Redis, MongoDB, PostgreSQL) per user/session.
const conversationHistory: { role: string; parts: { text: string }[] }[] = [];
const MAX_HISTORY_LENGTH = 10; // Keep the last 10 turns of conversation (user + model)

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

/**
 * Middleware for robust input validation.
 */
const validateMessage = (req: Request, res: Response, next: NextFunction): void => {
  const { message } = req.body;
  
  if (!message || typeof message !== 'string') {
    res.status(400).json({ 
      success: false,
      error: "Message is required and must be a string.",
      code: "INVALID_MESSAGE_TYPE"
    });
    return;
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    res.status(400).json({ 
      success: false,
      error: "Message cannot be empty.",
      code: "EMPTY_MESSAGE"
    });
    return;
  }
  
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ 
      success: false,
      error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`,
      code: "MESSAGE_TOO_LONG",
      maxLength: MAX_MESSAGE_LENGTH,
      currentLength: trimmedMessage.length
    });
    return;
  }
  
  req.body.message = trimmedMessage; // Use trimmed message
  next();
};

/**
 * Calls Gemini API with retry logic and improved parameters.
 */
const callGemini = async (message: string, retryCount = 0): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Add the new user message to history
    conversationHistory.push({ role: "user", parts: [{ text: message }] });

    // Trim history to a manageable size to prevent exceeding context window
    while (conversationHistory.length > MAX_HISTORY_LENGTH) {
      conversationHistory.shift(); // Remove the oldest message
    }

    // Recommended generation config for Gemini 1.5 Flash
    const requestBody = {
      contents: conversationHistory, 
      generationConfig: {
        temperature: 0.8, // Slightly increased for more varied responses
        maxOutputTokens: 1024, // A reasonable output length for general chat
        topP: 0.95, // Increased topP for more diverse but still coherent output
        topK: 64, // Default for Gemini 1.5 Flash, good balance
      },
      systemInstruction: {
        parts: [{ text: `You are Flash, a helpful, intelligent, and comprehensive AI assistant. You excel at providing thorough, accurate, and polite answers. Break down complex topics into understandable explanations. Always strive to address all parts of the user's query and provide additional relevant information if it enhances the response. Avoid acting as a "coach" or giving unsolicited advice unless explicitly requested. Maintain a positive and engaging tone.` }]
      }
    };

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorDetails = await response.text().catch(() => 'Unknown error from Gemini');
      console.error(`🔴 Gemini API HTTP Error ${response.status}: ${errorDetails}`);
      throw new Error(`Gemini API HTTP Error ${response.status}: ${errorDetails}`);
    }

    const data = await response.json();
    
    const geminiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!geminiResponseText) {
      if (data.candidates?.[0]?.finishReason) {
        console.warn('Gemini API finished with reason:', data.candidates[0].finishReason, 'and no text content.');
        if (data.promptFeedback?.safetyRatings) {
          console.warn('Safety Ratings:', JSON.stringify(data.promptFeedback.safetyRatings, null, 2));
          throw new Error(`AI response blocked due to safety concerns. Reason: ${data.candidates[0].finishReason}.`);
        }
        throw new Error(`AI did not provide a valid text response (finish reason: ${data.candidates[0].finishReason}).`);
      }
      throw new Error('Malformed JSON response from Gemini: Missing valid text content in candidates.');
    }

    // Add the model's response to history
    conversationHistory.push({ role: "model", parts: [{ text: geminiResponseText }] });

    return geminiResponseText;

  } catch (error: any) {
      clearTimeout(timeoutId);
    
    console.error(`🔴 Gemini API request failed (attempt ${retryCount + 1}):`, {
      error: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack?.split('\n')[0]
    });

    const shouldRetry = retryCount < RETRY_ATTEMPTS && (
      error.name === 'AbortError' ||
      error.code === 'ECONNRESET' ||
      error.message.includes('429') || // Rate limit
      error.message.includes('500') || // Internal server error
      error.message.includes('503') || // Service unavailable
      error.message.includes('timeout') ||
      error.message.includes('Failed to fetch')
    );

    if (shouldRetry) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 8000); // Max backoff 8 seconds
      console.log(`🔄 Retrying Gemini call in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return callGemini(message, retryCount + 1);
    }
    
    throw error;
  }
};

// ===========================================================================
// API ROUTES
// ===========================================================================

/**
 * Main endpoint to interact with the Flash AI assistant (powered by Gemini).
 * Handles input validation, calls Gemini, and provides detailed error responses.
 */
router.post("/flash", validateMessage, async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body;
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);

  console.log(`🚀 [${requestId}] Processing message: "${message.substring(0, 70)}${message.length > 70 ? '...' : ''}"`);

  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'no-referrer',
    'X-Request-ID': requestId
  });

  try {
    const reply = await callGemini(message);
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ [${requestId}] Success in ${responseTime}ms`);
    
    res.status(200).json({ 
      success: true,
      reply,
      metadata: {
        responseTime: `${responseTime}ms`,
        requestId,
        model: "gemini-1.5-flash-latest",
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown server error';
    
    console.error(`❌ [${requestId}] Failed after ${responseTime}ms:`, {
      error: errorMessage,
      name: error.name,
      stack: error.stack?.split('\n')[0] || 'No stack'
    });
    
    if (error.name === 'AbortError' || errorMessage.includes('timeout')) {
      res.status(408).json({ 
        success: false,
        error: "AI processing timed out. The model took too long to generate a response.",
        code: "TIMEOUT",
        suggestion: "Try simplifying your message, asking a more direct question, or try again later. If this persists, your internet connection might be unstable or Google's API is slow."
      });
    } else if (errorMessage.includes('Gemini API HTTP Error 401') || errorMessage.includes('API key not valid')) {
      res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing Gemini API Key. Please check the key in routes/flash.ts.",
        code: "UNAUTHORIZED_API_KEY",
        suggestion: "The API key provided is not valid. Please ensure it's correct and enabled for the Generative Language API. Remember that hardcoding keys is not recommended for production."
      });
    } else if (errorMessage.includes('Gemini API HTTP Error 429')) {
      res.status(429).json({
        success: false,
        error: "Too Many Requests: You have exceeded your Gemini API rate limits.",
        code: "RATE_LIMIT_EXCEEDED",
        suggestion: "Please wait a moment before sending another request, or check your Google Cloud project's quota settings."
      });
    } else if (errorMessage.includes('Gemini API HTTP Error 400') && errorMessage.includes('safety concerns')) {
        res.status(400).json({
            success: false,
            error: "AI response was blocked due to safety concerns or policy violations.",
            code: "SAFETY_BLOCK",
            suggestion: "The AI detected potentially harmful content. Please rephrase your query."
        });
    } else if (errorMessage.includes('Gemini API HTTP Error 500') || errorMessage.includes('Gemini API HTTP Error 503')) {
      res.status(503).json({ 
        success: false,
        error: "Gemini AI service is temporarily unavailable or experiencing issues.",
        code: "SERVICE_UNAVAILABLE",
        suggestion: "This is likely a temporary issue with Google's API. Please try again in a few minutes."
      });
    } else if (errorMessage.includes('Malformed JSON response') || errorMessage.includes('Missing valid text content')) {
      res.status(502).json({
        success: false,
        error: "The AI service returned an invalid or unreadable response.",
        code: "INVALID_AI_RESPONSE",
        suggestion: "This might be a temporary issue with Gemini. Try again."
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: "An unexpected internal server error occurred.",
        code: "INTERNAL_ERROR",
        requestId,
        suggestion: "Please check the backend server logs for more details or review the prompt."
      });
    }
  }
});

/**
 * Health check endpoint for the Flash backend and Gemini connectivity.
 */
router.get("/health", async (req: Request, res: Response): Promise<void> => {
  try {
    const hasApiKey = !!GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 0;
    
    if (!hasApiKey) {
      res.status(503).json({
        status: "unhealthy",
        backend: "operational",
        gemini_api_key_status: "missing_or_empty",
        timestamp: new Date().toISOString(),
        suggestion: "The GEMINI_API_KEY is missing or empty in routes/flash.ts. Please ensure it's set."
      });
      return;
    }

    // Attempt a minimal call to Gemini to verify connectivity and API key validity
    try {
      const testMessage = "ping";
      const testRequestBody = {
        contents: [{ role: "user", parts: [{ text: testMessage }] }],
        generationConfig: { maxOutputTokens: 1 }, // Request minimal output
      };
      const testResponse = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testRequestBody),
        signal: AbortSignal.timeout(5000) // 5-second timeout for health check
      });

      if (!testResponse.ok) {
        // If response is not OK, it's likely an API key issue or service unavailability
        const errorDetails = await testResponse.text().catch(() => 'Unknown error during health check');
        throw new Error(`Gemini connectivity failed with status: ${testResponse.status}. Details: ${errorDetails}`);
      }

      // If we reach here, connectivity is good and key is likely valid
      res.status(200).json({
        status: "healthy",
        backend: "operational",
        gemini_api_key_status: "present_and_connected",
        gemini_connectivity: "successful",
        timestamp: new Date().toISOString()
      });

    } catch (geminiError: any) {
      console.error("🔴 Gemini API connectivity test failed during health check:", geminiError.message);
      res.status(503).json({
        status: "unhealthy",
        backend: "operational",
        gemini_api_key_status: "present_but_connectivity_issue",
        gemini_connectivity: "failed",
        details: geminiError.message,
        suggestion: "Gemini API key is present but could not connect to Gemini API. Check network or API key validity.",
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error("🔴 Backend health check failed unexpectedly:", error.message);
    res.status(503).json({
      status: "error",
      error: "Health check failed to execute due to an internal error.",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;