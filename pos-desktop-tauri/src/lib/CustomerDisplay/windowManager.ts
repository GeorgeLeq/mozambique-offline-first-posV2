/**
 * @file windowManager.ts
 * @description Manages Tauri v2 Secondary WebviewWindow and Browser Detached Window for Customer-Facing Display.
 * 
 * Supports:
 * - Tauri v2 WebviewWindow API with multi-monitor / HDMI auto-detection (`availableMonitors()`).
 * - Browser detached popup window (`window.open`).
 * - In-App Picture-in-Picture (PiP) preview fallback for single-screen testing.
 */

import toast from 'react-hot-toast';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && 
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_METADATA__' in window);
};

export interface OpenCustomerWindowOptions {
  width?: number;
  height?: number;
  onOpened?: () => void;
  onFallbackToPiP?: () => void;
}

export function getCustomerDisplayUrl(): string {
  if (typeof window === 'undefined') return '/?window=customer-display';
  return `${window.location.origin}/?window=customer-display`;
}

/**
 * Opens or focuses the customer-facing secondary display window.
 * In Tauri v2: Auto-detects secondary monitor (HDMI) and positions the window there.
 * In Browser: Launches a detached popout window for multi-monitor setups.
 */
export async function openCustomerDisplayWindow(
  options: OpenCustomerWindowOptions = {}
): Promise<'tauri' | 'popup' | 'pip_needed'> {
  const width = options.width || 1200;
  const height = options.height || 800;
  const targetUrl = getCustomerDisplayUrl();

  // 1. If in Tauri v2 desktop environment
  if (isTauriEnvironment()) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const { availableMonitors } = await import('@tauri-apps/api/window');
      
      const existing = await WebviewWindow.getByLabel('customer-display');
      if (existing) {
        await existing.show();
        await existing.unminimize();
        await existing.setFocus();
        toast.success('Customer Display focused on secondary monitor.');
        options.onOpened?.();
        return 'tauri';
      }

      // Check for multiple monitors (e.g. HDMI customer screen)
      let windowConfig: any = {
        url: targetUrl,
        title: 'SYCOMM POS — Customer Display (Monitor 2)',
        width,
        height,
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        focus: true,
        decorations: true,
        dragDropEnabled: true,
        shadow: true
      };

      try {
        const monitors = await availableMonitors();
        if (monitors && monitors.length > 1) {
          // Monitor index 1 is typically the external secondary HDMI display
          const secondMonitor = monitors[1];
          windowConfig = {
            ...windowConfig,
            x: secondMonitor.position.x,
            y: secondMonitor.position.y,
            width: secondMonitor.size.width || width,
            height: secondMonitor.size.height || height
          };
          console.info('[WindowManager] Detected secondary monitor for HDMI Customer Display:', secondMonitor);
        } else {
          windowConfig.center = true;
        }
      } catch (_e) {
        windowConfig.center = true;
      }

      const secondaryWindow = new WebviewWindow('customer-display', windowConfig);

      secondaryWindow.once('tauri://created', async () => {
        toast.success('Customer Display launched successfully! Move to HDMI screen or press F11 for fullscreen.', {
          duration: 4000
        });
        options.onOpened?.();
      });

      secondaryWindow.once('tauri://error', (err) => {
        console.warn('[WindowManager] Tauri window error, switching to PiP:', err);
        toast('Switching to In-App Customer Display preview...', { icon: '🖥️' });
        options.onFallbackToPiP?.();
      });

      return 'tauri';
    } catch (_err) {
      console.warn('[WindowManager] Native Tauri window unavailable. Attempting browser popup.');
    }
  }

  // 2. In Browser environment: Try detached popup window
  return openBrowserPopup(targetUrl, width, height, options);
}

function openBrowserPopup(
  url: string, 
  width: number, 
  height: number,
  options: OpenCustomerWindowOptions
): 'popup' | 'pip_needed' {
  const screenW = typeof window !== 'undefined' ? window.screen.availWidth || window.screen.width : 1920;
  const screenH = typeof window !== 'undefined' ? window.screen.availHeight || window.screen.height : 1080;
  
  const left = Math.max(0, Math.round((screenW - width) / 2));
  const top = Math.max(0, Math.round((screenH - height) / 2));
  
  try {
    const popup = window.open(
      url,
      'SYCOMM_CustomerDisplay',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`
    );

    if (popup && !popup.closed) {
      popup.focus();
      toast.success('Customer Display opened in detached window! Drag to your HDMI monitor.', {
        duration: 4500
      });
      options.onOpened?.();
      return 'popup';
    }
  } catch (err) {
    console.warn('[WindowManager] window.open failed:', err);
  }

  // Popup blocked by browser popup blocker or sandbox restrictions
  toast('Detached window was blocked. Switched to In-App Customer Display PiP.', {
    icon: '🖥️',
    duration: 3500
  });
  options.onFallbackToPiP?.();
  return 'pip_needed';
}
