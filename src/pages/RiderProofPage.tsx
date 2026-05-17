import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, CheckCircle2, XCircle, AlertCircle, Camera, FileSignature, Smartphone, QrCode } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { ProofCapture } from '@/components/shared/ProofCapture';
import { useAppState } from '@/hooks/useAppState';
import { t, type DeliveryStatus } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
export default function RiderProofPage() {
  const { language: lang } = useAppState();
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pickup');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [deliveryOutcome, setDeliveryOutcome] = useState<DeliveryStatus>('success');
  const [codCollected, setCodCollected] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'signature'|'photo'|'otp'|'qr'>('signature');
  const [failureReason, setFailureReason] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const handlePickupSubmit = (data: {trackingNumbers:string[];count:number;proofType:string}) => { console.log('Pickup proof submitted:', data); };
  const handleSearchJob = () => { if (searchQuery.trim()) setSelectedJob(searchQuery); };
  const handleDeliverySubmit = () => { console.log('Delivery proof submitted', {selectedJob, deliveryOutcome, codCollected, verificationMethod, failureReason, otpCode}); setSelectedJob(null); setSearchQuery(''); setDeliveryOutcome('success'); setCodCollected(false); setFailureReason(''); setOtpCode(''); };
  const failureReasons = [{value:'not-home',label:t('delivery.notHome',lang)},{value:'wrong-address',label:t('delivery.wrongAddress',lang)},{value:'refused',label:t('delivery.refused',lang)},{value:'damaged',label:t('delivery.damaged',lang)}];
  return (<><AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}>
    <div className="min-h-screen bg-background p-4 pb-24">
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
        <div className="mb-6"><h1 className="text-2xl font-bold text-foreground mb-1">{t('nav.proof',lang)}</h1><p className="text-sm text-muted-foreground">{t('pickup.submit',lang)}</p></div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6"><TabsTrigger value="pickup">{t('jobs.pickup',lang)}</TabsTrigger><TabsTrigger value="delivery">{t('jobs.delivery',lang)}</TabsTrigger></TabsList>
          <TabsContent value="pickup"><ProofCapture title={t('jobs.pickup',lang)+' '+t('nav.proof',lang)} onSubmit={handlePickupSubmit} /></TabsContent>
          <TabsContent value="delivery" className="space-y-4">
            {!selectedJob ? (
              <Card className="p-4 space-y-4 rounded-2xl" style={{background:'oklch(0.13 0.032 258)',border:'1px solid oklch(0.19 0.036 260)'}}>
                <div><Label className="text-sm font-medium text-foreground mb-2 block">{t('pickup.enterTracking',lang)}</Label>
                <div className="flex gap-2"><Input type="text" placeholder="BX-2026-XXXXXX" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="flex-1" onKeyDown={e=>e.key==='Enter'&&handleSearchJob()} /><Button onClick={handleSearchJob}><Search className="h-4 w-4" /></Button></div></div>
              </Card>
            ) : (
              <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4">
                <Card className="p-4 rounded-2xl space-y-4" style={{background:'oklch(0.13 0.032 258)',border:'1px solid oklch(0.19 0.036 260)'}}>
                  <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{t('pickup.enterTracking',lang)}</p><p className="text-sm font-semibold text-foreground">{selectedJob}</p></div><Button variant="ghost" size="sm" onClick={()=>setSelectedJob(null)}>{t('common.cancel',lang)}</Button></div>
                  <div className="space-y-4">
                    <div><Label className="text-sm font-medium text-foreground mb-3 block">Delivery Outcome</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant={deliveryOutcome==='success'?'default':'outline'} className={deliveryOutcome==='success'?'bg-green-600':''} onClick={()=>setDeliveryOutcome('success')}><CheckCircle2 className="h-4 w-4 mr-1"/>{t('delivery.success',lang)}</Button>
                        <Button variant={deliveryOutcome==='failed'?'default':'outline'} className={deliveryOutcome==='failed'?'bg-destructive text-destructive-foreground':''} onClick={()=>setDeliveryOutcome('failed')}><XCircle className="h-4 w-4 mr-1"/>{t('delivery.failed',lang)}</Button>
                        <Button variant={deliveryOutcome==='partial'?'default':'outline'} onClick={()=>setDeliveryOutcome('partial')}><AlertCircle className="h-4 w-4 mr-1"/>{t('delivery.partial',lang)}</Button>
                      </div>
                    </div>
                    {deliveryOutcome==='failed' && (<motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} className="space-y-2"><Label className="text-sm font-medium text-foreground">{t('delivery.failureReason',lang)}</Label><RadioGroup value={failureReason} onValueChange={setFailureReason}>{failureReasons.map(r=><div key={r.value} className="flex items-center space-x-2"><RadioGroupItem value={r.value} id={r.value}/><Label htmlFor={r.value} className="text-sm cursor-pointer">{r.label}</Label></div>)}</RadioGroup></motion.div>)}
                    {deliveryOutcome==='success' && (<motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><Label htmlFor="cod-toggle" className="text-sm font-medium text-foreground cursor-pointer">{t('delivery.codCollected',lang)}</Label><Switch id="cod-toggle" checked={codCollected} onCheckedChange={setCodCollected}/></motion.div>)}
                  </div>
                </Card>
                {deliveryOutcome==='success' && (
                  <Card className="p-4 rounded-2xl space-y-3" style={{background:'oklch(0.13 0.032 258)',border:'1px solid oklch(0.19 0.036 260)'}}>
                    <Label className="text-sm font-medium text-foreground block">Verification Method</Label>
                    <Tabs value={verificationMethod} onValueChange={v=>setVerificationMethod(v as typeof verificationMethod)}>
                      <TabsList className="grid w-full grid-cols-4 mb-4">
                        <TabsTrigger value="signature" className="text-xs"><FileSignature className="h-3 w-3 mr-1"/>Sign</TabsTrigger>
                        <TabsTrigger value="photo" className="text-xs"><Camera className="h-3 w-3 mr-1"/>Photo</TabsTrigger>
                        <TabsTrigger value="otp" className="text-xs"><Smartphone className="h-3 w-3 mr-1"/>OTP</TabsTrigger>
                        <TabsTrigger value="qr" className="text-xs"><QrCode className="h-3 w-3 mr-1"/>QR</TabsTrigger>
                      </TabsList>
                      <TabsContent value="signature"><div className="border-2 border-dashed border-border rounded-lg h-40 flex items-center justify-center bg-muted/30"><div className="text-center"><FileSignature className="h-10 w-10 text-muted-foreground mx-auto mb-2"/><p className="text-sm text-muted-foreground">{t('pickup.drawSignature',lang)}</p></div></div></TabsContent>
                      <TabsContent value="photo"><label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg h-40 cursor-pointer bg-muted/30 hover:border-primary transition-colors"><Camera className="h-10 w-10 text-muted-foreground mb-2"/><p className="text-sm text-muted-foreground">{t('pickup.takePhoto',lang)}</p><input type="file" accept="image/*" capture="environment" className="hidden"/></label></TabsContent>
                      <TabsContent value="otp"><div><Label htmlFor="otp" className="text-sm font-medium text-foreground mb-2 block">Enter OTP Code</Label><Input id="otp" type="text" placeholder="Enter 6-digit OTP" value={otpCode} onChange={e=>setOtpCode(e.target.value)} maxLength={6} className="text-center text-lg tracking-widest"/></div></TabsContent>
                      <TabsContent value="qr"><div className="border-2 border-dashed border-border rounded-lg h-40 flex items-center justify-center bg-muted/30"><div className="text-center"><QrCode className="h-10 w-10 text-muted-foreground mx-auto mb-2"/><p className="text-sm text-muted-foreground">Scan QR Code</p></div></div></TabsContent>
                    </Tabs>
                  </Card>
                )}
                <Button onClick={handleDeliverySubmit} className="w-full py-4 font-black text-sm uppercase tracking-wide" style={{background:'oklch(0.83 0.175 96)',color:'oklch(0.09 0.028 256)'}} disabled={deliveryOutcome==='failed'&&!failureReason}>{t('delivery.submitProof',lang)}</Button>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  </AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
