
import React, { useState } from 'react';
import { ModelType } from '../types';

interface MessageActionsProps {
  content: string;
  model: ModelType;
}

const MessageActions: React.FC<MessageActionsProps> = ({ content, model }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'ja-JP';
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleExportDocs = () => {
    // 認証フローのシミュレーション
    setShowMenu(false);
    
    // 擬似的な確認ダイアログ
    if (confirm("Google ドキュメントに保存するには、Google アカウントへのアクセス権限が必要です。\n\n「OK」をクリックして認証ページを開きますか？")) {
        setIsAuthenticating(true);
        
        // 認証プロセスのモック（3秒後に完了）
        setTimeout(() => {
            setIsAuthenticating(false);
            alert("認証に成功しました。\n\nドキュメント 'Gemini Export' を作成しました。");
        }, 2000);
    }
  };

  const handleDraftGmail = () => {
    const subject = encodeURIComponent("Geminiによる下書き");
    const body = encodeURIComponent(content);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    setShowMenu(false);
  };

  return (
    <>
        {isAuthenticating && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white text-gray-900 p-8 rounded-lg shadow-2xl flex flex-col items-center max-w-sm w-full">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <h3 className="text-lg font-semibold mb-2">Google アカウントに接続中...</h3>
                    <p className="text-sm text-gray-500 text-center">アクセス権限を確認しています</p>
                </div>
            </div>
        )}

        <div className="flex items-center gap-1 mt-2 text-[#C4C7C5]">
        {/* Primary Actions Row */}
        <button className="p-2 hover:bg-[#2D2E31] rounded-full transition-colors" title="良い回答">
            <i className="far fa-thumbs-up text-sm"></i>
        </button>
        <button className="p-2 hover:bg-[#2D2E31] rounded-full transition-colors" title="悪い回答">
            <i className="far fa-thumbs-down text-sm"></i>
        </button>
        <button className="p-2 hover:bg-[#2D2E31] rounded-full transition-colors" title="別の回答を表示">
            <i className="fas fa-redo-alt text-sm"></i>
        </button>
        <button 
            onClick={handleCopy} 
            className="p-2 hover:bg-[#2D2E31] rounded-full transition-colors relative" 
            title="コピー"
        >
            <i className={`far ${isCopied ? 'fa-check-circle text-green-400' : 'fa-copy'} text-sm`}></i>
        </button>

        {/* More Menu */}
        <div className="relative">
            <button 
            onClick={() => setShowMenu(!showMenu)} 
            className={`p-2 hover:bg-[#2D2E31] rounded-full transition-colors ${showMenu ? 'bg-[#2D2E31] text-[#E3E3E3]' : ''}`} 
            title="その他"
            >
            <i className="fas fa-ellipsis-v text-sm"></i>
            </button>

            {showMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#1E1F20] border border-[#444746] rounded-lg shadow-2xl py-1 z-50 overflow-hidden font-sans">
                <button 
                onClick={handleSpeak}
                className="w-full text-left px-4 py-3 hover:bg-[#2D2E31] flex items-center gap-3 transition-colors border-b border-[#444746]"
                >
                <i className={`fas ${isSpeaking ? 'fa-stop-circle text-red-400' : 'fa-volume-up'} w-5 text-center`}></i>
                <span className="text-sm">{isSpeaking ? '読み上げを停止' : '読み上げる'}</span>
                </button>

                <button 
                onClick={handleExportDocs}
                className="w-full text-left px-4 py-3 hover:bg-[#2D2E31] flex items-start gap-3 transition-colors"
                >
                <i className="fas fa-file-alt w-5 text-center mt-1"></i>
                <div className="flex flex-col">
                    <span className="text-sm">Google ドキュメントにエクスポート</span>
                </div>
                </button>

                <button 
                onClick={handleDraftGmail}
                className="w-full text-left px-4 py-3 hover:bg-[#2D2E31] flex items-center gap-3 transition-colors"
                >
                <i className="far fa-envelope w-5 text-center"></i>
                <span className="text-sm">Gmail で下書きを作成</span>
                </button>

                <button 
                className="w-full text-left px-4 py-3 hover:bg-[#2D2E31] flex items-center gap-3 transition-colors border-t border-[#444746]"
                >
                <i className="far fa-flag w-5 text-center"></i>
                <span className="text-sm">法的な問題を報告</span>
                </button>

                <div className="px-4 py-2 text-[10px] text-[#8E918F] bg-[#131314]/50 border-t border-[#444746] flex items-center gap-1">
                    <i className="fas fa-sparkles text-[#A8C7FA]"></i>
                    モデル: {model === ModelType.PRO ? '3 Pro' : '3 Flash'}
                </div>
            </div>
            )}
            
            {/* Backdrop to close menu */}
            {showMenu && (
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
            )}
        </div>
        </div>
    </>
  );
};

export default MessageActions;
