import { HandHelping } from 'lucide-react';
export default function HelperPlaceholderPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'oklch(0.09 0.028 256)'}}>
      <div className="text-center space-y-4"><HandHelping className="h-16 w-16 mx-auto" style={{color:'oklch(0.60 0.18 300)'}}/><h1 className="text-2xl font-black text-foreground">Helper App</h1><p className="text-sm text-muted-foreground">Helper portal — coming soon</p></div>
    </div>
  );
}
