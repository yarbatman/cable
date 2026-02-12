"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const PLATFORMS = {
  x: { name: "X", charLimit: 280, premiumLimit: 25000, linkChars: 23, cropRatio: 16/9, cropLabel: "16:9", cropW: 1200, cropH: 675 },
  linkedin: { name: "LinkedIn", charLimit: 3000, linkChars: 0, cropRatio: 1.91, cropLabel: "1.91:1", cropW: 1200, cropH: 627 },
  instagram: { name: "Instagram", charLimit: 2200, linkChars: 0, cropRatio: 1, cropLabel: "1:1", cropW: 1080, cropH: 1080 },
  bluesky: { name: "Bluesky", charLimit: 300, linkChars: 0, cropRatio: 16/9, cropLabel: "16:9", cropW: 1200, cropH: 675 },
  substack: { name: "Substack", charLimit: null, linkChars: 0, cropRatio: null, cropLabel: "Original", cropW: null, cropH: null },
};
const F = { logo: "'Josefin Sans', sans-serif", ui: "-apple-system, system-ui, sans-serif", mono: "'IBM Plex Mono', monospace", body: "-apple-system, system-ui, sans-serif" };
const C = { bg: "#fafaf9", card: "#ffffff", text: "#1d1d1f", sub: "#999", border: "#e8e8e6", borderLight: "#f0f0ee", muted: "#f7f7f6", accent: "#c97b3a", accentDark: "#b8692e", danger: "#e34545", success: "#34c759", warn: "#d4a030", mention: "#2563eb", mentionBg: "#eff6ff" };

function extractUrl(t){const m=t.match(/(https?:\/\/[^\s]+)/g);return m?m[0]:null}
function extractMentionNames(t){const r=[],re=/\*\*([^*]+)\*\*/g;let m;while((m=re.exec(t))!==null)r.push(m[1].trim());return[...new Set(r)]}
function getCharInfo(text,key,xP){const p=PLATFORMS[key],limit=key==="x"&&xP?p.premiumLimit:p.charLimit;if(!limit)return{count:text.length,limit:null};let t=text;if(p.linkChars>0)t=text.replace(/(https?:\/\/[^\s]+)/g,"x".repeat(p.linkChars));return{count:t.length,limit}}

function cropImageAtOffset(base64,mimeType,targetW,targetH,offsetY=0.5,offsetX=0.5,zoom=1){
  return new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      const ratio=targetW/targetH;
      const srcCropW=img.width/zoom,srcCropH=srcCropW/ratio;
      const maxPanX=Math.max(0,img.width-srcCropW),maxPanY=Math.max(0,img.height-srcCropH);
      const srcX=offsetX*maxPanX,srcY=offsetY*maxPanY;
      const outW=Math.min(targetW,Math.round(srcCropW)),outH=Math.round(outW/ratio);
      const canvas=document.createElement("canvas");canvas.width=targetW;canvas.height=targetH;
      const ctx=canvas.getContext("2d");ctx.drawImage(img,srcX,srcY,srcCropW,srcCropH,0,0,targetW,targetH);
      const outMime=mimeType==="image/png"?"image/png":"image/jpeg";
      const dataUrl=canvas.toDataURL(outMime,outMime==="image/jpeg"?0.9:undefined);
      resolve({base64:dataUrl.split(",")[1],mimeType:outMime,previewUrl:dataUrl});
    };
    img.src=base64.startsWith("data:")?base64:("data:"+mimeType+";base64,"+base64);
  });
}

/* ═══ CROP EDITOR ═══ */
function CropEditor({imageDataUrl,ratio,platformName,cropLabel,cropW,cropH,onSave,onClose,initialOffsetY,initialOffsetX,initialZoom}){
  const frameRef=useRef(null);
  const[imgNatural,setImgNatural]=useState({w:0,h:0});
  const[frameW,setFrameW]=useState(0);
  const[imgX,setImgX]=useState(0);
  const[imgY,setImgY]=useState(0);
  const[zoom,setZoom]=useState(initialZoom||1);
  const[dragging,setDragging]=useState(false);
  const dragRef=useRef({startX:0,startY:0,startImgX:0,startImgY:0});
  const initialized=useRef(false);

  useEffect(()=>{const img=new Image();img.onload=()=>setImgNatural({w:img.width,h:img.height});img.src=imageDataUrl},[imageDataUrl]);
  useEffect(()=>{const m=()=>{if(frameRef.current)setFrameW(frameRef.current.offsetWidth)};m();window.addEventListener("resize",m);return()=>window.removeEventListener("resize",m)},[]);

  const baseScale=frameW>0&&imgNatural.w>0?frameW/imgNatural.w:1;
  const scaledW=imgNatural.w*baseScale*zoom;
  const scaledH=imgNatural.h*baseScale*zoom;
  const frameH=frameW/ratio;
  const minX=frameW-scaledW,maxX=0,minY=frameH-scaledH,maxY=0;
  const clampX=v=>Math.max(minX,Math.min(maxX,v));
  const clampY=v=>Math.max(minY,Math.min(maxY,v));

  useEffect(()=>{if(!initialized.current&&frameW>0&&imgNatural.w>0){
    const z=initialZoom||1;const sw=imgNatural.w*baseScale*z;const sh=imgNatural.h*baseScale*z;
    const fH=frameW/ratio;const travelX=sw-frameW;const travelY=sh-fH;
    setImgX(travelX>0?-(initialOffsetX||0.5)*travelX:0);
    setImgY(travelY>0?-(initialOffsetY||0.5)*travelY:0);
    initialized.current=true;
  }},[frameW,imgNatural,ratio,initialOffsetY,initialOffsetX,initialZoom,baseScale]);

  // Re-clamp when zoom changes
  useEffect(()=>{if(initialized.current){setImgX(v=>clampX(v));setImgY(v=>clampY(v))}},[zoom,frameW,imgNatural]);

  const onPointerDown=e=>{e.preventDefault();setDragging(true);dragRef.current={startX:e.clientX,startY:e.clientY,startImgX:imgX,startImgY:imgY};
    const onMove=ev=>{setImgX(clampX(dragRef.current.startImgX+(ev.clientX-dragRef.current.startX)));setImgY(clampY(dragRef.current.startImgY+(ev.clientY-dragRef.current.startY)))};
    const onUp=()=>{setDragging(false);window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp)};
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp)};

  const handleZoom=newZ=>{
    const oldZ=zoom;const cZ=Math.max(1,Math.min(4,newZ));
    // Keep crop centered when zooming
    const centerX=frameW/2,centerY=frameH/2;
    const imgCX=(centerX-imgX)/oldZ,imgCY=(centerY-imgY)/oldZ;
    setZoom(cZ);
    const newSW=imgNatural.w*baseScale*cZ,newSH=imgNatural.h*baseScale*cZ;
    const newMinX=frameW-newSW,newMinY=frameH-newSW/imgNatural.w*imgNatural.h;
    setImgX(Math.max(frameW-newSW,Math.min(0,centerX-imgCX*cZ)));
    setImgY(Math.max(frameH-newSH,Math.min(0,centerY-imgCY*cZ)));
  };

  const handleReset=()=>{setZoom(1);const bs=baseScale;const sw=imgNatural.w*bs;const sh=imgNatural.h*bs;
    setImgX(sw>frameW?-(sw-frameW)*0.5:0);setImgY(sh>frameH?-(sh-frameH)*0.5:0)};

  const handleSave=()=>{
    const travelX=Math.max(0,scaledW-frameW),travelY=Math.max(0,scaledH-frameH);
    const normX=travelX>0?Math.abs(imgX)/travelX:0.5;
    const normY=travelY>0?Math.abs(imgY)/travelY:0.5;
    onSave(normY,normX,zoom);
  };
  const ready=frameW>0&&imgNatural.w>0;
  const zoomPct=Math.round(zoom*100);

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(12px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#1a1a1a",borderRadius:24,width:"100%",maxWidth:560,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.5)"}}>
        <div style={{padding:"20px 24px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontFamily:F.ui,fontSize:16,fontWeight:700,color:"#fff"}}>Crop for {platformName}</div><div style={{fontFamily:F.mono,fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:4}}>{cropW} x {cropH}px &bull; {cropLabel} &bull; Drag to reposition</div></div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:10,fontSize:16,color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
        </div>
        <div style={{padding:"0 24px",display:"flex",gap:14,alignItems:"stretch"}}>
          {/* Crop frame */}
          <div style={{flex:1,position:"relative"}}>
            <div ref={frameRef} onPointerDown={onPointerDown} style={{width:"100%",height:ready?frameH:200,overflow:"hidden",borderRadius:12,position:"relative",cursor:dragging?"grabbing":"grab",touchAction:"none",userSelect:"none",border:"2px solid "+C.accent,boxShadow:"0 0 0 4px rgba(201,123,58,0.15)"}}>
              {ready&&<img src={imageDataUrl} alt="" draggable={false} style={{position:"absolute",left:imgX,top:imgY,width:scaledW,height:scaledH,objectFit:"cover",pointerEvents:"none",transition:dragging?"none":"left 0.08s ease-out, top 0.08s ease-out"}}/>}
              {ready&&<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}><line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/><line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/><line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/><line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/></svg>}
              <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:3,pointerEvents:"none"}}><div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.5)"}}/></div>
              <div style={{position:"absolute",top:10,right:12,background:"rgba(0,0,0,0.55)",color:"#fff",fontSize:10,fontFamily:F.mono,fontWeight:600,padding:"3px 8px",borderRadius:6,backdropFilter:"blur(6px)",pointerEvents:"none"}}>{cropLabel}</div>
              {zoom>1&&<div style={{position:"absolute",top:10,left:12,background:"rgba(0,0,0,0.55)",color:C.accent,fontSize:10,fontFamily:F.mono,fontWeight:600,padding:"3px 8px",borderRadius:6,backdropFilter:"blur(6px)",pointerEvents:"none"}}>{zoomPct}%</div>}
            </div>
          </div>
          {/* Zoom slider — vertical on the right */}
          {ready&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,width:36,paddingTop:4,paddingBottom:4}}>
            <button onClick={()=>handleZoom(zoom+0.25)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",width:30,height:30,borderRadius:8,color:"#fff",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0}}>+</button>
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",width:30}}>
              <input type="range" min="100" max="400" value={zoom*100} onChange={e=>handleZoom(Number(e.target.value)/100)}
                style={{writingMode:"vertical-lr",direction:"rtl",width:frameH?Math.min(frameH-20,180):120,height:30,appearance:"none",background:"transparent",cursor:"pointer",transform:"rotate(0deg)",WebkitAppearance:"none"}}/>
              <style>{`
                input[type=range]::-webkit-slider-runnable-track{width:4px;height:100%;background:rgba(255,255,255,0.12);border-radius:2px}
                input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:8px;background:${C.accent};cursor:pointer;margin-left:-6px;box-shadow:0 0 8px ${C.accent}80}
                input[type=range]::-moz-range-track{width:4px;height:100%;background:rgba(255,255,255,0.12);border-radius:2px}
                input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:8px;background:${C.accent};cursor:pointer;border:none}
              `}</style>
            </div>
            <button onClick={()=>handleZoom(zoom-0.25)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",width:30,height:30,borderRadius:8,color:"#fff",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0}}>&minus;</button>
            <div style={{fontFamily:F.mono,fontSize:9,color:"rgba(255,255,255,0.35)",textAlign:"center",marginTop:2}}>{zoomPct}%</div>
          </div>}
        </div>
        <div style={{padding:"12px 24px 0",textAlign:"center"}}><span style={{fontFamily:F.mono,fontSize:10,color:"rgba(255,255,255,0.3)"}}>Output: {cropW}x{cropH}px &bull; Source: {imgNatural.w}x{imgNatural.h}px &bull; Zoom: {zoomPct}%</span></div>
        <div style={{padding:"16px 24px 22px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={handleReset} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",padding:"9px 18px",borderRadius:10,fontFamily:F.ui,fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.5)",cursor:"pointer"}}>Reset</button>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",padding:"9px 18px",borderRadius:10,fontFamily:F.ui,fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.5)",cursor:"pointer"}}>Cancel</button>
            <button onClick={handleSave} style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentDark+")",border:"none",padding:"9px 24px",borderRadius:10,fontFamily:F.ui,fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 2px 12px "+C.accent+"60"}}>Apply crop</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ MENTION CHIP (thin — triggers global popup) ═══ */
function MentionChip({name,handle,candidates,platformKey,onShowPopup,platformName}){
  const ref=useRef(null);const hoverTimer=useRef(null);const leaveTimer=useRef(null);
  return(
    <span ref={ref} data-mchip="1"
      onMouseEnter={()=>{clearTimeout(leaveTimer.current);clearTimeout(hoverTimer.current);hoverTimer.current=setTimeout(()=>{if(!ref.current)return;const r=ref.current.getBoundingClientRect();onShowPopup({type:"hover",chipRect:r,name,platformKey,platformName:platformName||PLATFORMS[platformKey]?.name,candidates})},220)}}
      onMouseLeave={()=>{clearTimeout(hoverTimer.current);leaveTimer.current=setTimeout(()=>onShowPopup(prev=>(prev?.type==="hover"&&prev?.name===name&&prev?.platformKey===platformKey&&!prev?.locked)?null:prev),300)}}
      onClick={()=>{clearTimeout(hoverTimer.current);clearTimeout(leaveTimer.current);if(!ref.current)return;const r=ref.current.getBoundingClientRect();onShowPopup({type:"select",chipRect:r,name,platformKey,platformName:platformName||PLATFORMS[platformKey]?.name,candidates})}}
      style={{display:"inline-flex",alignItems:"center",gap:3,background:C.mentionBg,color:C.mention,padding:"2px 8px 3px",borderRadius:6,fontFamily:F.mono,fontSize:11.5,fontWeight:600,cursor:"pointer",transition:"all 0.15s",borderBottom:"2px solid "+C.mention+"40",whiteSpace:"nowrap",verticalAlign:"baseline"}}
      onMouseOver={e=>e.currentTarget.style.background="#dbeafe"}
      onMouseOut={e=>e.currentTarget.style.background=C.mentionBg}>
      {handle||name}<span style={{fontSize:8,opacity:0.4,marginLeft:1}}>&#9662;</span>
    </span>
  );
}

/* ═══ LINKEDIN URL MODAL ═══ */
function LinkedInUrlModal({name,onResolve,onClose}){
  const[url,setUrl]=useState("");const[resolving,setResolving]=useState(false);const[error,setError]=useState("");
  const handleResolve=async()=>{
    if(!url.includes("linkedin.com/")){setError("Please enter a valid LinkedIn URL");return}
    setResolving(true);setError("");
    try{
      const r=await fetch("/api/resolve-mention",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,linkedinUrl:url})});
      const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||"Could not resolve");onResolve(d.linkedin[0]);
    }catch(e){
      const slug=url.match(/\/in\/([^/?]+)/)?.[1]||url.match(/\/company\/([^/?]+)/)?.[1]||"unknown";
      onResolve({handle:slug,name:slug.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase()),bio:url.includes("/company/")?"Company page":"Resolved from URL",urn:url.includes("/company/")?"urn:li:organization:"+slug:"urn:li:person:"+slug,selected:true,fromUrl:true});
    }
    setResolving(false);
  };
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:20,width:"100%",maxWidth:440,padding:28,boxShadow:"0 24px 60px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div><div style={{fontFamily:F.ui,fontSize:16,fontWeight:700,color:C.text}}>Resolve LinkedIn tag</div><div style={{fontFamily:F.ui,fontSize:12,color:C.sub,marginTop:4}}>Paste the profile or company URL for <strong>{name}</strong></div></div>
          <button onClick={onClose} style={{background:C.muted,border:"none",width:30,height:30,borderRadius:8,fontSize:16,cursor:"pointer",color:C.sub}}>x</button>
        </div>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://linkedin.com/in/username or /company/name"
          style={{width:"100%",padding:"12px 14px",background:C.muted,border:"1px solid "+(error?C.danger:C.borderLight),borderRadius:10,fontFamily:F.mono,fontSize:12,color:C.text,outline:"none"}}
          onKeyDown={e=>e.key==="Enter"&&handleResolve()}/>
        {error&&<div style={{fontFamily:F.ui,fontSize:11,color:C.danger,marginTop:6}}>{error}</div>}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderTop:"1px solid "+C.borderLight,marginTop:14,marginBottom:14}}>
          <span style={{fontSize:13}}>&#128161;</span><span style={{fontFamily:F.ui,fontSize:11,color:C.sub}}>Works with personal profiles (/in/...) and company pages (/company/...)</span>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <button onClick={onClose} style={{padding:"9px 18px",background:"none",border:"1px solid "+C.border,borderRadius:10,fontFamily:F.ui,fontSize:12,fontWeight:500,color:C.sub,cursor:"pointer"}}>Cancel</button>
          <button onClick={handleResolve} disabled={resolving||!url.trim()} style={{padding:"9px 22px",background:url.trim()?"linear-gradient(135deg,"+C.accent+","+C.accentDark+")":C.muted,border:"none",borderRadius:10,fontFamily:F.ui,fontSize:12,fontWeight:600,color:url.trim()?"#fff":C.sub,cursor:url.trim()?"pointer":"default"}}>{resolving?"Resolving\u2026":"Resolve"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ MENTION TEXT RENDERER ═══ */
function MentionText({text,mentions,platformKey,onShowPopup}){
  if(!text)return<span style={{color:C.sub,fontStyle:"italic"}}>No content</span>;
  const resolved=mentions||{};const entries=Object.entries(resolved);
  if(entries.length===0)return<span>{text}</span>;
  const positions=[];
  for(const[name,platforms]of entries){const pd=platforms[platformKey];if(!pd||pd.length===0)continue;const sel=pd.find(c=>c.selected);if(!sel)continue;
    /* Strict word-boundary match: handle must appear as a standalone @mention, not as substring of another word */
    const escaped=sel.handle.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const re=new RegExp("(?<=\\s|^)"+escaped+"(?=\\s|[.,!?;:]|$)");const m=text.match(re);
    if(m&&m.index!=null)positions.push({name,handle:sel.handle,idx:m.index,platData:pd});
    else{const idx=text.indexOf(sel.handle);if(idx>=0)positions.push({name,handle:sel.handle,idx,platData:pd})}
  }
  positions.sort((a,b)=>a.idx-b.idx);if(positions.length===0)return<span>{text}</span>;
  /* Remove overlapping matches — keep first occurrence only */
  const clean=[];let end=0;for(const p of positions){if(p.idx>=end){clean.push(p);end=p.idx+p.handle.length}}
  const segs=[];let last=0;
  for(const p of clean){if(p.idx>last)segs.push({type:"text",value:text.slice(last,p.idx)});segs.push({type:"mention",...p});last=p.idx+p.handle.length}
  if(last<text.length)segs.push({type:"text",value:text.slice(last)});
  return<span>{segs.map((s,i)=>s.type==="text"?<span key={i}>{s.value}</span>:<MentionChip key={i} name={s.name} handle={s.handle} candidates={s.platData} platformKey={platformKey} onShowPopup={onShowPopup} platformName={PLATFORMS[platformKey]?.name}/>)}</span>;
}

/* Compose preview */
function ComposePreview({text}){
  const parts=text.split(/(\*\*[^*]+\*\*)/g);
  return<div style={{fontFamily:F.body,fontSize:12,lineHeight:1.6,color:C.sub,marginTop:8,padding:"8px 0"}}>{parts.map((part,i)=>{const m=part.match(/^\*\*(.+)\*\*$/);return m?<span key={i} style={{background:C.mentionBg,color:C.mention,padding:"1px 6px",borderRadius:4,fontWeight:600,fontFamily:F.mono,fontSize:11.5}}>@{m[1]}</span>:<span key={i}>{part}</span>})}</div>;
}

/* Mention status bar */
function MentionStatusBar({names,mentions,resolving}){
  if(names.length===0)return null;
  return<div style={{marginTop:12,padding:"10px 14px",background:C.mentionBg,borderRadius:10,border:"1px solid "+C.mention+"15"}}>
    <div style={{fontFamily:F.ui,fontSize:10,fontWeight:600,color:C.mention,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{resolving?"Resolving tags\u2026":"Tags detected"}</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
      {names.map((name,i)=>{const r=mentions[name],count=r?Object.keys(r).filter(k=>r[k]?.some(c=>c.selected)).length:0;return(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:"#fff",borderRadius:8,border:"1px solid "+C.mention+"20"}}>
          <div style={{width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,"+C.mention+",#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.ui,fontSize:9,fontWeight:700,color:"#fff"}}>{name.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
          <div><div style={{fontFamily:F.ui,fontSize:11.5,fontWeight:600,color:C.text}}>{name}</div><div style={{fontFamily:F.mono,fontSize:9.5,color:resolving?C.warn:count>0?C.success:C.sub}}>{resolving?"searching\u2026":count>0?count+"/"+Object.keys(PLATFORMS).length+" platforms":"no matches yet"}</div></div>
        </div>)})}
    </div></div>;
}

/* Social card */
function SocialCard({ogData,platformKey}){
  if(!ogData||(!ogData.title&&!ogData.image))return null;
  return<div style={{borderRadius:10,overflow:"hidden",border:"1px solid "+C.borderLight,background:"#fff"}}>
    {ogData.image&&<div style={{width:"100%",height:platformKey==="x"?125:110,overflow:"hidden",background:"#e8e8e6"}}><img src={ogData.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/></div>}
    <div style={{padding:"8px 12px"}}>{ogData.domain&&<div style={{fontFamily:F.mono,fontSize:10,color:C.sub,marginBottom:2}}>{ogData.domain}</div>}{ogData.title&&<div style={{fontFamily:F.ui,fontSize:12,fontWeight:600,color:C.text,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ogData.title}</div>}{ogData.description&&<div style={{fontFamily:F.ui,fontSize:11,color:C.sub,lineHeight:1.3,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ogData.description}</div>}</div>
  </div>;
}

/* Post Preview */
function PostPreview({content,platformKey,ogData,croppedPreview,showMode,hasImage,onClickImage,mentions,onShowPopup}){
  const url=extractUrl(content),textOnly=content.replace(/(https?:\/\/[^\s]+)/g,"").trim();
  const showImage=showMode==="photo"&&hasImage,showCard=showMode==="card"&&url&&ogData;
  return<div style={{padding:12,background:C.muted,borderRadius:10}}>
    <div style={{fontFamily:F.body,fontSize:12.5,lineHeight:1.6,color:C.text,whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:80,overflow:"hidden"}}><MentionText text={textOnly} mentions={mentions} platformKey={platformKey} onShowPopup={onShowPopup}/></div>
    {showImage&&croppedPreview&&<div onClick={onClickImage} style={{marginTop:10,borderRadius:8,overflow:"hidden",position:"relative",cursor:"pointer"}} onMouseEnter={e=>{const h=e.currentTarget.querySelector(".chint");if(h)h.style.opacity="1"}} onMouseLeave={e=>{const h=e.currentTarget.querySelector(".chint");if(h)h.style.opacity="0"}}>
      <img src={croppedPreview} alt="" style={{width:"100%",maxHeight:120,objectFit:"cover",display:"block"}}/>
      {PLATFORMS[platformKey].cropRatio&&<div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.6)",color:"#fff",fontSize:9,fontFamily:F.mono,fontWeight:600,padding:"2px 7px",borderRadius:4,backdropFilter:"blur(4px)"}}>{PLATFORMS[platformKey].cropLabel}</div>}
      <div className="chint" style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",opacity:0,transition:"opacity 0.2s"}}><div style={{background:"rgba(255,255,255,0.95)",borderRadius:8,padding:"6px 14px",fontFamily:F.ui,fontSize:11,fontWeight:600,color:C.text}}>&#9986; Adjust crop</div></div>
    </div>}
    {showCard&&<div style={{marginTop:10}}><SocialCard ogData={ogData} platformKey={platformKey}/></div>}
    {showImage&&url&&<div style={{marginTop:8,display:"flex",alignItems:"center",gap:6,padding:"4px 8px",background:"#fff",borderRadius:6}}><span style={{fontSize:10}}>&#128279;</span><span style={{fontFamily:F.mono,fontSize:10,color:C.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span></div>}
  </div>;
}

/* Settings */
function SettingsPanel({status,onClose,onRefreshStatus,xPremium,setXPremium}){
  const[bsH,setBsH]=useState("");const[bsP,setBsP]=useState("");const[bsL,setBsL]=useState(false);const[bsE,setBsE]=useState("");
  const connectBs=async()=>{setBsL(true);setBsE("");try{const r=await fetch("/api/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:"bluesky",handle:bsH,appPassword:bsP})});const d=await r.json();if(!r.ok)throw new Error(d.error);onRefreshStatus();setBsH("");setBsP("")}catch(e){setBsE(e.message)}setBsL(false)};
  const disc=async p=>{await fetch("/api/status",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:p})});onRefreshStatus()};
  const Row=({name,connected,detail,authUrl,onDisconnect,extra})=><div style={{padding:"14px 0",borderBottom:"1px solid "+C.borderLight}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:8,height:8,borderRadius:"50%",background:connected?C.success:C.border}}/><span style={{fontFamily:F.ui,fontSize:13,fontWeight:600}}>{name}</span>{detail&&<span style={{fontFamily:F.mono,fontSize:11,color:C.sub}}>{detail}</span>}</div>{connected?<button onClick={onDisconnect} style={{background:"none",border:"1px solid "+C.danger,padding:"4px 14px",borderRadius:8,fontFamily:F.ui,fontSize:11,color:C.danger,cursor:"pointer",fontWeight:500}}>Disconnect</button>:authUrl?<a href={authUrl} style={{border:"1px solid "+C.accent,padding:"4px 14px",borderRadius:8,fontFamily:F.ui,fontSize:11,color:C.accent,textDecoration:"none",fontWeight:500}}>Connect</a>:null}</div>{extra}</div>;
  return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.2)",backdropFilter:"blur(4px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}><div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:20,width:"90%",maxWidth:420,padding:"28px 28px 20px",position:"relative",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
    <button onClick={onClose} style={{position:"absolute",top:16,right:20,background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.sub}}>x</button>
    <div style={{fontFamily:F.ui,fontSize:15,fontWeight:700,marginBottom:20}}>Connections</div>
    <Row name="X" connected={status.x?.connected} detail={status.x?.connected?("@"+status.x.screenName):null} authUrl="/api/auth/x" onDisconnect={()=>disc("x")} extra={status.x?.connected&&<div style={{marginTop:10,paddingLeft:18,display:"flex",alignItems:"center",gap:8}}><button onClick={()=>setXPremium(!xPremium)} style={{width:36,height:20,borderRadius:10,background:xPremium?C.accent:C.border,border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s"}}><div style={{width:16,height:16,borderRadius:8,background:"#fff",position:"absolute",top:2,left:xPremium?18:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/></button><span style={{fontFamily:F.ui,fontSize:11,color:xPremium?C.accent:C.sub,fontWeight:500}}>X Premium (25K chars)</span></div>}/>
    <Row name="LinkedIn" connected={status.linkedin?.connected} detail={status.linkedin?.connected?status.linkedin.name:null} authUrl="/api/auth/linkedin" onDisconnect={()=>disc("linkedin")}/>
    <Row name="Instagram" connected={status.instagram?.connected} detail={status.instagram?.connected?("@"+status.instagram.username):null} authUrl="/api/auth/instagram" onDisconnect={()=>disc("instagram")}/>
    <div style={{padding:"14px 0",borderBottom:"1px solid "+C.borderLight}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:8,height:8,borderRadius:"50%",background:status.bluesky?.connected?C.success:C.border}}/><span style={{fontFamily:F.ui,fontSize:13,fontWeight:600}}>Bluesky</span>{status.bluesky?.connected&&<span style={{fontFamily:F.mono,fontSize:11,color:C.sub}}>{status.bluesky.handle}</span>}</div>{status.bluesky?.connected&&<button onClick={()=>disc("bluesky")} style={{background:"none",border:"1px solid "+C.danger,padding:"4px 14px",borderRadius:8,fontFamily:F.ui,fontSize:11,color:C.danger,cursor:"pointer",fontWeight:500}}>Disconnect</button>}</div>
      {!status.bluesky?.connected&&<div style={{marginTop:12,paddingLeft:18}}><input style={{width:"100%",background:C.muted,border:"none",padding:"8px 12px",borderRadius:8,fontFamily:F.mono,fontSize:12,color:C.text,marginBottom:6}} placeholder="yourname.bsky.social" value={bsH} onChange={e=>setBsH(e.target.value)}/><input style={{width:"100%",background:C.muted,border:"none",padding:"8px 12px",borderRadius:8,fontFamily:F.mono,fontSize:12,color:C.text,marginBottom:6}} type="password" placeholder="App password" value={bsP} onChange={e=>setBsP(e.target.value)}/>{bsE&&<div style={{color:C.danger,fontFamily:F.ui,fontSize:11,marginBottom:6}}>{bsE}</div>}<button onClick={connectBs} disabled={bsL} style={{background:"none",border:"1px solid "+C.accent,padding:"5px 16px",borderRadius:8,fontFamily:F.ui,fontSize:11,color:C.accent,cursor:"pointer",fontWeight:500}}>{bsL?"Verifying\u2026":"Connect"}</button></div>}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:8,height:8,borderRadius:"50%",background:C.success}}/><span style={{fontFamily:F.ui,fontSize:13,fontWeight:600}}>Substack</span></div><span style={{fontFamily:F.ui,fontSize:11,color:C.sub,fontStyle:"italic"}}>Auto-populate</span></div>
  </div></div>;
}

/* Platform Card */
function PlatformCard({platformKey,content,onContentChange,enabled,onToggle,edited,onReset,connected,hasImage,index,xPremium,ogData,croppedPreview,showMode,onToggleMode,onOpenCrop,mentions,onShowPopup}){
  const p=PLATFORMS[platformKey],{count,limit}=getCharInfo(content,platformKey,xPremium),over=limit&&count>limit,pct=limit?Math.min(count/limit,1):0,off=!connected&&platformKey!=="substack",url=extractUrl(content);
  const mentionCount=mentions?Object.values(mentions).filter(m=>m[platformKey]?.some(c=>c.selected)).length:0;
  return<div style={{background:C.card,borderRadius:16,overflow:"hidden",animation:"cardIn 0.5s ease "+index*0.06+"s both",display:"flex",flexDirection:"column",boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",opacity:enabled&&!off?1:0.4,transition:"opacity 0.3s"}}>
    <div style={{padding:"14px 18px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+C.borderLight}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <div style={{width:28,height:28,borderRadius:8,background:edited&&enabled&&!off?C.accent:C.border,display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.4s"}}><span style={{fontFamily:F.ui,fontSize:11,fontWeight:600,color:edited&&enabled&&!off?"#fff":C.sub}}>{p.name.charAt(0)}</span></div>
        <span style={{fontFamily:F.ui,fontSize:13,fontWeight:600,color:C.text}}>{p.name}</span>
        {platformKey==="x"&&xPremium&&<span style={{fontFamily:F.ui,fontSize:9,color:C.accent,fontWeight:600,background:C.accent+"14",padding:"1px 6px",borderRadius:6}}>PREMIUM</span>}
        {off&&<span style={{fontFamily:F.ui,fontSize:10,color:C.danger,fontStyle:"italic"}}>Not connected</span>}
        {edited&&enabled&&!off&&<span style={{fontFamily:F.ui,fontSize:10,color:C.accent,fontWeight:500,background:C.accent+"14",padding:"2px 8px",borderRadius:10}}>Optimized</span>}
        {mentionCount>0&&<span style={{fontFamily:F.ui,fontSize:10,color:C.mention,fontWeight:500,background:C.mentionBg,padding:"2px 8px",borderRadius:10}}>{mentionCount} tag{mentionCount>1?"s":""}</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        {edited&&enabled&&!off&&<button onClick={onReset} style={{background:"none",border:"none",cursor:"pointer",fontFamily:F.ui,fontSize:11,color:C.sub,fontWeight:500}}>Reset</button>}
        {!off&&<button onClick={onToggle} style={{width:20,height:20,borderRadius:6,border:"1.5px solid "+(enabled?C.accent:C.border),background:enabled?C.accent+"14":"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:10,color:C.accent,fontFamily:F.mono}}>{enabled?"\u2713":""}</button>}
      </div>
    </div>
    {enabled&&!off&&<div style={{padding:"14px 18px 16px",flex:1,display:"flex",flexDirection:"column",gap:10}}>
      <textarea value={content} onChange={e=>onContentChange(e.target.value)} placeholder={"Customize for "+p.name+"\u2026"} rows={3} style={{width:"100%",background:"transparent",border:"none",color:C.text,fontSize:13,lineHeight:1.6,fontFamily:F.body,resize:"vertical",padding:0,minHeight:60}}/>
      {(hasImage||(url&&ogData))&&<div style={{display:"flex",gap:4,padding:3,background:C.muted,borderRadius:8,width:"fit-content"}}>
        {hasImage&&<button onClick={()=>onToggleMode("photo")} style={{padding:"4px 12px",borderRadius:6,border:"none",fontFamily:F.ui,fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.2s",background:showMode==="photo"?C.accent:"transparent",color:showMode==="photo"?"#fff":C.sub}}>&#128247; Photo</button>}
        {url&&ogData&&<button onClick={()=>onToggleMode("card")} style={{padding:"4px 12px",borderRadius:6,border:"none",fontFamily:F.ui,fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.2s",background:showMode==="card"?C.accent:"transparent",color:showMode==="card"?"#fff":C.sub}}>&#128279; Card</button>}
        <button onClick={()=>onToggleMode("none")} style={{padding:"4px 12px",borderRadius:6,border:"none",fontFamily:F.ui,fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.2s",background:showMode==="none"?C.accent:"transparent",color:showMode==="none"?"#fff":C.sub}}>Text only</button>
      </div>}
      <PostPreview content={content} platformKey={platformKey} ogData={ogData} croppedPreview={croppedPreview} showMode={showMode} hasImage={hasImage} onClickImage={()=>p.cropRatio&&onOpenCrop(platformKey)} mentions={mentions} onShowPopup={onShowPopup}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {limit&&<div style={{position:"relative",width:22,height:22}}><svg width="22" height="22" style={{transform:"rotate(-90deg)"}}><circle cx="11" cy="11" r="9" fill="none" stroke={C.borderLight} strokeWidth="2"/><circle cx="11" cy="11" r="9" fill="none" stroke={over?C.danger:pct>0.85?C.warn:C.accent} strokeWidth="2" strokeDasharray={pct*56.5+" 56.5"} strokeLinecap="round" style={{transition:"stroke-dasharray 0.3s, stroke 0.3s"}}/></svg>{over&&<span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:C.danger,fontFamily:F.mono}}>!</span>}</div>}
          <span style={{fontFamily:F.mono,fontSize:10,color:over?C.danger:"#bbb",fontWeight:500,fontVariantNumeric:"tabular-nums"}}>{limit?count+"/"+limit:""+count}</span>
        </div>
      </div>
      {over&&<div style={{fontFamily:F.mono,fontSize:10,color:C.danger}}>{"\u25B2 "+(count-limit)+" over limit"}</div>}
    </div>}
  </div>;
}

/* Toast */
function Toast({message,type,onDone}){useEffect(()=>{const t=setTimeout(onDone,4000);return()=>clearTimeout(t)},[onDone]);return<div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",background:C.text,color:"#fff",padding:"10px 24px",borderRadius:12,fontFamily:F.ui,fontSize:13,fontWeight:500,zIndex:1000,animation:"toastIn 0.3s ease",boxShadow:"0 8px 30px rgba(0,0,0,0.15)",display:"flex",alignItems:"center",gap:8,maxWidth:"90%"}}><span style={{color:type==="success"?C.success:C.danger}}>{type==="success"?"\u2713":"\u2717"}</span> {message}</div>}

/* ═══ MAIN ═══ */
export default function Kabel(){
  const[master,setMaster]=useState("");
  const[contents,setContents]=useState({x:"",linkedin:"",instagram:"",bluesky:"",substack:""});
  const[edited,setEdited]=useState({x:false,linkedin:false,instagram:false,bluesky:false,substack:false});
  const[enabled,setEnabled]=useState({x:true,linkedin:true,instagram:true,bluesky:true,substack:true});
  const[showModes,setShowModes]=useState({x:"photo",linkedin:"photo",instagram:"photo",bluesky:"photo",substack:"card"});
  const[toast,setToast]=useState(null);const[sending,setSending]=useState(false);
  const[cardData,setCardData]=useState(null);const[cardLoading,setCardLoading]=useState(false);
  const[status,setStatus]=useState({});const[settingsOpen,setSettingsOpen]=useState(false);
  const[results,setResults]=useState([]);
  const[imageFile,setImageFile]=useState(null);const[imagePreview,setImagePreview]=useState(null);
  const[imageBase64,setImageBase64]=useState(null);const[imageMimeType,setImageMimeType]=useState(null);
  const[optimizing,setOptimizing]=useState(false);const[xPremium,setXPremium]=useState(false);
  const[croppedImages,setCroppedImages]=useState({});const[croppedPreviews,setCroppedPreviews]=useState({});
  const[cropOffsets,setCropOffsets]=useState({x:{y:0.5,x:0.5,z:1},linkedin:{y:0.5,x:0.5,z:1},instagram:{y:0.5,x:0.5,z:1},bluesky:{y:0.5,x:0.5,z:1},substack:{y:0.5,x:0.5,z:1}});
  const[cropEditorKey,setCropEditorKey]=useState(null);
  const[mentions,setMentions]=useState({});const[mentionNames,setMentionNames]=useState([]);
  const[mentionResolving,setMentionResolving]=useState(false);const[linkedInUrlModal,setLinkedInUrlModal]=useState(null);
  const[mentionPopup,setMentionPopup]=useState(null);
  const fileRef=useRef(null);const mentionDebounce=useRef(null);

  const url=extractUrl(master),hasContent=master.trim().length>0;
  const activeCount=Object.keys(PLATFORMS).filter(k=>enabled[k]&&(status[k]?.connected||k==="substack")).length;
  const refreshStatus=useCallback(async()=>{try{const r=await fetch("/api/status");setStatus(await r.json())}catch{}},[]);

  /* Close mention popup on outside click */
  useEffect(()=>{if(!mentionPopup)return;const h=e=>{if(!e.target.closest("[data-mpopup]")&&!e.target.closest("[data-mchip]"))setMentionPopup(null)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[mentionPopup]);

  useEffect(()=>{refreshStatus();const p=new URLSearchParams(window.location.search);if(p.get("connected")){setToast({message:"Connected to "+p.get("connected").toUpperCase(),type:"success"});window.history.replaceState({},"","/");refreshStatus()}if(p.get("error")){setToast({message:"Error: "+p.get("error"),type:"error"});window.history.replaceState({},"","/")}},[refreshStatus]);

  useEffect(()=>{if(url){setCardLoading(true);const c=new AbortController();fetch("/api/opengraph",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url}),signal:c.signal}).then(r=>r.json()).then(setCardData).catch(()=>{}).finally(()=>setCardLoading(false));return()=>c.abort()}else setCardData(null)},[url]);

  useEffect(()=>{setContents(prev=>{const n={...prev};Object.keys(PLATFORMS).forEach(k=>{if(!edited[k])n[k]=master});return n})},[master,edited]);

  useEffect(()=>{
    const names=extractMentionNames(master);setMentionNames(names);
    const newNames=names.filter(n=>!mentions[n]);
    if(newNames.length>0){
      if(mentionDebounce.current)clearTimeout(mentionDebounce.current);
      mentionDebounce.current=setTimeout(async()=>{
        setMentionResolving(true);const results={};
        await Promise.all(newNames.map(async name=>{try{const r=await fetch("/api/resolve-mention",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});const d=await r.json();if(d.success&&d.candidates)results[name]=d.candidates}catch{}}));
        setMentions(prev=>({...prev,...results}));setMentionResolving(false);
      },800);
    }
    setMentions(prev=>{const n={};names.forEach(name=>{if(prev[name])n[name]=prev[name]});return n});
  },[master]);

  const regenerateCrops=useCallback(async(base64,mime,offsets)=>{
    if(!base64||!mime){setCroppedImages({});setCroppedPreviews({});return}
    const ci={},cp={};
    for(const[k,p]of Object.entries(PLATFORMS)){if(p.cropRatio&&p.cropW&&p.cropH){const o=offsets[k]||{y:0.5,x:0.5,z:1};const result=await cropImageAtOffset(base64,mime,p.cropW,p.cropH,o.y,o.x,o.z);ci[k]={base64:result.base64,mimeType:result.mimeType};cp[k]=result.previewUrl}}
    setCroppedImages(ci);setCroppedPreviews(cp);
  },[]);

  useEffect(()=>{regenerateCrops(imageBase64,imageMimeType,cropOffsets)},[imageBase64,imageMimeType]);

  const handleImageSelect=e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith("image/")){setToast({message:"Please select an image",type:"error"});return}if(f.size>5*1024*1024){setToast({message:"Image must be under 5MB",type:"error"});return}setImageFile(f);setImageMimeType(f.type);const pr=new FileReader();pr.onload=ev=>setImagePreview(ev.target.result);pr.readAsDataURL(f);const br=new FileReader();br.onload=ev=>setImageBase64(ev.target.result.split(",")[1]);br.readAsDataURL(f);setCropOffsets({x:{y:0.5,x:0.5,z:1},linkedin:{y:0.5,x:0.5,z:1},instagram:{y:0.5,x:0.5,z:1},bluesky:{y:0.5,x:0.5,z:1},substack:{y:0.5,x:0.5,z:1}});setShowModes({x:"photo",linkedin:"photo",instagram:"photo",bluesky:"photo",substack:"photo"})};
  const removeImage=()=>{setImageFile(null);setImagePreview(null);setImageBase64(null);setImageMimeType(null);setCroppedImages({});setCroppedPreviews({});setCropOffsets({x:{y:0.5,x:0.5,z:1},linkedin:{y:0.5,x:0.5,z:1},instagram:{y:0.5,x:0.5,z:1},bluesky:{y:0.5,x:0.5,z:1},substack:{y:0.5,x:0.5,z:1}});if(fileRef.current)fileRef.current.value=""};

  const handleCropSave=async(platformKey,normalizedY,normalizedX,zoom)=>{
    const newOffsets={...cropOffsets,[platformKey]:{y:normalizedY,x:normalizedX||0.5,z:zoom||1}};setCropOffsets(newOffsets);setCropEditorKey(null);
    if(imageBase64&&imageMimeType){const p=PLATFORMS[platformKey];if(p.cropRatio&&p.cropW&&p.cropH){const result=await cropImageAtOffset(imageBase64,imageMimeType,p.cropW,p.cropH,normalizedY,normalizedX||0.5,zoom||1);setCroppedImages(prev=>({...prev,[platformKey]:{base64:result.base64,mimeType:result.mimeType}}));setCroppedPreviews(prev=>({...prev,[platformKey]:result.previewUrl}))}}
    setToast({message:PLATFORMS[platformKey].name+" crop updated",type:"success"});
  };

  const getMentionHandles=()=>{const handles={};for(const[name,platforms]of Object.entries(mentions)){handles[name]={};for(const[pk,candidates]of Object.entries(platforms)){const sel=candidates.find(c=>c.selected);if(sel)handles[name][pk]=sel.handle}}return handles};
  const handleSelectCandidate=(name,platformKey,candidate)=>{setMentions(prev=>{const u={...prev};if(u[name]&&u[name][platformKey]){u[name]={...u[name]};u[name][platformKey]=u[name][platformKey].map(c=>({...c,selected:c.handle===candidate.handle}))}return u});const oldSel=mentions[name]?.[platformKey]?.find(c=>c.selected);if(oldSel)setContents(prev=>({...prev,[platformKey]:prev[platformKey].replace(oldSel.handle,candidate.handle)}));setMentionPopup(null);setToast({message:name+" \u2192 "+candidate.handle+" on "+PLATFORMS[platformKey].name,type:"success"})};
  const handleLinkedInUrlResolve=resolved=>{const name=linkedInUrlModal;setMentions(prev=>{const u={...prev};if(!u[name])u[name]={};u[name]={...u[name],linkedin:[resolved,...(u[name]?.linkedin||[]).map(c=>({...c,selected:false}))]};return u});setLinkedInUrlModal(null);setToast({message:"LinkedIn tag resolved for "+name,type:"success"})};

  const optimizeAll=async()=>{if(!master.trim())return;const ap=Object.keys(PLATFORMS).filter(k=>enabled[k]&&(status[k]?.connected||k==="substack"));if(!ap.length){setToast({message:"No active platforms",type:"error"});return}setOptimizing(true);try{const mentionHandles=getMentionHandles();const body={text:master,platforms:ap};if(Object.keys(mentionHandles).length>0)body.mentions=mentionHandles;const r=await fetch("/api/optimize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Optimization failed");const nc={...contents},ne={...edited};for(const[k,v]of Object.entries(d.optimized)){if(PLATFORMS[k]&&enabled[k]){nc[k]=v;ne[k]=true}}setContents(nc);setEdited(ne);setToast({message:"Optimized for all platforms",type:"success"})}catch(err){setToast({message:err.message,type:"error"})}setOptimizing(false)};

  const handlePlatformChange=(k,v)=>{setContents(p=>({...p,[k]:v}));setEdited(p=>({...p,[k]:true}))};
  const resetPlatform=k=>{setContents(p=>({...p,[k]:master}));setEdited(p=>({...p,[k]:false}))};
  const clearAll=()=>{setMaster("");setContents({x:"",linkedin:"",instagram:"",bluesky:"",substack:""});setEdited({x:false,linkedin:false,instagram:false,bluesky:false,substack:false});setCardData(null);setResults([]);removeImage();setMentions({});setMentionNames([])};

  const broadcast=async()=>{
    const active=Object.keys(PLATFORMS).filter(k=>enabled[k]&&(status[k]?.connected||k==="substack"));
    if(!active.length){setToast({message:"No connected platforms selected",type:"error"});return}
    if(!master.trim()){setToast({message:"Write something first",type:"error"});return}
    setSending(true);const br=[];
    await Promise.all(active.map(async platform=>{
      if(platform==="substack"){try{const text=encodeURIComponent(contents.substack);window.open("https://substack.com/notes?action=compose&body="+text,"_blank");br.push({platform:"substack",success:true})}catch{br.push({platform:"substack",success:false,error:"Failed to open Substack"})}return}
      try{const body={text:contents[platform]};const includeImage=showModes[platform]==="photo"&&imageBase64;if(url&&platform==="linkedin"&&!includeImage)body.articleUrl=url;if(includeImage){if(croppedImages[platform]){body.imageBase64=croppedImages[platform].base64;body.imageMimeType=croppedImages[platform].mimeType}else{body.imageBase64=imageBase64;body.imageMimeType=imageMimeType}}const r=await fetch("/api/post/"+platform,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();br.push(d.success?{platform,success:true,postUrl:d.postUrl}:{platform,success:false,error:d.error||"Unknown error"})}catch(err){br.push({platform,success:false,error:err.message})}
    }));
    setSending(false);setResults(br);const s=br.filter(r=>r.success),f=br.filter(r=>!r.success);
    if(s.length)setToast({message:"Sent to "+s.map(r=>PLATFORMS[r.platform].name).join(", ")+(f.length?" ("+f.length+" failed)":""),type:f.length?"error":"success"});
    else setToast({message:"All platforms failed",type:"error"});
    if(!f.length)setTimeout(clearAll,2000);
  };

  return<div style={{minHeight:"100vh",background:C.bg,color:C.text}}>
    <header style={{background:C.card,borderBottom:"1px solid "+C.border,position:"sticky",top:0,zIndex:50}}>
      <div style={{maxWidth:1080,margin:"0 auto",padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,"+C.accent+" 0%,"+C.accentDark+" 100%)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px "+C.accent+"40"}}><svg width="28" height="28" viewBox="0 0 32 32" fill="none"><line x1="6" y1="20" x2="26" y2="20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="14" x2="25" y2="12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="14" r="3" stroke="#fff" strokeWidth="1.5"/><line x1="25" y1="12" x2="25" y2="20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
          <div><div style={{fontFamily:F.logo,fontSize:22,fontWeight:600,letterSpacing:"0.14em",color:C.text,lineHeight:1,textTransform:"uppercase"}}>Kabel</div><div style={{fontFamily:F.ui,fontSize:10,fontWeight:500,color:C.sub,marginTop:2}}>Broadcast everywhere</div><div style={{fontFamily:F.mono,fontSize:8,color:"#ccc",marginTop:1}}>v6.3</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6,background:C.muted,padding:"6px 14px",borderRadius:20}}><div style={{width:6,height:6,borderRadius:"50%",background:activeCount>0?C.success:C.danger}}/><span style={{fontFamily:F.ui,fontSize:11,fontWeight:500,color:"#666"}}>{activeCount} channels</span></div>
          <button onClick={()=>setSettingsOpen(true)} style={{background:C.muted,border:"none",padding:"7px 16px",borderRadius:20,fontFamily:F.ui,fontSize:11,fontWeight:600,color:"#666",cursor:"pointer"}}>Settings</button>
        </div>
      </div>
    </header>

    <main style={{maxWidth:1080,margin:"0 auto",padding:"0 28px 140px"}}>
      <div style={{paddingTop:60,maxWidth:620,margin:"0 auto"}}>
        <div style={{background:C.card,borderRadius:20,padding:"28px 28px 20px",boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)"}}>
          <textarea value={master} onChange={e=>setMaster(e.target.value)} placeholder="What would you like to broadcast? Use **Name** to tag people."
            style={{width:"100%",minHeight:130,background:"transparent",border:"none",color:C.text,fontSize:16,lineHeight:1.75,fontFamily:F.body,resize:"none",padding:0,fontWeight:400}}/>
          {mentionNames.length>0&&<ComposePreview text={master}/>}
          {mentionNames.length>0&&<MentionStatusBar names={mentionNames} mentions={mentions} resolving={mentionResolving}/>}
          {imagePreview&&<div style={{marginTop:12,position:"relative",display:"inline-block",borderRadius:12,overflow:"hidden"}}><img src={imagePreview} alt="Upload" style={{maxHeight:140,maxWidth:"100%",display:"block",objectFit:"cover"}}/><button onClick={removeImage} style={{position:"absolute",top:8,right:8,width:24,height:24,borderRadius:12,background:"rgba(0,0,0,0.5)",color:"#fff",border:"none",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>x</button></div>}
          {url&&<div style={{marginTop:14,padding:"10px 14px",background:C.muted,borderRadius:10,display:"flex",alignItems:"center",gap:8}}><div style={{width:20,height:20,borderRadius:6,background:C.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:10}}>&#128279;</span></div><span style={{fontFamily:F.mono,fontSize:11,color:"#888",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span>{cardLoading&&<span style={{animation:"pulse 1s ease infinite",color:C.sub}}>&hellip;</span>}{cardData&&<span style={{color:C.success,fontSize:12,flexShrink:0}}>{"\u2713"}</span>}</div>}
          {hasContent&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+C.borderLight,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontFamily:F.mono,fontSize:11,color:"#ccc",fontWeight:500,fontVariantNumeric:"tabular-nums"}}>{master.length} chars</span><div style={{display:"flex",gap:6}}><input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{display:"none"}}/><button onClick={()=>fileRef.current?.click()} style={{background:imageFile?C.accent+"14":C.muted,border:"none",padding:"6px 14px",borderRadius:8,fontFamily:F.ui,fontSize:12,fontWeight:500,color:imageFile?C.accent:C.sub,cursor:"pointer",transition:"all 0.2s"}}>&#128247; {imageFile?"Change":"Photo"}</button><button onClick={clearAll} style={{background:C.muted,border:"none",padding:"6px 14px",borderRadius:8,fontFamily:F.ui,fontSize:12,fontWeight:500,color:C.sub,cursor:"pointer"}}>Clear</button></div></div>}
        </div>
        {hasContent&&<div style={{marginTop:18,display:"flex",justifyContent:"center",animation:"fadeIn 0.4s ease"}}><button onClick={optimizeAll} disabled={optimizing} style={{background:optimizing?C.muted:"linear-gradient(135deg,"+C.accent+" 0%,"+C.accentDark+" 100%)",border:"none",padding:"10px 28px",borderRadius:12,fontFamily:F.ui,fontSize:13,fontWeight:600,color:optimizing?C.sub:"#ffffff",cursor:optimizing?"default":"pointer",boxShadow:optimizing?"none":"0 2px 12px "+C.accent+"4d",transition:"all 0.3s",animation:optimizing?"pulse 1.2s ease infinite":"none"}}>{optimizing?"Optimizing\u2026":"\u2726  Optimize for All Platforms"}</button></div>}
      </div>

      {hasContent&&<div style={{marginTop:36,animation:"fadeIn 0.4s ease"}}>
        <div style={{textAlign:"center",marginBottom:20}}><span style={{fontFamily:F.ui,fontSize:11,fontWeight:600,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.12em"}}>Per-channel preview</span></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",gap:14}}>
          {Object.keys(PLATFORMS).map((k,i)=><PlatformCard key={k} platformKey={k} content={contents[k]} onContentChange={v=>handlePlatformChange(k,v)} enabled={enabled[k]} onToggle={()=>setEnabled(p=>({...p,[k]:!p[k]}))} edited={edited[k]} onReset={()=>resetPlatform(k)} connected={status[k]?.connected||k==="substack"} hasImage={!!imageFile} index={i} xPremium={xPremium} ogData={cardData} croppedPreview={croppedPreviews[k]} showMode={showModes[k]} onToggleMode={mode=>setShowModes(p=>({...p,[k]:mode}))} onOpenCrop={pk=>setCropEditorKey(pk)} mentions={mentions} onShowPopup={setMentionPopup}/>)}
        </div>
      </div>}

      {results.length>0&&<div style={{marginTop:24,maxWidth:620,margin:"24px auto 0",background:C.card,borderRadius:16,padding:"18px 22px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",animation:"fadeIn 0.3s ease"}}>
        <div style={{fontFamily:F.ui,fontSize:11,fontWeight:600,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Transmission log</div>
        {results.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:i<results.length-1?"1px solid "+C.borderLight:"none"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:r.success?C.success:C.danger,fontSize:13}}>{r.success?"\u2713":"\u2717"}</span><span style={{fontFamily:F.ui,fontSize:12,fontWeight:600}}>{PLATFORMS[r.platform]?.name}</span></div>{r.success&&r.postUrl&&<a href={r.postUrl} target="_blank" rel="noopener noreferrer" style={{fontFamily:F.ui,fontSize:11,color:C.accent,textDecoration:"underline",fontWeight:500}}>View &rarr;</a>}{!r.success&&<span style={{fontFamily:F.ui,fontSize:11,color:C.danger}}>{r.error}</span>}</div>)}
      </div>}
    </main>

    {hasContent&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:"linear-gradient(transparent,"+C.bg+"f2 40%)",padding:"40px 28px 28px",display:"flex",justifyContent:"center",zIndex:30,animation:"fadeIn 0.3s ease"}}><button onClick={broadcast} disabled={sending} style={{background:sending?C.sub:C.text,color:"#fff",border:"none",padding:"14px 48px",borderRadius:14,fontFamily:F.ui,fontSize:14,fontWeight:600,cursor:sending?"default":"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.15)",transition:"transform 0.15s",animation:sending?"pulse 1s ease infinite":"none"}} onMouseDown={e=>{if(!sending)e.currentTarget.style.transform="scale(0.97)"}} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>{sending?"Transmitting\u2026":"Broadcast Now"}</button></div>}

    {/* ═══ GLOBAL MENTION POPUP — hover tooltip ═══ */}
    {mentionPopup?.type==="hover"&&(()=>{const sel=mentionPopup.candidates?.find(c=>c.selected);if(!sel)return null;const r=mentionPopup.chipRect;const w=270;let left=r.left+r.width/2-w/2;left=Math.max(12,Math.min(left,window.innerWidth-w-12));const initials=(sel.name||mentionPopup.name).split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    return<div data-mpopup onMouseEnter={()=>setMentionPopup(p=>p?.type==="hover"?{...p,locked:true}:p)} onMouseLeave={()=>setMentionPopup(null)} style={{position:"fixed",left,bottom:window.innerHeight-r.top+2,width:w,zIndex:9999,paddingBottom:6}}>
      <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",border:"1px solid "+C.borderLight,animation:"dropIn 0.12s ease"}}>
      <div style={{padding:"14px 16px 12px",display:"flex",alignItems:"center",gap:11,background:C.mention+"06"}}>
        <div style={{width:42,height:42,borderRadius:10,flexShrink:0,background:"linear-gradient(135deg,"+C.mention+",#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.ui,fontSize:14,fontWeight:700,color:"#fff",overflow:"hidden"}}>{sel.avatar&&sel.avatar.startsWith("http")?<img src={sel.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initials}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontFamily:F.ui,fontSize:13,fontWeight:700,color:C.text}}>{sel.name||mentionPopup.name}</div><div style={{fontFamily:F.mono,fontSize:11,color:C.mention,marginTop:2}}>{sel.handle}</div></div>
      </div>
      {sel.bio&&<div style={{padding:"8px 16px 10px",fontFamily:F.ui,fontSize:11,color:C.sub,lineHeight:1.4,borderTop:"1px solid "+C.borderLight}}>{sel.bio}</div>}
      <div style={{padding:"9px 16px 11px",borderTop:"1px solid "+C.borderLight,background:C.muted,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontFamily:F.ui,fontSize:10,color:C.sub}}>{mentionPopup.candidates.length>1?(mentionPopup.candidates.length-1)+" other match"+(mentionPopup.candidates.length>2?"es":""):"Only match"}</span>
        {mentionPopup.candidates.length>1&&<button onClick={()=>setMentionPopup(p=>({...p,type:"select"}))} style={{background:C.mention,color:"#fff",border:"none",padding:"5px 14px",borderRadius:7,fontFamily:F.ui,fontSize:11,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 8px "+C.mention+"40"}}>Wrong person?</button>}
      </div>
      </div>
    </div>})()}

    {/* ═══ GLOBAL MENTION POPUP — select dropdown ═══ */}
    {mentionPopup?.type==="select"&&(()=>{const r=mentionPopup.chipRect;const w=340;let left=r.left+r.width/2-w/2;left=Math.max(12,Math.min(left,window.innerWidth-w-12));const top=Math.min(r.bottom+8,window.innerHeight-400);
    return<div data-mpopup style={{position:"fixed",left,top,width:w,zIndex:9999,background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.22), 0 2px 10px rgba(0,0,0,0.06)",border:"1px solid "+C.borderLight,animation:"dropIn 0.15s ease"}}>
      <div style={{padding:"12px 16px",fontFamily:F.ui,fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.08em",background:C.muted,borderBottom:"1px solid "+C.borderLight,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{mentionPopup.platformName} — match for &ldquo;{mentionPopup.name}&rdquo;</span>
        <span onClick={()=>setMentionPopup(null)} style={{fontSize:13,color:C.sub,cursor:"pointer",textTransform:"none",letterSpacing:0,padding:"2px 6px",borderRadius:4,fontWeight:400}} onMouseEnter={e=>e.currentTarget.style.background=C.borderLight} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>&times;</span>
      </div>
      <div style={{padding:6,maxHeight:320,overflowY:"auto"}}>
        {mentionPopup.candidates?.map((c,i)=>{const initials=(c.name||mentionPopup.name).split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();return(
          <button key={i} onClick={()=>handleSelectCandidate(mentionPopup.name,mentionPopup.platformKey,c)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",background:c.selected?C.mention+"08":"transparent",border:c.selected?"2px solid "+C.mention+"25":"2px solid transparent",borderRadius:10,cursor:"pointer",textAlign:"left",transition:"all 0.12s",marginBottom:2}}
            onMouseEnter={e=>{if(!c.selected){e.currentTarget.style.background=C.mention+"08";e.currentTarget.style.borderColor=C.mention+"15"}}} onMouseLeave={e=>{if(!c.selected){e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent"}}}>
            <div style={{width:38,height:38,borderRadius:9,flexShrink:0,background:c.selected?"linear-gradient(135deg,"+C.mention+",#7c3aed)":C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.ui,fontSize:12,fontWeight:700,color:c.selected?"#fff":C.sub,overflow:"hidden"}}>{c.avatar&&c.avatar.startsWith("http")?<img src={c.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:F.ui,fontSize:12.5,fontWeight:650,color:C.text}}>{c.name}</span>{c.selected&&<span style={{fontSize:9,color:"#fff",background:C.success,padding:"1px 7px",borderRadius:5,fontFamily:F.ui,fontWeight:700}}>ACTIVE</span>}</div>
              <div style={{fontFamily:F.mono,fontSize:10.5,color:C.mention,marginTop:1}}>{c.handle}</div>
              {c.bio&&<div style={{fontFamily:F.ui,fontSize:10,color:C.sub,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.bio}</div>}
            </div>
            {!c.selected&&<div style={{fontFamily:F.ui,fontSize:10,color:C.mention,fontWeight:700,padding:"4px 11px",borderRadius:7,border:"1.5px solid "+C.mention+"30",flexShrink:0}}>Select</div>}
          </button>)})}
        {(!mentionPopup.candidates||mentionPopup.candidates.length===0)&&<div style={{padding:"14px 10px",textAlign:"center",fontFamily:F.ui,fontSize:11,color:C.sub}}>No matches found</div>}
      </div>
      {mentionPopup.platformKey==="linkedin"&&<div style={{padding:"10px 16px 12px",background:C.muted,borderTop:"1px solid "+C.borderLight,textAlign:"center"}}><span onClick={()=>{setMentionPopup(null);setLinkedInUrlModal(mentionPopup.name)}} style={{fontFamily:F.ui,fontSize:11,color:C.accent,fontWeight:600,cursor:"pointer"}}>Paste a LinkedIn profile URL instead &rarr;</span></div>}
    </div>})()}

    {cropEditorKey&&imagePreview&&PLATFORMS[cropEditorKey]?.cropRatio&&<CropEditor imageDataUrl={imagePreview} ratio={PLATFORMS[cropEditorKey].cropRatio} platformName={PLATFORMS[cropEditorKey].name} cropLabel={PLATFORMS[cropEditorKey].cropLabel} cropW={PLATFORMS[cropEditorKey].cropW} cropH={PLATFORMS[cropEditorKey].cropH} initialOffsetY={cropOffsets[cropEditorKey]?.y||0.5} initialOffsetX={cropOffsets[cropEditorKey]?.x||0.5} initialZoom={cropOffsets[cropEditorKey]?.z||1} onSave={(normY,normX,zoom)=>handleCropSave(cropEditorKey,normY,normX,zoom)} onClose={()=>setCropEditorKey(null)}/>}
    {linkedInUrlModal&&<LinkedInUrlModal name={linkedInUrlModal} onResolve={handleLinkedInUrlResolve} onClose={()=>setLinkedInUrlModal(null)}/>}
    {settingsOpen&&<SettingsPanel status={status} onClose={()=>setSettingsOpen(false)} onRefreshStatus={refreshStatus} xPremium={xPremium} setXPremium={setXPremium}/>}
    {toast&&<Toast message={toast.message} type={toast.type} onDone={()=>setToast(null)}/>}

    <style>{"\
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}\
      @keyframes cardIn{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}\
      @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}\
      @keyframes dropIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}\
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}\
    "}</style>
  </div>;
}
