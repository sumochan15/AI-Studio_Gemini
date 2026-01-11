
export enum AppMode {
  CHAT = 'CHAT',
  CANVAS = 'CANVAS',
  DEEP_RESEARCH = 'DEEP_RESEARCH',
  IMAGE_GENERATION = 'IMAGE_GENERATION',
  VIDEO_GENERATION = 'VIDEO_GENERATION'
}

export enum ModelType {
  PRO = 'gemini-3-pro-preview',
  FLASH = 'gemini-3-flash-preview',
  IMAGE_PRO = 'gemini-3-pro-image-preview',
  IMAGE_FLASH = 'gemini-2.5-flash-image',
  VEO = 'veo-3.1-fast-generate-preview'
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  mimeType: string;
  data: string; // Base64 string
  name: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'video' | 'error';
  images?: string[];
  videoUri?: string;
  attachments?: Attachment[]; // Added for generic file attachments
  groundingUrls?: { title: string; uri: string }[];
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number; // Last updated
  mode: AppMode;
  isThinking?: boolean; // Added for Thinking Mode
}

export interface AppState {
  mode: AppMode;
  model: ModelType;
  isThinking: boolean; // Added for Thinking Mode selection
  useSearch: boolean;
  messages: Message[];
  sessions: ChatSession[]; // Chat history
  currentSessionId: string | null;
  isGenerating: boolean;
  hasKey: boolean;
  // Canvas specific state
  canvasContent: string;
  isCanvasOpen: boolean;
  sidebarOpen: boolean;
}
