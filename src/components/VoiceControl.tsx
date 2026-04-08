import React, { useState, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface VoiceControlProps {
  projectContext: string;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({ projectContext }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);

  const connect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction: `당신은 소규모 IT 팀의 PM인 Alice입니다. 현재 프로젝트 컨텍스트: ${projectContext || '아직 구체적인 프로젝트가 없습니다.'}. 사용자와 음성으로 대화하며 프로젝트 진행 상황을 보고하거나 질문에 답하세요. 항상 한국어로 대답하세요.`,
        },
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Setup audio input
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });
            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
            
            source.connect(processor);
            processor.connect(audioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              if (!playbackContextRef.current) {
                playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
              }
              const audioCtx = playbackContextRef.current;
              
              // Convert base64 to ArrayBuffer
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // For raw PCM from Gemini Live API, we need to decode it manually if it's raw PCM.
              // However, the Live API usually returns audio that decodeAudioData can handle if it's properly formatted,
              // or we might need to play raw PCM. Actually, decodeAudioData might fail on raw PCM.
              // The documentation says: "Implement manual PCM encoding/decoding. Do not use AudioContext.decodeAudioData on raw streams."
              // Let's implement manual PCM decoding for 24kHz.
              
              const pcm16 = new Int16Array(bytes.buffer);
              const audioBuffer = audioCtx.createBuffer(1, pcm16.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 32768.0;
              }
              
              const source = audioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioCtx.destination);
              source.start();
            }
          },
          onerror: (err) => {
            console.error(err);
            setError("연결 오류가 발생했습니다.");
            disconnect();
          },
          onclose: () => {
            disconnect();
          }
        }
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (err) {
      console.error(err);
      setError("마이크 권한을 확인하거나 다시 시도해주세요.");
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative">
      <div>
        <h3 className="text-sm font-bold text-slate-800">PM(Alice)과 음성 회의</h3>
        <p className="text-xs text-slate-500">마이크를 켜고 실시간으로 대화하세요.</p>
      </div>
      <button
        onClick={isConnected ? disconnect : connect}
        disabled={isConnecting}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          isConnected 
            ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {isConnecting ? (
          <><Loader2 size={16} className="animate-spin" /> 연결 중...</>
        ) : isConnected ? (
          <><MicOff size={16} /> 통화 종료</>
        ) : (
          <><Mic size={16} /> 통화 연결</>
        )}
      </button>
      {error && <p className="text-xs text-red-500 absolute -bottom-6 right-0">{error}</p>}
    </div>
  );
};
