
import React, { useEffect, useRef, useState } from 'react';
import { dimens } from '../../res/dimens';
import { IcClose, IcRefresh } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const CameraView: React.FC = () => {
    const t = useWechatStrings();
    const { bindTap, bindBack, go } = useWechatGestures();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const updateMomentDraft = useWechatStore(s => s.updateMomentDraft);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        async function startCamera() {
            try {
                const s = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' }, 
                    audio: false 
                });
                setStream(s);
                if (videoRef.current) videoRef.current.srcObject = s;
            } catch (err) {
                console.error("Camera access denied", err);
            }
        }
        startCamera();
        return () => stream?.getTracks().forEach(t => t.stop());
    }, []);

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            updateMomentDraft({ tempCapturedImage: dataUrl });
            // 使用 replace 替换相机页，这样编辑页点击取消会直接回到朋友圈
            go('camera.editImage.open');
        }
    };

    return (
        <div className="absolute inset-0 bg-black z-[110] flex flex-col" data-status-bar-foreground="light">
            <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover w-full" />
            <canvas ref={canvasRef} className="hidden" />
            
            <button {...bindBack<HTMLButtonElement>()} className="absolute top-6 left-6 text-white active:opacity-60">
                <IcClose size={dimens.icSizeCloseLg} />
            </button>

            <div className="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-8">
                <div className="px-6 text-center text-(--app-settings-group-title-size) opacity-80 tracking-wide text-white break-words [overflow-wrap:anywhere]">{t.camera_hint}</div>
                <div className="flex items-center justify-between w-full px-16">
                    <div className="w-8"></div> {/* Placeholder */}
                    <div 
                        {...bindTap<HTMLDivElement>('camera.editImage.open', { onTrigger: takePhoto })}
                        className="w-(--app-item-width-84) h-(--app-item-height-84) rounded-full border-[6px] border-white/30 flex items-center justify-center active:scale-95" style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }}
                    >
                        <div className="w-(--app-card-width-60) h-(--app-item-height-60) bg-app-surface rounded-full"></div>
                    </div>
                    <button className="text-white active:opacity-60">
                        <IcRefresh size={dimens.icSizeCloseLg} />
                    </button>
                </div>
            </div>
            <div className="h-8 bg-black"></div>
        </div>
    );
};
