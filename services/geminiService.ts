import { GoogleGenAI, Type, Schema } from "@google/genai";
import { VideoMetadata } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Define the response schema for strict JSON output
const videoAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A creative and catchy title for the video." },
    description: { type: Type.STRING, description: "A concise summary of the video content (max 2 sentences)." },
    tags: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "5 relevant hashtags or keywords." 
    },
    mood: { type: Type.STRING, description: "One word describing the mood (e.g., Energetic, Calm, Funny)." }
  },
  required: ["title", "description", "tags", "mood"],
};

export const analyzeVideoFrames = async (base64Frames: string[]): Promise<VideoMetadata> => {
  if (!apiKey) {
    console.warn("No API Key provided for Gemini.");
    return {
      title: "API Key Missing",
      description: "Please provide a valid API key to use AI features.",
      tags: [],
      mood: "Unknown"
    };
  }

  try {
    const parts = base64Frames.map(data => ({
      inlineData: {
        data,
        mimeType: "image/jpeg"
      }
    }));

    // Add the prompt as the last part
    parts.push({
      // @ts-ignore - The types in the SDK might expect 'text' property specifically for text parts
      text: "Analyze these frames from a video. Provide a title, description, tags, and mood."
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: parts as any // Casting to avoid complex discriminated union issues in strict mode
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: videoAnalysisSchema,
        systemInstruction: "You are an expert video editor and content strategist. Analyze the visual content carefully."
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as VideoMetadata;
    }
    
    throw new Error("No response text generated");

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};