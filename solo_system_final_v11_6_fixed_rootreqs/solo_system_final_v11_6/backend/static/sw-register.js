if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations().catch(()=>[]);
      for (const r of regs) {
        try { await r.unregister(); } catch(e) {}
      }
      await navigator.serviceWorker.register('/sw.js?v11.7');
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  });
}
