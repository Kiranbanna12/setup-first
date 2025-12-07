import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UniversalVideoPlayerProps {
  url: string;
  onTimeUpdate?: (time: number) => void;
}

type QualityOption = 'auto' | '720p' | '480p' | '360p'; // Real browser downscaling options
type SpeedOption = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;

export const UniversalVideoPlayer = forwardRef<any, UniversalVideoPlayerProps>(
  ({ url, onTimeUpdate }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [platform, setPlatform] = useState<string>("unknown");
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    // Update parent component whenever currentTime changes
    useEffect(() => {
      onTimeUpdate?.(currentTime);
    }, [currentTime, onTimeUpdate]);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);

    // Quality and speed controls with browser downscaling
    const [playbackSpeed, setPlaybackSpeed] = useState<SpeedOption>(1);
    const [quality, setQuality] = useState<QualityOption>('720p'); // Default to 720p for performance

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (platform === 'direct' || platform === 'dropbox' || platform === 'google-drive') {
          if (videoRef.current) {
            videoRef.current.currentTime = seconds;
          }
        } else if (platform === 'youtube' && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
            '*'
          );
        } else if (platform === 'vimeo' && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { method: 'setCurrentTime', value: seconds } as any,
            '*'
          );
        }
        // Note: OneDrive iframe embed doesn't support programmatic seeking
      },
      getCurrentTime: () => {
        if (platform === 'direct' || platform === 'dropbox' || platform === 'google-drive') {
          return videoRef.current?.currentTime || 0;
        }
        return currentTime;
      }
    }));

    useEffect(() => {
      detectPlatform(url);
    }, [url]);

    useEffect(() => {
      const onMessage = (event: MessageEvent) => {
        try {
          // Handle different message formats
          let data;
          if (typeof event.data === 'string') {
            try {
              data = JSON.parse(event.data);
            } catch (parseError) {
              // Skip non-JSON messages (like Google Drive internal messages)
              return;
            }
          } else {
            data = event.data;
          }

          // YouTube infoDelivery events
          if (data?.event === 'infoDelivery' && typeof data?.info?.currentTime === 'number') {
            const t = data.info.currentTime as number;
            setCurrentTime(t);
            onTimeUpdate?.(t);
          }

          // Vimeo timeupdate events
          if (data?.event === 'timeupdate' && typeof data?.data?.seconds === 'number') {
            const t = data.data.seconds as number;
            setCurrentTime(t);
            onTimeUpdate?.(t);
          }

          // YouTube state change events
          if (data?.event === 'onStateChange' && data?.info?.currentTime !== undefined) {
            const t = data.info.currentTime as number;
            setCurrentTime(t);
            onTimeUpdate?.(t);
          }

          // YouTube player ready event
          if (data?.event === 'onReady') {
            // Request time updates
            const cw = iframeRef.current?.contentWindow;
            cw?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }), '*');
            cw?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onPlaybackQualityChange'] }), '*');
          }

          // YouTube getCurrentTime response
          if (data?.event === 'command' && data?.func === 'getCurrentTime' && typeof data?.value === 'number') {
            const t = data.value as number;
            setCurrentTime(t);
            onTimeUpdate?.(t);
          }
        } catch (error) {
          // Silent error handling
        }
      };

      if (platform === 'youtube' || platform === 'vimeo' || platform === 'google-drive') {
        window.addEventListener('message', onMessage);

        // Set up periodic time requests for YouTube
        const interval = setInterval(() => {
          const cw = iframeRef.current?.contentWindow;
          if (platform === 'youtube' && cw) {
            cw.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime' }), '*');
          }
        }, 1000); // Reduced frequency to avoid spam

        // Also try to listen for YouTube events
        const youtubeInterval = setInterval(() => {
          const cw = iframeRef.current?.contentWindow;
          if (platform === 'youtube' && cw) {
            // Try different message formats
            cw.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
            cw.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime' }), '*');
          }
        }, 2000);

        return () => {
          window.removeEventListener('message', onMessage);
          clearInterval(interval);
          clearInterval(youtubeInterval);
        };
      }
    }, [platform]);

    const detectPlatform = (videoUrl: string) => {
      if (!videoUrl) {
        setPlatform("unknown");
        return;
      }

      if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
        setPlatform("youtube");
      } else if (videoUrl.includes("drive.google.com") || videoUrl.includes("docs.google.com")) {
        setPlatform("google-drive"); // Use iframe for Google Drive
      } else if (videoUrl.includes("dropbox.com")) {
        setPlatform("direct"); // Use custom player for Dropbox with time tracking
      } else if (
        videoUrl.includes("onedrive.live.com") ||
        videoUrl.includes("sharepoint.com") ||
        videoUrl.includes("1drv.ms") ||
        videoUrl.includes("-my.sharepoint.com")
      ) {
        setPlatform("onedrive"); // Use iframe for OneDrive (not supported)
      } else if (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.endsWith('.mov')) {
        setPlatform("direct");
      } else {
        setPlatform("unknown");
      }
    };

    const getEmbedUrl = (videoUrl: string) => {
      if (!videoUrl) return "";

      if (platform === 'youtube') {
        const videoId = extractYouTubeId(videoUrl);
        const origin = window.location.origin;
        return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(origin)}&rel=0&modestbranding=1&showinfo=0&fs=1&controls=1&autoplay=0&loop=0&start=0`;
      } else if (platform === 'vimeo') {
        const videoId = extractVimeoId(videoUrl);
        return `https://player.vimeo.com/video/${videoId}?byline=0&portrait=0&title=0`;
      } else if (platform === 'onedrive') {
        // OneDrive videos need special handling - use embed player with proper parameters
        // This avoids authentication issues with direct download
        let embedUrl = videoUrl;

        // For 1drv.ms or onedrive.live.com links, convert to embed format
        if (videoUrl.includes('1drv.ms') || videoUrl.includes('onedrive.live.com')) {
          // Keep original URL and add embed parameter
          embedUrl = videoUrl.replace('/view', '/embed');
          embedUrl = embedUrl.replace('/edit', '/embed');

          // Ensure embed parameters are present
          if (!embedUrl.includes('embed')) {
            // If it's a view link, replace with embed
            embedUrl = embedUrl.replace('?', '/embed?');
          }

          // Add autoplay and other video parameters
          if (!embedUrl.includes('action=')) {
            embedUrl += embedUrl.includes('?') ? '&action=embedview' : '?action=embedview';
          }
        }

        return embedUrl;
      } else if (platform === 'dropbox') {
        // Check if it's already a streaming URL from our backend
        if (videoUrl.includes('/api/stream/dropbox')) {
          return videoUrl; // Use backend streaming endpoint directly
        }

        // Use backend streaming endpoint for shared links
        if (videoUrl.includes('dropbox.com')) {
          return `/api/stream/dropbox-shared?url=${encodeURIComponent(videoUrl)}`;
        }

        // Fallback to direct download
        return videoUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
      }

      // Handle direct video files - use iframe for Google Drive and Dropbox
      if (videoUrl.includes("drive.google.com") || videoUrl.includes("docs.google.com")) {
        // Convert to embed URL for iframe
        const fileId = extractGoogleDriveId(videoUrl);
        if (fileId) {
          return `https://drive.google.com/file/d/${fileId}/preview`;
        }
      }

      if (videoUrl.includes("dropbox.com")) {
        // Convert to direct download URL for HTML5 video player
        if (videoUrl.includes('dropbox.com/s/')) {
          return videoUrl.replace('dropbox.com/s/', 'dl.dropboxusercontent.com/s/') + '?raw=1';
        }
        return videoUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
      }

      // OneDrive videos currently not supported due to authentication restrictions
      if (videoUrl.includes("onedrive.live.com") || videoUrl.includes("1drv.ms")) {
        console.log('OneDrive URL detected - showing unsupported message');
        return "UNSUPPORTED_ONEDRIVE";
      }

      // Convert 1drv.ms short links to embed URLs
      if (videoUrl.includes("1drv.ms")) {
        // For 1drv.ms links, return as-is since they redirect to proper share URLs
        return videoUrl;
      }

      return videoUrl;
    };

    const extractYouTubeId = (url: string) => {
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      return match ? match[1] : "";
    };

    const extractGoogleDriveId = (url: string) => {
      // Handle different Google Drive URL formats
      const patterns = [
        /\/d\/([a-zA-Z0-9_-]+)/,  // Standard format
        /id=([a-zA-Z0-9_-]+)/,     // Alternative format
        /\/file\/d\/([a-zA-Z0-9_-]+)/, // File format
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }

      return "";
    };

    const extractVimeoId = (url: string) => {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? match[1] : "";
    };

    const handlePlayPause = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsPlaying(true);
              })
              .catch(err => {
                console.error('Play failed:', err.message);
                setIsPlaying(false);
              });
          }
        }
      }
    };

    const handleMuteToggle = () => {
      if (videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    const handleVolumeChange = (value: number[]) => {
      if (videoRef.current) {
        videoRef.current.volume = value[0];
        setVolume(value[0]);
      }
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
      }
    };

    const handleSeek = (value: number[]) => {
      if (videoRef.current) {
        videoRef.current.currentTime = value[0];
        setCurrentTime(value[0]);
      }
    };

    const handleFullscreen = () => {
      if (videoRef.current) {
        videoRef.current.requestFullscreen();
      }
    };

    const handleSpeedChange = (speed: SpeedOption) => {
      setPlaybackSpeed(speed);
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
    };

    const handleQualityChange = (newQuality: QualityOption) => {
      setQuality(newQuality);

      // Apply browser-based downscaling for performance
      if (videoRef.current) {
        const video = videoRef.current;

        // Get video dimensions
        const videoWidth = video.videoWidth || 1920;
        const videoHeight = video.videoHeight || 1080;

        // Calculate new dimensions based on quality
        let newWidth = videoWidth;
        let newHeight = videoHeight;

        switch (newQuality) {
          case '720p':
            newHeight = 720;
            newWidth = Math.floor((720 * videoWidth) / videoHeight);
            break;
          case '480p':
            newHeight = 480;
            newWidth = Math.floor((480 * videoWidth) / videoHeight);
            break;
          case '360p':
            newHeight = 360;
            newWidth = Math.floor((360 * videoWidth) / videoHeight);
            break;
          case 'auto':
            // Use original dimensions
            break;
        }

        // Apply CSS transform for downscaling
        const container = video.parentElement;
        if (container) {
          if (newQuality !== 'auto') {
            video.style.width = `${newWidth}px`;
            video.style.height = `${newHeight}px`;
            video.style.objectFit = 'contain';
            video.style.transform = 'scale(1)';
          } else {
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            video.style.transform = 'scale(1)';
          }
        }
      }
    };

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (!url) {
      return (
        <div className="w-full aspect-video bg-muted flex items-center justify-center">
          <p className="text-muted-foreground">No video URL provided</p>
        </div>
      );
    }

    const embedSrc = getEmbedUrl(url);

    // Handle unsupported OneDrive videos with clear message
    if (embedSrc === "UNSUPPORTED_ONEDRIVE") {
      return (
        <div className="w-full aspect-video bg-muted flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center space-y-3 p-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">OneDrive Videos Not Supported</h3>
              <p className="text-sm text-gray-600 mt-1">
                OneDrive videos require authentication and cannot be played directly in this player.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Try downloading the video and uploading it directly, or use YouTube/Dropbox for best compatibility.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // For platforms with native embeds (YouTube, Google Drive)
    if (["youtube", "vimeo", "google-drive"].includes(platform)) {
      const embedSrc = getEmbedUrl(url);

      return (
        <div className="w-full aspect-video bg-black">
          <iframe
            ref={iframeRef}
            src={embedSrc}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      );
    }

    // For direct video files (includes Dropbox with custom player)
    if (platform === "direct") {
      // Convert URL to streaming endpoint if needed (Dropbox direct URLs)
      const videoSrc = getEmbedUrl(url);

      return (
        <div className="w-full bg-black relative group">
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full aspect-video"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="auto"
            crossOrigin="anonymous"
          />

          {/* Custom Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <Slider
              value={[currentTime]}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="mb-4"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePlayPause}
                  className="text-white hover:text-white"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleMuteToggle}
                  className="text-white hover:text-white"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>

                <Slider
                  value={[volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-24"
                />

                <span className="text-white text-sm ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Speed indicator when not 1x */}
                {playbackSpeed !== 1 && (
                  <span className="text-white text-xs bg-blue-600/80 px-2 py-1 rounded">
                    {playbackSpeed}x
                  </span>
                )}

                {/* Settings dropdown for speed and quality controls */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:text-white"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuLabel>Playback Speed</DropdownMenuLabel>
                    {([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as SpeedOption[]).map((speed) => (
                      <DropdownMenuItem
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className="flex justify-between"
                      >
                        <span>{speed}x</span>
                        {playbackSpeed === speed && <Check className="w-4 h-4" />}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Video Quality (Performance)</DropdownMenuLabel>
                    {(['auto', '720p', '480p', '360p'] as QualityOption[]).map((q) => (
                      <DropdownMenuItem
                        key={q}
                        onClick={() => handleQualityChange(q)}
                        className="flex justify-between"
                      >
                        <span>{q === 'auto' ? 'Original (4K)' : `${q} (Faster)`}</span>
                        {quality === q && <Check className="w-4 h-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleFullscreen}
                  className="text-white hover:text-white"
                >
                  <Maximize className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Fallback for unknown platforms
    return (
      <div className="w-full aspect-video bg-muted flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground text-center">
          This video platform is not directly supported for embedded playback.
        </p>
        <Button asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open in New Tab
          </a>
        </Button>
      </div>
    );
  }
);

UniversalVideoPlayer.displayName = "UniversalVideoPlayer";
