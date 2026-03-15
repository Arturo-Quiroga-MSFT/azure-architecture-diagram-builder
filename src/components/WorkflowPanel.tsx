// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ListOrdered, MonitorPlay, StopCircle, Loader2 } from 'lucide-react';
import { AvatarPresenter, AvatarStatus } from '../services/avatarPresenter';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import './WorkflowPanel.css';

interface WorkflowStep {
  step: number;
  description: string;
  services: string[];
}

interface WorkflowPanelProps {
  workflow: WorkflowStep[];
  onServiceHover?: (serviceIds: string[]) => void;
  onServiceLeave?: () => void;
  forceCollapsed?: number;
}

const WorkflowPanel: React.FC<WorkflowPanelProps> = ({ 
  workflow, 
  onServiceHover, 
  onServiceLeave,
  forceCollapsed 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Avatar state
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('idle');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [captionWords, setCaptionWords] = useState<string[]>([]);
  const [captionWordIdx, setCaptionWordIdx] = useState<number>(-1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const presenterRef = useRef<AvatarPresenter | null>(null);
  const isSpeechConfigured = !!import.meta.env.VITE_SPEECH_REGION;

  // Draggable + resizable avatar panel
  const { geom: avatarGeom, onDragStart, onResizeStart, reset: resetAvatarGeom } = useDraggableResizable({
    initial: { x: Math.max(0, window.innerWidth - 800), y: Math.max(0, window.innerHeight - 480), w: 360, h: 330 },
    minW: 260, minH: 220, maxW: 640, maxH: 600,
  });

  React.useEffect(() => {
    if (forceCollapsed) setIsExpanded(false);
  }, [forceCollapsed]);

  // Disconnect avatar on unmount
  useEffect(() => {
    return () => { presenterRef.current?.disconnect(); };
  }, []);

  const buildNarrationText = (): string =>
    workflow.map(s => `Step ${s.step}: ${s.description}`).join('. ');

  const startNarration = async () => {
    setAvatarStatus('connecting');
    // Wait one tick for React to mount the panel and populate refs
    await new Promise(resolve => setTimeout(resolve, 0));
    if (!videoRef.current || !audioRef.current) return;
    try {
      if (!presenterRef.current?.isConnected) {
        const presenter = new AvatarPresenter({
          character: import.meta.env.VITE_AVATAR_CHARACTER || 'lisa',
          style: import.meta.env.VITE_AVATAR_STYLE || 'casual-sitting',
          voice: import.meta.env.VITE_AVATAR_VOICE || 'en-US-AvaMultilingualNeural',
          onStatus: setAvatarStatus,
          onError: (msg) => setAvatarError(msg),
          onWord: (idx) => setCaptionWordIdx(idx),
        });
        presenterRef.current = presenter;
        await presenter.connect(videoRef.current, audioRef.current);
      }
      const text = buildNarrationText();
      setCaptionWords(text.split(/\s+/).filter(Boolean));
      setCaptionWordIdx(-1);
      await presenterRef.current!.speak(text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAvatarError(msg);
      setAvatarStatus('error');
    }
  };

  const handleNarrateClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent collapsing the panel
    if (avatarStatus === 'speaking') {
      presenterRef.current?.stopSpeaking();
    } else {
      void startNarration();
    }
  };

  const handleDismissAvatar = () => {
    presenterRef.current?.disconnect();
    presenterRef.current = null;
    setAvatarStatus('idle');
    setAvatarError(null);
    setCaptionWords([]);
    setCaptionWordIdx(-1);
    resetAvatarGeom();
  };

  if (!workflow || workflow.length === 0) return null;

  return (
    <>
      <div className={`workflow-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="workflow-header" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="workflow-title">
            <ListOrdered size={20} />
            <h3>Architecture Workflow</h3>
            <span className="workflow-count">{workflow.length} steps</span>
          </div>
          <div className="workflow-header-actions">
            {isSpeechConfigured && isExpanded && (
              <button
                className={`workflow-narrate-btn${avatarStatus === 'speaking' ? ' active' : ''}`}
                onClick={handleNarrateClick}
                disabled={avatarStatus === 'connecting'}
                title={avatarStatus === 'speaking' ? 'Stop narration' : 'Have an AI avatar narrate this workflow'}
              >
                {avatarStatus === 'connecting'
                  ? <Loader2 size={13} className="spinner" />
                  : avatarStatus === 'speaking'
                  ? <StopCircle size={13} />
                  : <MonitorPlay size={13} />}
                {avatarStatus === 'connecting' ? 'Connecting…' : avatarStatus === 'speaking' ? 'Stop' : 'Narrate'}
              </button>
            )}
            <button className="workflow-toggle">
              {isExpanded ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="workflow-content">
            <div className="workflow-steps">
              {workflow.map((step) => (
                <div
                  key={step.step}
                  className="workflow-step"
                  onMouseEnter={() => onServiceHover?.(step.services)}
                  onMouseLeave={() => onServiceLeave?.()}
                >
                  <div className="step-number">{step.step}</div>
                  <div className="step-description">
                    <p>{step.description}</p>
                    {step.services && step.services.length > 0 && (
                      <div className="step-services">
                        <span className="services-label">Services:</span>
                        <span className="services-count">{step.services.length} service{step.services.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Avatar Panel — always in DOM so refs are populated as soon as status changes */}
      <div
        className="workflow-avatar-panel"
        style={avatarStatus === 'idle' ? { display: 'none' } : {
          left: avatarGeom.x,
          top: avatarGeom.y,
          width: avatarGeom.w,
          height: avatarGeom.h,
        }}
      >
        <div className="workflow-avatar-panel-header" onPointerDown={onDragStart}>
          <span className="workflow-avatar-panel-title">
            {avatarStatus === 'connecting' && <Loader2 size={12} className="spinner" />}
            {avatarStatus === 'connecting' ? ' Connecting...' :
             avatarStatus === 'speaking' ? '▶ Narrating' :
             avatarStatus === 'error' ? 'Error' : 'Ready'}
          </span>
          <button
            className="workflow-avatar-dismiss"
            onClick={handleDismissAvatar}
            onPointerDown={e => e.stopPropagation()}
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="workflow-avatar-video-wrap">
          {avatarStatus === 'connecting' && (
            <div className="workflow-avatar-connecting">
              <Loader2 size={28} className="spinner" />
              <span>Starting avatar session…</span>
            </div>
          )}
          {avatarStatus === 'error' && (
            <div className="workflow-avatar-error-display">{avatarError}</div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="workflow-avatar-video"
            style={{ display: avatarStatus === 'connecting' ? 'none' : 'block' }}
          />
          <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
        </div>
        {captionWords.length > 0 && avatarStatus === 'speaking' && (
          <div className="workflow-avatar-captions">
            {captionWords.map((word, i) => (
              <span
                key={i}
                className={`workflow-avatar-caption-word${i === captionWordIdx ? ' active' : ''}`}
              >{word}{' '}</span>
            ))}
          </div>
        )}
        {(avatarStatus === 'ready' || avatarStatus === 'speaking') && (
          <div className="workflow-avatar-panel-controls">
            {avatarStatus === 'speaking'
              ? <button className="workflow-avatar-action-btn stop" onClick={() => presenterRef.current?.stopSpeaking()}><StopCircle size={13} /> Stop</button>
              : <button className="workflow-avatar-action-btn" onClick={() => void startNarration()}><MonitorPlay size={13} /> Re-narrate</button>}
          </div>
        )}
        <div className="avatar-resize-handle" onPointerDown={onResizeStart} title="Drag to resize" />
      </div>
    </>
  );
};

export default WorkflowPanel;
