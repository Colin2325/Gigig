import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateLuxuryGreeting = async (): Promise<string> => {
  if (!apiKey) return "Merry Christmas from the Grand Estate.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Write a short, ultra-luxurious, majestic Christmas greeting (max 15 words). The tone should be grand, successful, and golden, like a billionaire's holiday card. No hashtags.",
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Experience the Gold Standard of Holidays.";
  }
};