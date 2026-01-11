
import React, { useEffect, useState } from 'react';

interface KeySelectorProps {
  onKeySelected: () => void;
}

const KeySelector: React.FC<KeySelectorProps> = ({ onKeySelected }) => {
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof window.aistudio !== 'undefined') {
        const isSelected = await window.aistudio.hasSelectedApiKey();
        if (isSelected) {
          onKeySelected();
        }
      }
      setHasChecked(true);
    };
    checkKey();
  }, [onKeySelected]);

  const handleOpenSelectKey = async () => {
    if (typeof window.aistudio !== 'undefined') {
      await window.aistudio.openSelectKey();
      // レースコンディション回避のため、選択ダイアログを開いたら成功とみなして進む
      onKeySelected();
    } else {
      alert("AI Studio 環境が検出されませんでした。");
    }
  };

  if (!hasChecked) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-center">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 text-blue-400 rounded-full">
          <i className="fas fa-key text-2xl"></i>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">APIキーの設定</h2>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Gemini 3 Pro や高品質な画像生成を利用するには、有料プロジェクトのAPIキーを選択する必要があります。これにより従量課金制で制限なくツールを利用できます。
        </p>
        
        <button
          onClick={handleOpenSelectKey}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-900/20 mb-4"
        >
          APIキーを選択して開始
        </button>

        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-slate-500 hover:text-blue-400 underline transition-colors"
        >
          課金設定とAPIキーについて
        </a>
      </div>
    </div>
  );
};

export default KeySelector;
