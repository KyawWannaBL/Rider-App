import { Truck } from 'lucide-react';
export default function DriverPlaceholderPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'oklch(0.09 0.028 256)'}}>
      <div className="text-center space-y-4"><Truck className="h-16 w-16 mx-auto" style={{color:'oklch(0.55 0.18 240)'}}/><h1 className="text-2xl font-black text-foreground">Driver App</h1><p className="text-sm text-muted-foreground">Driver portal — coming soon</p></div>
    </div>
  );
}
