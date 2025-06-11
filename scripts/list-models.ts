import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set in environment.');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    // The SDK does not expose a direct listModels method, so we use the REST endpoint
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json() as any;
    if (!data.models) {
      console.log('No models found.');
      return;
    }
    console.log('Available Gemini Models:');
    for (const model of data.models) {
      console.log(`- ${model.name}`);
      if (model.supportedGenerationMethods) {
        console.log(`  Supported methods: ${model.supportedGenerationMethods.join(', ')}`);
      }
    }
  } catch (err) {
    console.error('Failed to list models:', err);
    process.exit(1);
  }
}

listModels(); 