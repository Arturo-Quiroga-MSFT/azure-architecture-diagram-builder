// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Standalone, shareable video tour at /videos (?v=<video id>&t=<seconds>). Renders without the editor.

import React, { useEffect, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import VideoTour from './VideoTour';
import './VideoTour.css';

const VideoTourPage: React.FC = () => {
  const selection = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const video = params.get('v');
    const at = Number(params.get('t'));
    return video ? { video, at: Number.isFinite(at) && at > 0 ? at : 0 } : null;
  }, []);

  useEffect(() => { document.title = 'Video tour · Azure Architecture Diagram Builder'; }, []);

  return (
    <div className="video-tour-page-shell">
      <header className="video-tour-page-header">
        <div><strong>Azure Architecture Diagram Builder</strong><span>Video tour</span></div>
        <a href="/">Open the app <ArrowRight size={15} /></a>
      </header>
      <main className="video-tour-page-main">
        <VideoTour variant="page" source="page" selection={selection} />
      </main>
    </div>
  );
};

export default VideoTourPage;
