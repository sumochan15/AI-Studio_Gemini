
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ModelType, AppMode, Message } from "../types";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // Deep Research: Step 1 - Create a Plan
  async createResearchPlan(query: string): Promise<string[]> {
    const ai = this.getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `You are an expert Lead Researcher. Create a highly detailed, Deep Research plan for the following topic: "${query}".
            
            The plan must follow this exact structure in a JSON array:
            [
              "ウェブサイトをリサーチ\n(1) [Specific investigation point 1]\n(2) [Specific investigation point 2]\n(3) [Specific investigation point 3]...\n(n) [Specific investigation point n]",
              "結果を分析",
              "レポートを作成"
            ]

            Requirements for Step 1 ("ウェブサイトをリサーチ"):
            - Break down the topic into 5-8 specific, technical, and deep investigation angles.
            - Do NOT use generic phrases like "Search for X". Instead use specific goals like "Investigate the specific parameter settings for X and their impact on Y".
            - The sub-points (1), (2), etc., MUST be included in the same string as "ウェブサイトをリサーチ", separated by newlines.
            - The content MUST be in JAPANESE.
            - Focus on expert-level details, finding "tips", "hidden specs", "community consensus", and "technical parameters".

            Example output format:
            ["ウェブサイトをリサーチ\n(1) 〇〇APIの最新モデルの仕様と制限を調査する\n(2) パラメータXとYの相互作用について検証データを探す...", "結果を分析", "レポートを作成"]`,
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "[]";
        // Clean up any potential markdown code blocks if the model ignores instruction
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Plan creation failed:", error);
        return [
            "ウェブサイトをリサーチ\n(1) 基本情報を調査\n(2) 詳細スペックを確認\n(3) ユーザーの評判を検索", 
            "情報を分析", 
            "レポートを作成"
        ];
    }
  }

  // Deep Research: Execute the plan iteratively
  async executeDeepResearch(
    query: string,
    steps: string[],
    onProgress: (stepIndex: number) => void,
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<{ groundingUrls: { title: string; uri: string }[] }> {
    const ai = this.getAI();
    const allFindings: string[] = [];
    const allGroundingUrls: any[] = [];

    // Parse specific investigation points from the first step if possible
    // The plan format is ["Header\n(1)...\n(2)...", "Analyze", "Report"]
    // We want to execute searches for each (n) point.
    let searchTasks: string[] = [];
    const firstStep = steps[0];
    if (firstStep && firstStep.includes('\n')) {
        const lines = firstStep.split('\n');
        searchTasks = lines.filter(l => /^\(\d+\)/.test(l.trim()));
    }
    
    // If parsing failed or simple plan, just use the step text itself
    if (searchTasks.length === 0) {
        searchTasks = [query];
    }

    // 1. Research Phase
    for (let i = 0; i < searchTasks.length; i++) {
        if (signal?.aborted) throw new Error("Aborted");
        
        // Update UI progress (mapped roughly to the single "Research" step in the visual plan, 
        // but we can animate the sub-steps if we had granular UI. 
        // For now, we just pass 0 to keep the "Research" step active).
        onProgress(0); 

        const task = searchTasks[i];
        
        // We append "Status update" to the content stream temporarily so user sees what's happening
        // This is handled by the caller usually, but we can't easily inject it into the final text stream.
        // The App handles the "Thinking..." state visually.

        try {
            const searchPrompt = `
            RESEARCH TASK: ${task}
            CONTEXT: Investigating "${query}"

            GOAL: Find detailed, technical, and concrete information using Google Search.
            - Focus on specific numbers, dates, version requirements, code parameters, or expert opinions.
            - Avoid generic summaries.
            `;

            const response = await ai.models.generateContent({
                model: ModelType.PRO,
                contents: searchPrompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    systemInstruction: "You are a specialized technical researcher. Use Google Search to find precise information.",
                }
            });

            const text = response.text || "";
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            
            allFindings.push(`### Investigation: ${task}\n${text}`);
            
            chunks.forEach((c: any) => {
                if (c.web) allGroundingUrls.push(c.web);
            });

        } catch (e) {
            console.warn(`Task ${i} failed`, e);
            allFindings.push(`### Investigation: ${task}\n(Search unavailable)`);
        }
    }

    if (signal?.aborted) throw new Error("Aborted");
    onProgress(1); // Move to Analysis/Report phase visually

    // 2. Report Phase
    const reportPrompt = `
    You are a Lead Technical Analyst. Create a comprehensive Deep Research Report based on the following findings.

    USER QUERY: ${query}

    RESEARCH FINDINGS:
    ${allFindings.join("\n\n")}

    INSTRUCTIONS:
    - Write in JAPANESE.
    - Structure the report logically with Markdown headings.
    - Synthesize the findings into a cohesive narrative (do not just list them).
    - Be detailed and technical.
    - Cite sources implicitly by using the information provided.
    `;

    const stream = await ai.models.generateContentStream({
        model: ModelType.PRO,
        contents: reportPrompt,
        config: {
            systemInstruction: "You are a professional report writer."
        }
    });

    for await (const chunk of stream) {
        if (signal?.aborted) break;
        onChunk(chunk.text || "");
    }

    // Convert unique URLs
    const uniqueUrls = Array.from(new Set(allGroundingUrls.map(u => JSON.stringify({ title: u.title, uri: u.uri }))))
        .map(s => JSON.parse(s as string));

    return {
        groundingUrls: uniqueUrls
    };
  }

  async generateText(
    model: ModelType,
    history: Message[], 
    mode: AppMode,
    isThinking: boolean,
    currentCanvasContent: string | null,
    onChunk?: (text: string) => void,
    signal?: AbortSignal,
    researchPlan?: string[] // Optional plan for deep research
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
        // Legacy path or simple fallback if executeDeepResearch isn't used
        config.tools = [{ googleSearch: {} }];
        systemInstruction = "You are a Deep Research AI Agent.";
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
      const model = ModelType.IMAGE_PRO;
      
      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: { aspectRatio },
          tools: [{ googleSearch: {} }]
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

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("No video generated");
        
        return `${videoUri}&key=${process.env.API_KEY}`;
    } catch (error) {
        console.error("Gemini Video Generation Error:", error);
        throw error;
    }
  }
}

export const geminiService = new GeminiService();
