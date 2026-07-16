import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function testModel(model: string) {
  try {
    const res = await ai.models.generateContent({ model, contents: 'Hi' });
    console.log(`SUCCESS [${model}]:`, res.text);
  } catch (e) {
    console.log(`ERROR [${model}]:`, e.message);
  }
}
async function run() {
  await testModel('gemini-3.1-flash-lite');
  await testModel('gemini-flash-lite-latest');
}
run();
