import { useEffect, useRef, useState } from 'react';
import type { Recommendation } from '../../engine/recommend';
import { shareLines } from '../../engine/shareText';
import { STATUS_META } from '../../engine/status';
import { Section } from '../ui';

const W = 1080;
const H = 1350;

function cssVar(name: string, fallback: string) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

function draw(canvas: HTMLCanvasElement, r: Recommendation, lines: string[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = '#111512';
  ctx.fillRect(0, 0, W, H);
  // contour lines for texture
  ctx.strokeStyle = 'rgba(241,236,224,0.06)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = 900 + i * 34 - Math.sin(x / 170 + i * 0.6) * 60 - Math.cos(x / 90 + i) * 14 - (x / W) * 120;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const statusColor = { send: '#3ecf6e', worth: '#f5c518', questionable: '#ff8a2a', skip: '#ff4d4d', unknown: '#a3a3a3' }[r.status];
  const display = "800 {s}px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  ctx.fillStyle = '#ff6b1a';
  ctx.font = display.replace('{s}', '54');
  ctx.fillText('R I D E O U T', 80, 130);
  ctx.fillStyle = '#f1ece0';
  let size = 130;
  ctx.font = display.replace('{s}', String(size));
  while (ctx.measureText(r.area.name.toUpperCase()).width > W - 160 && size > 60) {
    size -= 6;
    ctx.font = display.replace('{s}', String(size));
  }
  ctx.fillText(r.area.name.toUpperCase(), 80, 290);
  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(104, 390, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = display.replace('{s}', '88');
  ctx.fillText(STATUS_META[r.status].label, 150, 420);
  ctx.fillStyle = '#f1ece0';
  ctx.font = "500 40px Inter, system-ui, sans-serif";
  const body = lines.slice(3).filter((l) => !/^(🟢|🟡|🟠|🔴|⚪) /.test(l));
  let y = 520;
  for (const line of body) {
    if (!line) {
      y += 20;
      continue;
    }
    for (const w of wrap(ctx, line, W - 160)) {
      if (y > H - 90) break;
      ctx.fillText(w, 80, y);
      y += 54;
    }
  }
  ctx.fillStyle = cssVar('--ink-3', '#8a8679');
  ctx.font = '500 28px Inter, system-ui, sans-serif';
  ctx.fillText('Find the ride. Know the ride. Get out there.', 80, H - 50);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

export function ShareCard({ r, dateLabel }: { r: Recommendation; dateLabel: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const lines = shareLines(r, dateLabel);
  const text = lines.join('\n');

  useEffect(() => {
    if (open && ref.current) draw(ref.current, r, lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, text]);

  const share = async () => {
    setMsg(null);
    const canvas = ref.current;
    try {
      const blob: Blob | null = canvas ? await new Promise((res) => canvas.toBlob(res, 'image/png')) : null;
      const file = blob ? new File([blob], `rideout-${r.area.id}.png`, { type: 'image/png' }) : null;
      if (navigator.share && file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: `RIDEOUT · ${r.area.name}` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text, title: `RIDEOUT · ${r.area.name}` });
        return;
      }
      await copy();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') await copy();
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Copied ride summary to clipboard.');
    } catch {
      setMsg('Copy failed. Long-press the text below to copy it.');
    }
  };
  const download = () => {
    const url = ref.current?.toDataURL('image/png');
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `rideout-${r.area.id}.png`;
    a.click();
  };

  return (
    <Section title="Share this ride" id="share">
      {!open ? (
        <button type="button" className="btn primary block" onClick={() => setOpen(true)} data-testid="make-card">
          Make ride card
        </button>
      ) : (
        <div data-testid="share-card">
          <canvas ref={ref} className="card" aria-label={`Ride card for ${r.area.name}`} />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn primary" onClick={share} data-testid="share">
              Share
            </button>
            <button type="button" className="btn" onClick={copy} data-testid="copy">
              Copy text
            </button>
            <button type="button" className="btn" onClick={download}>
              Save image
            </button>
          </div>
          {msg && (
            <p role="status" className="muted">
              {msg}
            </p>
          )}
          <details>
            <summary>Text version</summary>
            <pre className="share-preview" data-testid="share-text">
              {text}
            </pre>
          </details>
        </div>
      )}
    </Section>
  );
}
