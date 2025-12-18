
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, ResourceType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SEARCH_MODEL = 'gemini-3-flash-preview';
const QUIZ_MODEL = 'gemini-3-flash-preview';

export const searchTopics = async (
  grade: string,
  semester: string,
  subject: string
): Promise<{ topics: string[]; sources: { title: string; uri: string }[] }> => {
  
  const prompt = `
    أبحث عن المنهج الدراسي لمادة "${subject}" للصف "${grade}" "${semester}" في الدول العربية.
    استخرج 8 عناوين رئيسية للدروس.
    التنسيق: سطر يبدأ بـ "TOPIC:" ثم العنوان.
  `;

  try {
    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    });

    const text = response.text || "";
    const topics: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('TOPIC:')) {
        const topic = line.split('TOPIC:')[1].trim();
        if (topic) topics.push(topic);
      }
    }

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((c: any) => c.web)
      .filter((w: any) => w && w.uri && w.title)
      .map((w: any) => ({ title: w.title, uri: w.uri }));

    return { topics, sources };
  } catch (error) {
    throw new Error("فشل في البحث عن المواضيع.");
  }
};

export const generateQuiz = async (
  topic: string,
  grade: string,
  subject: string,
  numQuestions: number = 10,
  resourceType: ResourceType = ResourceType.QUIZ
): Promise<Question[]> => {
  const isWorksheet = resourceType === ResourceType.WORKSHEET;
  
  const prompt = `
    أنشئ ${resourceType} مكون من ${numQuestions} فقرة حول: "${topic}" 
    للمادة "${subject}" للصف "${grade}".
    ${isWorksheet ? 'اجعل الأسئلة مقالية (OPEN) لقياس الفهم العميق.' : 'اجعلها مزيجاً من MCQ و TF.'}
    اللغة: عربية فصيحة.
  `;

  // Fix: Use raw object for responseSchema to avoid deprecated SchemaType/Schema issues
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.INTEGER },
        text: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["MCQ", "TF", "OPEN"] },
        options: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING }
        },
        correctAnswerIndex: { type: Type.INTEGER },
      },
      required: ["id", "text", "type", "options", "correctAnswerIndex"],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: QUIZ_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.4,
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as Question[];
    }
    throw new Error("No data returned");
  } catch (error) {
    throw new Error("فشل في إنشاء المحتوى التعليمي.");
  }
};
