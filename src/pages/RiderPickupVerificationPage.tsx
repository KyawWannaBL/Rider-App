import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Truck, Upload, Download, Plus, Camera, CheckCircle, AlertTriangle, X, MapPin, QrCode, FileText, Trash2, PenTool, Scale, RefreshCw, Printer, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { useAppState } from '@/hooks/useAppState';
import { supabase } from '@/integrations/supabase/client';

type Merchant = { id: string; name: string; address?: string; contact?: string; phone?: string; township?: string; deliCharge?: number; };
type Parcel = { id: number; wayId: string; deliveryId: string; recipientName?: string; recipientPhone?: string; township?: string; address?: string; itemPrice?: number | string; weight: string; deliFee?: number | string; remarks?: string; photoUrl?: string; qrText?: string; qrImage?: string; status?: string; };

const TOWNSHIPS = ['ပန်းဘဲတန်း','ကျောက်တံတား','လမ်းမတော်','လသာ','ပုဇွန်တောင်','ဗိုလ်တထောင်','ဒဂုံ','အလုံ','ကြည့်မြင်တိုင်','စမ်းချောင်း','လှိုင်','ကမာရွတ်','မရမ်းကုန်း','ရန်ကင်း','ဗဟန်း','တာမွေ','မင်္ဂလာတောင်ညွန့်','သာကေတ','ဒေါပုံ','သင်္ဃန်းကျွန်း','တောင်ဥက္ကလာပ','မြောက်ဥက္ကလာပ','မြောက်ဒဂုံ','တောင်ဒဂုံ','အရှေ့ဒဂုံ','ဒဂုံဆိပ်ကမ်း','လှိုင်သာယာ','အင်းစိန်'];

function cleanCode(value: string) { return (String(value || 'CU').replace(/[^a-zA-Z0-9]+/g, '').toUpperCase() || 'CU'); }
function todayMmdd() { const now = new Date(); return `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`; }
function generateWayId(merchantId: string, pickupSeq = 1) { return `D${todayMmdd()}-${cleanCode(merchantId)}-${String(pickupSeq).padStart(3, '0')}`; }
function generateDeliveryId(wayId: string, index: number) { return `${wayId}-${String(index).padStart(3, '0')}`; }

function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);
  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!; canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext('2d')!; const p = getPoint(event);
    drawing.current = true; ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!;
    const p = getPoint(event); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.strokeStyle = '#c9a227';
    ctx.lineTo(p.x, p.y); ctx.stroke(); setSigned(true); onChange(canvas.toDataURL('image/png'));
  };
  const stop = () => { drawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current!; canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false); onChange('');
  };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(400, Math.floor(rect.width * window.devicePixelRatio));
    canvas.height = Math.max(160, Math.floor(rect.height * window.devicePixelRatio));
    const ctx = canvas.getContext('2d'); if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }, []);
  return (
    <div>
      <canvas ref={canvasRef} className="w-full h-40 rounded-xl cursor-crosshair" style={{ background: 'oklch(0.15 0.035 258)', border: '1px solid oklch(0.25 0.040 260)' }}
        onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} />
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs font-bold ${signed ? 'text-green-400' : 'text-muted-foreground'}`}>{signed ? '✓ Signature captured' : 'Draw sender signature'}</span>
        <button type="button" onClick={clear} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground">Clear</button>
      </div>
    </div>
  );
}

export default function RiderPickupVerificationPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  const { language: lang } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [parcelCount, setParcelCount] = useState(1);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [batchId, setBatchId] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const filteredMerchants = useMemo(() => {
    if (!searchTerm || selectedMerchant || merchants.length === 0) return [];
    return merchants.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.id.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 6);
  }, [searchTerm, selectedMerchant, merchants]);

  const totalWeight = parcels.reduce((acc, p) => acc + (parseFloat(p.weight) || 0), 0);
  const allItemsReady = parcels.length > 0 && parcels.every(p => Number(p.weight) > 0 && !!p.photoUrl);

  useEffect(() => {
    setBatchId(`D${todayMmdd()}-PENDING`);
    if (!supabase) { setNotice({ type: 'error', text: 'Supabase not configured — merchant list unavailable.' }); return; }
    supabase.from('merchants').select('id,name,address,contact,phone,township,delivery_charge').order('name').limit(50)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setMerchants(data.map((m: Record<string, unknown>) => ({
            id: String(m.id || ''), name: String(m.name || ''), address: m.address as string | undefined,
            contact: m.contact as string | undefined, phone: m.phone as string | undefined,
            township: m.township as string | undefined, deliCharge: Number(m.delivery_charge || 4000),
          })));
        }
      });
  }, []);

  function handleLoadTemplate() {
    if (!selectedMerchant) { setNotice({ type: 'error', text: 'Please select the merchant/customer first.' }); return; }
    const count = Math.max(1, parseInt(String(parcelCount), 10) || 1);
    const wayId = batchId.includes('PENDING') ? generateWayId(selectedMerchant.id) : batchId;
    const newParcels = Array.from({ length: count }, (_, i) => ({
      id: i + 1, wayId, deliveryId: generateDeliveryId(wayId, i + 1),
      recipientName: '', recipientPhone: '', township: selectedMerchant.township || '', address: '',
      itemPrice: 0, weight: '', deliFee: selectedMerchant.deliCharge || 4000, remarks: '', photoUrl: '', qrText: '', qrImage: '', status: 'pending',
    }));
    setBatchId(wayId); setParcels(newParcels); setIsGenerated(true); setNotice(null);
  }

  function updateParcel(id: number, field: keyof Parcel, value: unknown) {
    setParcels(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }
  function deleteParcel(id: number) {
    setParcels(prev => prev.filter(p => p.id !== id).map((p, idx) => ({ ...p, id: idx + 1, deliveryId: generateDeliveryId(p.wayId, idx + 1) })));
  }
  function handlePhoto(id: number, file?: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateParcel(id, 'photoUrl', String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  async function finalizeHandover() {
    if (!signature) { setNotice({ type: 'error', text: 'Sender signature is mandatory before finalizing handover.' }); return; }
    if (!allItemsReady) { setNotice({ type: 'error', text: 'All parcels need weight and cargo photo.' }); return; }
    if (!supabase) { setNotice({ type: 'error', text: 'Supabase not configured.' }); return; }
    setLoading(true);
    try {
      await supabase.from('field_pickups').insert({
        way_id: batchId, merchant_id: selectedMerchant?.id, merchant_name: selectedMerchant?.name,
        parcel_count: parcels.length, total_weight: totalWeight, signature_url: signature,
        status: 'handover_finalized', created_at: new Date().toISOString(),
      });
      setNotice({ type: 'success', text: 'Pickup handover finalized and synchronized to Portal.' });
      setParcels(prev => prev.map(p => ({ ...p, status: 'handover_finalized' })));
    } catch (e: unknown) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Finalize failed.' });
    } finally { setLoading(false); }
  }

  return (
    <><AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}>
      <div className="p-4 pb-32 space-y-5">
        <div>
          <h1 className="text-xl font-black text-foreground uppercase tracking-tight">Field Pickup Verification</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Capture parcel weight, cargo photo and sender signature for handover.</p>
        </div>

        {notice && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${notice.type === 'error' ? 'text-red-300' : 'text-green-300'}`}
            style={{ background: notice.type === 'error' ? 'oklch(0.58 0.22 15 / 0.12)' : 'oklch(0.62 0.18 152 / 0.12)', border: `1px solid ${notice.type === 'error' ? 'oklch(0.58 0.22 15 / 0.30)' : 'oklch(0.62 0.18 152 / 0.30)'}` }}>
            {notice.text}
          </div>
        )}

        {/* Merchant search + config */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">Way ID</label>
            <input readOnly value={batchId} className="w-full rounded-xl px-4 py-2.5 text-sm font-mono bg-background text-muted-foreground border border-border" />
          </div>
          <div className="relative">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
              {lang === 'en' ? 'Select Merchant *' : 'ကုန်သည် ရွေးချယ်ပါ *'}
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder={lang === 'en' ? 'Search merchant name or ID…' : 'ကုန်သည် ရှာဖွေပါ…'}
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm bg-background text-foreground border border-border outline-none focus:border-primary"
                value={searchTerm} onChange={e => { setSearchTerm(e.target.value); if (selectedMerchant) setSelectedMerchant(null); }} />
            </div>
            {filteredMerchants.length > 0 && (
              <div className="absolute z-50 w-full mt-2 rounded-2xl shadow-2xl p-2 space-y-1" style={{ background: 'oklch(0.15 0.036 258)', border: '1px solid oklch(0.22 0.040 262)' }}>
                {filteredMerchants.map(m => (
                  <button key={m.id} onClick={() => { setSelectedMerchant(m); setSearchTerm(m.name); setBatchId(generateWayId(m.id)); }}
                    className="w-full text-left p-3 rounded-xl hover:bg-muted/30 transition-colors flex justify-between items-center">
                    <div><div className="text-sm font-bold text-foreground">{m.name} <span style={{ color: 'oklch(0.83 0.175 96)' }}>({m.id})</span></div>
                      <div className="text-xs text-muted-foreground">{m.address || m.township || ''}</div></div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">{lang === 'en' ? 'Quantity' : 'အရေအတွက်'}</label>
              <input type="number" min="1" value={parcelCount} onChange={e => setParcelCount(Number(e.target.value))} className="w-full rounded-xl px-4 py-2.5 text-sm bg-background text-foreground border border-border outline-none text-center" />
            </div>
            <div className="flex items-end">
              <button onClick={handleLoadTemplate} disabled={!selectedMerchant || loading}
                className="w-full rounded-xl py-3 text-sm font-black uppercase tracking-wide transition-all disabled:opacity-50"
                style={{ background: 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }}>
                {lang === 'en' ? 'Load Template' : 'ပုံစံ တင်မည်'}
              </button>
            </div>
          </div>
          {selectedMerchant && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-muted/20">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div><p className="text-sm font-bold text-foreground">{selectedMerchant.name}</p>
                <p className="text-xs text-muted-foreground">{selectedMerchant.address || selectedMerchant.township || 'Pickup address pending'}</p></div>
            </div>
          )}
        </div>

        {/* Parcel list */}
        {isGenerated && (
          <div className="space-y-4">
            {parcels.map(p => (
              <div key={p.id} className="rounded-2xl p-4 space-y-3" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase">{p.deliveryId}</p>
                    <p className="text-xs text-muted-foreground">{p.status}</p>
                  </div>
                  <button onClick={() => deleteParcel(p.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-400" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Weight (KG)</label>
                    <input type="number" step="0.1" value={p.weight} onChange={e => updateParcel(p.id, 'weight', e.target.value)} placeholder="0.0"
                      className="w-full rounded-xl px-3 py-2 text-sm text-center bg-background text-foreground border border-border outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Township</label>
                    <select value={p.township || ''} onChange={e => updateParcel(p.id, 'township', e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-sm bg-background text-foreground border border-border outline-none">
                      <option value="">Select</option>
                      {TOWNSHIPS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Recipient Name</label>
                  <input value={p.recipientName || ''} onChange={e => updateParcel(p.id, 'recipientName', e.target.value)} placeholder="Name"
                    className="w-full rounded-xl px-3 py-2 text-sm bg-background text-foreground border border-border outline-none" />
                </div>
                <div className="flex gap-3">
                  <label className={`flex flex-col items-center justify-center flex-1 rounded-xl py-3 cursor-pointer border-2 border-dashed transition-colors ${p.photoUrl ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-border text-muted-foreground hover:border-primary'}`}>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhoto(p.id, e.target.files?.[0])} />
                    <Camera className="h-5 w-5 mb-1" /><span className="text-[9px] font-black uppercase">{p.photoUrl ? 'Photo OK' : 'Cargo Photo'}</span>
                  </label>
                  {p.qrText && (
                    <div className="flex flex-col items-center justify-center flex-1 rounded-xl py-3 bg-green-500/10 border border-green-500/40">
                      <QrCode className="h-5 w-5 mb-1 text-green-400" /><span className="text-[9px] font-black uppercase text-green-400">QR Ready</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Signature */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
              <div className="flex items-center gap-2 mb-2">
                <PenTool className="h-4 w-4" style={{ color: 'oklch(0.83 0.175 96)' }} />
                <h2 className="text-sm font-black text-foreground uppercase tracking-wide">Sender Signature</h2>
              </div>
              <SignaturePad onChange={setSignature} />
              <div className="flex items-start gap-3 rounded-xl p-3 bg-muted/20">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'oklch(0.70 0.18 55)' }} />
                <p className="text-xs text-muted-foreground">Confirming {parcels.length} parcels for pickup. Sender confirms weight and visual condition.</p>
              </div>
            </div>

            {/* Summary + finalize */}
            <div className="rounded-2xl p-4 space-y-4" style={{ background: 'oklch(0.14 0.036 258)', border: '1px solid oklch(0.83 0.175 96 / 0.20)' }}>
              <div className="flex justify-between">
                <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-black text-foreground">{parcels.length} Items</span></div>
                <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-black text-foreground">{totalWeight.toFixed(1)} KG</span></div>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 rounded-2xl py-3 text-sm font-bold text-muted-foreground border border-border">
                  Hold Draft
                </button>
                <button onClick={finalizeHandover} disabled={loading || !signature || !allItemsReady}
                  className="flex-1 rounded-2xl py-3 text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  style={{ background: 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Finalize
                </button>
              </div>
            </div>
          </div>
        )}

        {!isGenerated && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Truck className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-base font-black text-foreground uppercase">System Awaiting Selection</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">Select a merchant to load the pickup verification template.</p>
          </div>
        )}
      </div>
    </AppShell>
    <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    {showBulkModal && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4" onClick={() => setShowBulkModal(false)}>
        <div className="bg-card rounded-3xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between"><h2 className="text-base font-black text-foreground">Bulk Upload</h2><button onClick={() => setShowBulkModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button></div>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl py-12 cursor-pointer hover:border-primary transition-colors">
            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-bold text-foreground">Drop Manifest CSV</p>
            <p className="text-xs text-muted-foreground mt-1">Auto-mapping active</p>
            <input type="file" accept=".csv" className="hidden" />
          </label>
          <div className="flex gap-3">
            <button className="flex-1 rounded-2xl py-3 text-sm font-bold border border-border text-foreground" onClick={() => setShowBulkModal(false)}>Cancel</button>
            <button className="flex-1 rounded-2xl py-3 text-sm font-black" style={{ background: 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }}>Upload</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
