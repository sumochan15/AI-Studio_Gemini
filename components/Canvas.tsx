
import React from 'react';

interface CanvasProps {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onChange: (newContent: string) => void;
}

const Canvas: React.FC<CanvasProps> = ({ content, isOpen, onClose, onChange }) => {
  if (!isOpen) return null;

  const getMarkdownText = () => {
    // @ts-ignore
    if (typeof window.marked !== 'undefined') {
       // @ts-ignore
      return { __html: window.marked.parse(content || "") };
    }
    return { __html: content };
  };

  return (
    <div className="w-[45%] h-full bg-[#1E1F20] border-l border-[#444746] flex flex-col shadow-2xl z-10 transition-all duration-300">
      {/* Canvas Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#444746] bg-[#1E1F20]">
        <div className="flex items-center gap-3">
            <i className="fas fa-pen-nib text-[#A8C7FA]"></i>
            <span className="font-google font-medium text-[#E3E3E3] text-sm">Canvas</span>
        </div>
        <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-[#2D2E31] rounded-full text-[#C4C7C5] transition-colors" title="Copy">
                <i className="far fa-copy text-sm"></i>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-[#2D2E31] rounded-full text-[#C4C7C5] transition-colors" title="Close">
                <i className="fas fa-times text-sm"></i>
            </button>
        </div>
      </div>

      {/* Canvas Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative group">
        {/* Rendered View (Preview) */}
        {content ? (
            <div 
                className="markdown-body p-8 text-[#E3E3E3] min-h-full text-[14px]"
                dangerouslySetInnerHTML={getMarkdownText()}
            />
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#8E918F] p-8 text-center">
                <i className="fas fa-file-alt text-4xl mb-4 opacity-50"></i>
                <p className="text-sm">ここに生成されたコンテンツが表示されます</p>
                <p className="text-xs mt-2 text-[#C4C7C5]">"ブログ記事を書いて" や "コードを生成して" と話しかけてみてください</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;
