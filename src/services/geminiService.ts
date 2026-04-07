import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Mode } from "../types";
import { MODES, SYSTEM_PROMPT_BASE } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateResponse(
  mode: Mode,
  history: Message[],
  userInput: string
): Promise<string> {
  const modeConfig = MODES.find(m => m.id === mode);
  const modeInstruction = modeConfig?.systemInstruction || "You are a supportive AI companion.";
  
  const systemInstruction = `
    ${SYSTEM_PROMPT_BASE}
    Current Mode: ${modeConfig?.title || "Chat"}
    Mode Specific Instruction: ${modeInstruction}
    
    Guidelines for this response:
    - Keep it concise and easy to read.
    - Ask a clear, gentle follow-up question if appropriate.
    - If the conversation seems to be reaching a natural conclusion, provide a short "Useful Takeaway" or "Reflection Summary".
  `;

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Add the current user input
  contents.push({
    role: 'user',
    parts: [{ text: userInput }]
  });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        topP: 0.95,
      },
    });

    return response.text || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm experiencing a technical difficulty. Please take a deep breath and try again in a moment.";
  }
}

export async function generateSummary(history: Message[]): Promise<string> {
  const systemInstruction = `
    ${SYSTEM_PROMPT_BASE}
    Task: Summarize the key insights, takeaways, or themes from this conversation.
    Format: A short, thoughtful list of 2-3 points.
    Goal: Help the user leave with something useful to reflect on or bring to their next session.
  `;

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.5,
      },
    });

    return response.text || "No summary available.";
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return "Summary unavailable.";
  }
}
