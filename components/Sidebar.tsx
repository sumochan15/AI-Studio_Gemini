
import React from 'react';
import { AppMode, AppState } from '../types';

interface SidebarProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onCreateSession: () => void;
  onSwitchSession: (sessionId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ state, setState, onCreateSession, onSwitchSession }) => {
  const isOpen = state.sidebarOpen;

  if (!isOpen) return null;

  return (
    <div className={`h-full bg-[#1E1F20] flex flex-col transition-all duration-300 ${isOpen ? 'w-64' : 'w-0 opacity-0 overflow-hidden'} border-r border-[#444746] hidden md:flex`}>
      <div className="p-4">
        <button 
            onClick={onCreateSession}
            className="w-full text-left px-3 py-2 rounded-full bg-[#2D2E31] hover:bg-[#38393A] text-[#E3E3E3] text-sm truncate flex items-center gap-2 transition-colors mb-6 border border-[#444746]"
        >
            <i className="fas fa-plus text-xs"></i>
            新しいチャット
        </button>

        <div className="text-xs font-medium text-[#C4C7C5] mb-2 px-3">最近</div>
        
        <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
            {state.sessions.length === 0 ? (
                <div className="px-3 text-xs text-[#8E918F]">履歴はありません</div>
            ) : (
                state.sessions.map((session) => (
                    <button 
                        key={session.id}
                        onClick={() => onSwitchSession(session.id)}
                        className={`w-full text-left px-3 py-2 rounded-full text-sm truncate flex items-center gap-2 transition-colors ${
                            state.currentSessionId === session.id 
                            ? 'bg-[#0B57D0]/20 text-[#E3E3E3]' 
                            : 'hover:bg-[#2D2E31] text-[#C4C7C5]'
                        }`}
                    >
                        <i className="far fa-comment text-xs opacity-70"></i>
                        <span className="truncate">{session.title}</span>
                    </button>
                ))
            )}
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-[#444746]">
        <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#2D2E31] text-[#C4C7C5] text-sm flex items-center gap-3 transition-colors">
            <i className="fas fa-gem text-[#A8C7FA]"></i>
            <div>
                <div className="font-medium text-[#E3E3E3]">Gemini Manager</div>
                <div className="text-[10px]">設定と管理</div>
            </div>
        </button>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[#8E918F] px-3">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            AJ Gemini Studio
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
