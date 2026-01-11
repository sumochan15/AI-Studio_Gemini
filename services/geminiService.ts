
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ModelType, AppMode, Message } from "../types";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateText(
    model: ModelType,
    history: Message[], 
    mode: AppMode,
    isThinking: boolean,
    currentCanvasContent: string | null,
    onChunk?: (text: string) => void,
    signal?: AbortSignal
  ) {
    const ai = this.getAI();
    const config: any = {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
    };

    if (isThinking) {
        config.thinkingConfig = { thinkingBudget: 16384 }; 
    }

    let systemInstruction = "You are a helpful AI assistant.";

    if (mode === AppMode.DEEP_RESEARCH) {
      config.tools = [{ googleSearch: {} }];
      systemInstruction = "You are an expert researcher. Your goal is to provide deep, exhaustive, and well-structured answers. You MUST use Google Search to verify facts and gather comprehensive information. Analyze the query from multiple angles.";
    } else if (mode === AppMode.CANVAS) {
      systemInstruction = "You are a collaborative writing and coding assistant. You are working in a 'Canvas' interface. The user will ask you to write or edit content. Output the content clearly. If editing, consider the context provided.";
    }

    const validMessages = history.filter(m => m.type !== 'error' && (m.content.trim() !== '' || (m.attachments && m.attachments.length > 0)));

    const contents = validMessages.map(msg => {
      const parts: any[] = [];
      
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach(att => {
            const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
            parts.push({
                inlineData: {
                    mimeType: att.mimeType,
                    data: base64Data
                }
            });
        });
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts
      };
    });

    if (mode === AppMode.CANVAS && currentCanvasContent) {
        systemInstruction += `\n\nCurrent Canvas Content:\n\`\`\`\n${currentCanvasContent}\n\`\`\``;
    }

    try {
        const response = await ai.models.generateContentStream({
          model,
          contents: contents,
          config: {
            ...config,
            systemInstruction
          },
        });

        let fullText = "";
        let groundingUrls: { title: string; uri: string }[] = [];

        for await (const chunk of response) {
          if (signal?.aborted) {
            break;
          }
          const chunkText = chunk.text || "";
          fullText += chunkText;
          if (onChunk) onChunk(chunkText);

          const urls = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.filter((c: any) => c.web)
            .map((c: any) => ({
              title: c.web.title,
              uri: c.web.uri
            }));
          
          if (urls && urls.length > 0) {
            groundingUrls = urls;
          }
        }
        
        return { text: fullText, groundingUrls };
    } catch (error) {
      // AbortErrorの場合はエラーとして扱わない、または呼び出し元で処理する
      console.error("Gemini Text Generation Error:", error);
      throw error;
    }
  }

  async generateImage(
    prompt: string,
    aspectRatio: "1:1" | "16:9" | "9:16" | "3:4" | "4:3" = "1:1"
  ) {
    const ai = this.getAI();
    try {
      // Use standard flash image model or pro image model
      const model = ModelType.IMAGE_PRO;
      
      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: { aspectRatio },
          tools: [{ googleSearch: {} }] // Only available for pro-image-preview
        },
      });

      const images: string[] = [];
      const texts: string[] = [];

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            images.push(`data:image/png;base64,${part.inlineData.data}`);
          } else if (part.text) {
            texts.push(part.text);
          }
        }
      }

      return {
        images,
        text: texts.join("\n")
      };
    } catch (error) {
      console.error("Gemini Image Generation Error:", error);
      throw error;
    }
  }

  async generateVideo(prompt: string) {
    const ai = this.getAI();
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Polling loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
            operation = await ai.operations.getVideosOperation({operation: operation});
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("No video generated");
        
        // Append API key for retrieval
        return `${videoUri}&key=${process.env.API_KEY}`;
    } catch (error) {
        console.error("Gemini Video Generation Error:", error);
        throw error;
    }
  }
}

export const geminiService = new GeminiService();
