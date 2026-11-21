import React, { useEffect, useRef } from 'react';
import { Flame, Star } from 'lucide-react';
import type { SessionResult } from '../types/learning';
import { playTone } from '../utils/audio';

interface CompleteModalProps {
  result: SessionResult;
  streak: number;
  soundEnabled: boolean;
  onDone: () => void;
}

export const CompleteModal: React.FC<CompleteModalProps> = ({
  result,
  streak,
  soundEnabled,
  onDone,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    playTone('complete', soundEnabled);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#4AA802', '#0284C7', '#F59E0B', '#E11D48', '#9333EA'];
    const pieces = Array.from({ length: 65 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 5 + 4,
      c: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3 + 2.2,
      vx: Math.random() * 2 - 1,
    }));

    let frame = 0;
    let rafId = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.vy;
        p.x += p.vx;
      }
      frame += 1;
      if (frame < 120) {
        rafId = window.requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [soundEnabled]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-modal-title"
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-10"
      />

      <div className="relative z-20 max-w-md w-full space-y-8 animate-pop">
        <div>
          <div className="text-7xl mb-4" aria-hidden="true">
            {result.emoji}
          </div>
          <h2
            id="complete-modal-title"
            className="text-2xl sm:text-3xl font-extrabold text-[#357A00] text-balance"
          >
            {result.title}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
            {result.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-amber-700">നേടിയ XP</div>
            <div className="text-2xl font-extrabold text-amber-600 font-latin tabular-nums mt-1.5 flex items-center justify-center gap-1.5">
              <span>+{result.earnedXp}</span>
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" aria-hidden="true" />
            </div>
          </div>

          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-orange-700">സ്ട്രീക്ക്</div>
            <div className="text-2xl font-extrabold text-orange-600 font-latin tabular-nums mt-1.5 flex items-center justify-center gap-1.5">
              <span>{streak}</span>
              <Flame className="w-5 h-5 fill-orange-500 text-orange-500" aria-hidden="true" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playTone('tap', soundEnabled);
            onDone();
          }}
          className="btn-3d w-full py-4 rounded-2xl bg-[#4AA802] border-b-4 border-[#388000] hover:bg-[#429602] text-white font-extrabold text-base"
        >
          തുടരുക
        </button>
      </div>
    </div>
  );
};
