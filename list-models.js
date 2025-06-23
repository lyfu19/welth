// list-models.js
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  const models = await genAI.listModels();
  models.forEach((m) => console.log(m.name));
}

listModels();