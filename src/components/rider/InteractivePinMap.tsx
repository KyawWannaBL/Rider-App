import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Minus, Plus } from "lucide-react";

type Point = { latitude: number; longitude: number };

const TILE = 256;

function clampLat(lat:number){ return Math.max(-85.05112878, Math.min(85.05112878, lat)); }
function worldFromLatLng(lat:number,lng:number,zoom:number){
  const n=Math.pow(2,zoom);
  const x=((lng+180)/360)*n*TILE;
  const r=clampLat(lat)*Math.PI/180;
  const y=(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n*TILE;
  return {x,y};
}
function latLngFromWorld(x:number,y:number,zoom:number){
  const n=Math.pow(2,zoom)*TILE;
  const lng=x/n*360-180;
  const a=Math.PI*(1-2*y/n);
  const lat=(180/Math.PI)*Math.atan(Math.sinh(a));
  return {latitude:clampLat(lat),longitude:lng};
}

export function InteractivePinMap({
  point,
  onPointChange,
  interactive=true,
  className="",
}:{
  point: Point | null;
  onPointChange?: (point:Point)=>void;
  interactive?: boolean;
  className?: string;
}){
  const ref=useRef<HTMLDivElement|null>(null);
  const [size,setSize]=useState({w:360,h:360});
  const [zoom,setZoom]=useState(17);
  const fallback={latitude:16.8409,longitude:96.1735};
  const center=point||fallback;
  const centerWorld=useMemo(()=>worldFromLatLng(center.latitude,center.longitude,zoom),[center.latitude,center.longitude,zoom]);

  useEffect(()=>{
    if(!ref.current) return;
    const update=()=>setSize({w:ref.current?.clientWidth||360,h:ref.current?.clientHeight||360});
    update();
    const ro=new ResizeObserver(update);
    ro.observe(ref.current);
    return()=>ro.disconnect();
  },[]);

  const tiles=useMemo(()=>{
    const halfX=Math.ceil(size.w/TILE/2)+1;
    const halfY=Math.ceil(size.h/TILE/2)+1;
    const cx=Math.floor(centerWorld.x/TILE), cy=Math.floor(centerWorld.y/TILE);
    const zN=Math.pow(2,zoom);
    const arr:any[]=[];
    for(let dy=-halfY;dy<=halfY;dy++){
      for(let dx=-halfX;dx<=halfX;dx++){
        const tx=cx+dx, ty=cy+dy;
        if(ty<0||ty>=zN) continue;
        const wrapped=((tx%zN)+zN)%zN;
        arr.push({
          key:`${zoom}-${tx}-${ty}`,
          src:`https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
          left:size.w/2+(tx*TILE-centerWorld.x),
          top:size.h/2+(ty*TILE-centerWorld.y),
        });
      }
    }
    return arr;
  },[centerWorld.x,centerWorld.y,size.w,size.h,zoom]);

  function pointFromEvent(clientX:number,clientY:number){
    if(!ref.current) return null;
    const r=ref.current.getBoundingClientRect();
    const px=clientX-r.left-r.width/2;
    const py=clientY-r.top-r.height/2;
    return latLngFromWorld(centerWorld.x+px,centerWorld.y+py,zoom);
  }

  function moveFromPointer(e:React.PointerEvent){
    if(!interactive||!onPointChange) return;
    const next=pointFromEvent(e.clientX,e.clientY);
    if(next) onPointChange(next);
  }

  return (
    <div
      ref={ref}
      className={`relative h-full w-full touch-none overflow-hidden bg-slate-200 ${className}`}
      onPointerDown={(e)=>{
        if(!interactive) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        moveFromPointer(e);
      }}
      onPointerMove={(e)=>{
        if(!interactive || !(e.buttons&1)) return;
        moveFromPointer(e);
      }}
      aria-label="Interactive drop-off map"
    >
      {tiles.map(t=><img key={t.key} src={t.src} alt="" draggable={false} className="pointer-events-none absolute h-64 w-64 select-none" style={{left:t.left,top:t.top}} />)}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(15,23,42,.08))]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <MapPin className="h-12 w-12 fill-rose-600 text-white drop-shadow-xl" />
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <button type="button" onClick={(e)=>{e.stopPropagation();setZoom(z=>Math.min(19,z+1));}} className="grid h-11 w-11 place-items-center rounded-xl border bg-white/95 shadow-lg"><Plus className="h-5 w-5"/></button>
        <button type="button" onClick={(e)=>{e.stopPropagation();setZoom(z=>Math.max(12,z-1));}} className="grid h-11 w-11 place-items-center rounded-xl border bg-white/95 shadow-lg"><Minus className="h-5 w-5"/></button>
      </div>
      {interactive && <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-slate-950/80 px-3 py-2 text-[11px] font-black text-white">Tap or drag to set pin</div>}
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-white/85 px-2 py-1 text-[9px] font-bold text-slate-600 shadow">© OpenStreetMap contributors</div>
    </div>
  );
}
