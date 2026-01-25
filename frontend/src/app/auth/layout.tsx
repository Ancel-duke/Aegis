import { Shield } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Shield className="h-10 w-10 text-primary-400" />
          <span className="text-2xl font-bold text-white">Aegis</span>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white">
            AI-Powered Self-Healing Platform
          </h1>
          <p className="text-lg text-primary-200 max-w-md">
            Protect your Kubernetes infrastructure with intelligent anomaly detection,
            automated remediation, and comprehensive observability.
          </p>
          
          <div className="grid grid-cols-2 gap-6 mt-12">
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-1">Anomaly Detection</h3>
              <p className="text-primary-200 text-sm">
                AI-powered detection of unusual patterns
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-1">Self-Healing</h3>
              <p className="text-primary-200 text-sm">
                Automated remediation actions
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-1">Policy Engine</h3>
              <p className="text-primary-200 text-sm">
                Fine-grained access control
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-1">Observability</h3>
              <p className="text-primary-200 text-sm">
                Metrics, logs, and traces
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-primary-300 text-sm">
          © 2024 Aegis Platform. Secure by design.
        </p>
      </div>
      
      {/* Right side - Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
