import React, { useEffect, useRef, useState } from 'react';

interface AudioRecorderState {
  recording: boolean;
  audioUrl: string | null;
}

interface AudioRefs {
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  processorRef: React.MutableRefObject<ScriptProcessorNode | null>;
  mediaStreamRef: React.MutableRefObject<MediaStream | null>;
  audioChunksRef: React.MutableRefObject<Int16Array[]>;
}

function AudioRecorder(): JSX.Element {
  const [recording, setRecording] = useState<AudioRecorderState['recording']>(false);
  const [audioUrl, setAudioUrl] = useState<AudioRecorderState['audioUrl']>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Int16Array[]>([]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    if (recording) return;
    setRecording(true);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    mediaStreamRef.current = stream;

    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      const input = e.inputBuffer.getChannelData(0);
      const buffer = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        buffer[i] = Math.max(-1, Math.min(1, input[i])) * 0x7FFF;
      }
      audioChunksRef.current.push(buffer);
    };

    source.connect(processor);
    processor.connect(audioContextRef.current.destination);
    processorRef.current = processor;
  };

  const stopRecording = () => {
    if (!recording) return;
    setRecording(false);

    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());

    const blob = exportWAV(audioChunksRef.current, 16000);
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    audioChunksRef.current = [];
  };

  const exportWAV = (buffers: Int16Array[], sampleRate: number): Blob => {
    const flat = Int16Array.from(buffers.flat());
    const buffer = new ArrayBuffer(44 + flat.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + flat.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, flat.length * 2, true);

    for (let i = 0; i < flat.length; i++) {
      view.setInt16(44 + i * 2, flat[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  return (
    <div className="p-4">
      <button
        onClick={recording ? stopRecording : startRecording}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>
      {audioUrl && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Playback</h3>
          <audio controls src={audioUrl}></audio>
        </div>
      )}
    </div>
  );
}

export default AudioRecorder;
