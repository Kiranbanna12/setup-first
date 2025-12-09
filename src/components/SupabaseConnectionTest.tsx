import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function SupabaseConnectionTest() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'error'>('testing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [serverInfo, setServerInfo] = useState<any>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('Testing Supabase connection...');
        console.log('Server URL:', import.meta.env.VITE_SUPABASE_URL);
        console.log('API Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20) + '...');

        // Test basic connection
        // @ts-ignore - System table access
        const { data, error } = await (supabase as any).from('profiles').select('*').limit(1);

        if (error) {
          console.error('Connection test error:', error);
          setErrorMessage(error.message);
          setConnectionStatus('error');
        } else {
          console.log('Connection successful!');
          setConnectionStatus('connected');
        }

        // Get server info
        setServerInfo({
          url: import.meta.env.VITE_SUPABASE_URL,
          keyPrefix: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20) + '...'
        });

      } catch (err: any) {
        console.error('Connection test failed:', err);
        setErrorMessage(err.message || 'Unknown error');
        setConnectionStatus('error');
      }
    };

    testConnection();
  }, []);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Supabase Connection Test
          {connectionStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
          {connectionStatus === 'connected' && <CheckCircle className="h-4 w-4 text-success" />}
          {connectionStatus === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'error' ? 'destructive' : 'secondary'}>
            {connectionStatus}
          </Badge>
        </div>

        {serverInfo && (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Server URL:</span>
              <p className="text-muted-foreground break-all">{serverInfo.url}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium">API Key:</span>
              <p className="text-muted-foreground">{serverInfo.keyPrefix}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            <span className="font-medium">Error:</span> {errorMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
