
import React from 'react';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadFile: () => void;
  onDriveSelect: () => void;
  onPhotosSelect: () => void;
}

const AttachmentMenu: React.FC<AttachmentMenuProps> = ({ 
  isOpen, 
  onClose, 
  onUploadFile,
  onDriveSelect,
  onPhotosSelect
}) => {
  if (!isOpen) return null;

  const menuItems = [
    { 
      icon: 'fas fa-paperclip', 
      label: 'ファイルをアップロード', 
      action: onUploadFile,
      color: 'text-[#E3E3E3]'
    },
    { 
      icon: 'fab fa-google-drive', 
      label: 'ドライブから追加', 
      action: onDriveSelect,
      color: 'text-[#E3E3E3]'
    },
    { 
      icon: 'fas fa-images', 
      label: 'フォト', 
      action: onPhotosSelect,
      color: 'text-[#E3E3E3]' 
    },
    { 
      icon: 'fas fa-code', 
      label: 'コードをインポート', 
      action: () => alert('コードエディタからインポートする機能をシミュレートしています'),
      color: 'text-[#E3E3E3]'
    },
    { 
      icon: 'fas fa-book', 
      label: 'NotebookLM', 
      action: () => window.open('https://notebooklm.google.com/', '_blank'),
      color: 'text-[#E3E3E3]'
    }
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute bottom-16 left-0 w-64 bg-[#2D2E31] rounded-2xl shadow-xl z-50 border border-[#444746] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.action();
              onClose();
            }}
            className="w-full text-left px-4 py-3 hover:bg-[#3C3D40] flex items-center gap-4 transition-colors group"
          >
            <i className={`${item.icon} w-5 text-center ${item.color}`}></i>
            <span className="text-sm text-[#E3E3E3] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};

export default AttachmentMenu;
