
import React, { useEffect, useState } from 'react';

interface DeepResearchViewProps {
  steps: string[];
  state: 'planning' | 'proposed' | 'in_progress' | 'completed';
  currentStepIndex?: number;
  onStartResearch?: (steps: string[]) => void;
}

const DeepResearchView: React.FC<DeepResearchViewProps> = ({ steps, state, currentStepIndex, onStartResearch }) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editableSteps, setEditableSteps] = useState<string[]>([]);

  // Initialize editable steps when steps change
  useEffect(() => {
    if (steps.length > 0) {
        setEditableSteps(steps);
    }
  }, [steps]);

  // Sync with prop if provided
  useEffect(() => {
    if (typeof currentStepIndex === 'number') {
        setActiveStepIndex(currentStepIndex);
    }
  }, [currentStepIndex]);

  // Fallback simulation if no explicit prop is driving progress
  useEffect(() => {
    if (state === 'in_progress' && typeof currentStepIndex === 'undefined') {
      const interval = setInterval(() => {
        setActiveStepIndex(prev => {
          if (prev < steps.length - 1) return prev + 1;
          return prev;
        });
      }, 5000); 
      return () => clearInterval(interval);
    } else if (state === 'completed') {
      setActiveStepIndex(steps.length);
    }
  }, [state, steps.length, currentStepIndex]);

  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...editableSteps];
    newSteps[index] = value;
    setEditableSteps(newSteps);
  };

  const handleStartClick = () => {
    if (onStartResearch) {
        onStartResearch(isEditing ? editableSteps : steps);
    }
    setIsEditing(false);
  };

  const isProposed = state === 'proposed';

  return (
    <div className="bg-[#1E1F20] rounded-xl border border-[#444746] p-5 w-full max-w-2xl mb-4 font-sans shadow-lg">
        <div className="flex items-center gap-2 mb-4">
            <i className="fas fa-search-location text-[#A8C7FA]"></i>
            <span className="text-[#E3E3E3] font-medium text-sm">Deep Research</span>
            <span className="text-xs text-[#8E918F] ml-auto">
                {state === 'completed' ? '完了' : isProposed ? '計画を確認' : '詳細なリサーチを実行中...'}
            </span>
        </div>

        <div className="space-y-4">
            {/* Dynamic Steps */}
            {(isEditing ? editableSteps : steps).map((step, index) => {
                const isCompleted = state === 'completed' || index < activeStepIndex;
                const isActive = state === 'in_progress' && index === activeStepIndex;

                return (
                    <div key={index} className="flex items-start gap-3">
                        <div className="mt-1 relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                            {state === 'proposed' ? (
                                <span className="text-[#8E918F] text-xs font-mono">({index + 1})</span>
                            ) : isCompleted ? (
                                <i className="fas fa-check-circle text-[#444746]"></i>
                            ) : isActive ? (
                                <div className="w-4 h-4 border-2 border-[#A8C7FA] border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <div className="w-2 h-2 bg-[#444746] rounded-full"></div>
                            )}
                        </div>
                        <div className={`flex-1 text-sm whitespace-pre-wrap leading-relaxed ${isActive || isCompleted || isProposed ? 'text-[#E3E3E3]' : 'text-[#8E918F]'}`}>
                            {isEditing ? (
                                <textarea
                                    value={step}
                                    onChange={(e) => handleStepChange(index, e.target.value)}
                                    className="w-full bg-[#2D2E31] border border-[#444746] rounded px-2 py-2 text-[#E3E3E3] focus:outline-none focus:border-[#A8C7FA] min-h-[80px] resize-y"
                                />
                            ) : (
                                <>
                                    {step}
                                    {isActive && (
                                        <div className="mt-1 text-xs text-[#A8C7FA] animate-pulse font-normal">
                                            情報を収集中...
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Final Report Step (Static) */}
            <div className="flex items-start gap-3">
                <div className="mt-1 relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                     {state === 'completed' ? (
                         <i className="fas fa-check-circle text-[#A8C7FA]"></i>
                     ) : (
                         <div className="w-2 h-2 bg-[#444746] rounded-full"></div>
                     )}
                </div>
                <div className={`flex-1 text-sm ${state === 'completed' ? 'text-[#E3E3E3]' : 'text-[#8E918F]'}`}>
                    レポートを作成
                </div>
            </div>
        </div>

        {/* Action Buttons for Proposed State */}
        {isProposed && (
            <div className="mt-6 flex gap-3 justify-end border-t border-[#444746] pt-4">
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 rounded-full border border-[#444746] hover:bg-[#2D2E31] text-[#E3E3E3] text-sm transition-colors"
                >
                    {isEditing ? '編集を完了' : '計画を編集'}
                </button>
                <button
                    onClick={handleStartClick}
                    className="px-4 py-2 rounded-full bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#000000] text-sm font-medium transition-colors"
                >
                    リサーチを開始
                </button>
            </div>
        )}
    </div>
  );
};

export default DeepResearchView;
