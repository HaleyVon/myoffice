import React from 'react';
import { Code, MonitorPlay } from 'lucide-react';

interface PreviewProps {
  code: string;
}

export const Preview: React.FC<PreviewProps> = ({ code }) => {
  return (
    <div className="w-full h-full bg-pm-dark flex flex-col overflow-hidden">
      <div className="bg-pm-panel border-b-4 border-pm-gold p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorPlay size={18} className="text-pm-gold" />
          <h2 className="text-sm font-bold text-pm-gold uppercase tracking-widest" style={{ textShadow: '1px 1px 0px #000' }}>PROTOTYPE_PREVIEW</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-1 bg-pm-magenta text-pm-text pixel-border-sm uppercase">
            LIVE
          </span>
        </div>
      </div>
      
      <div className="flex-1 bg-pm-dark relative">
        {code ? (
          <iframe
            srcDoc={code}
            title="Prototype Preview"
            className="w-full h-full border-0 bg-pm-bg"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-pm-gold-dark">
            <Code size={48} className="mb-4 opacity-50" />
            <p className="text-sm font-medium uppercase">NO CODE GENERATED YET...</p>
            <p className="text-xs mt-2 uppercase">WAITING FOR AGENTS TO COMPLETE EXECUTION.</p>
          </div>
        )}
      </div>
    </div>
  );
};
