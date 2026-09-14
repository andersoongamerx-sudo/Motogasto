
(() => {
  let deferredPrompt = null;
  let installBtn = null;
  let statusBox = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function setStatus(text, ok=false) {
    if (!statusBox) return;
    statusBox.textContent = text;
    statusBox.style.background = ok ? '#123b2e' : '#3f3210';
    statusBox.style.borderColor = ok ? '#25664f' : '#80651e';
  }

  async function checkPWA() {
    if (isStandalone()) {
      setStatus('MotoGasto está aberto como aplicativo PWA.', true);
      if (installBtn) installBtn.style.display = 'none';
      return;
    }

    if (!('serviceWorker' in navigator)) {
      setStatus('Este navegador não oferece suporte a PWA.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        // First install can require one reload for the page to become controlled.
        setStatus('PWA preparado. Atualizando uma vez para concluir...');
        setTimeout(() => location.reload(), 1200);
        return;
      }
      if (deferredPrompt) {
        setStatus('PWA pronto para instalar.', true);
        if (installBtn) installBtn.style.display = 'block';
      } else {
        setStatus('PWA preparado. Se o botão Instalar não aparecer, use o menu do Chrome > Instalar app.');
      }
    } catch (err) {
      setStatus('Falha ao ativar o PWA: ' + (err.message || err));
    }
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'block';
    setStatus('PWA pronto para instalar.', true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setStatus('MotoGasto instalado como aplicativo.', true);
    if (installBtn) installBtn.style.display = 'none';
  });

  window.addEventListener('DOMContentLoaded', () => {
    statusBox = document.createElement('div');
    statusBox.id = 'pwaStatus';
    statusBox.style.cssText = 'display:none;margin:10px 0;padding:10px;border:1px solid #80651e;border-radius:12px;font-size:14px;';

    installBtn = document.createElement('button');
    installBtn.id = 'installPwaBtn';
    installBtn.className = 'primary';
    installBtn.textContent = '📲 INSTALAR MOTOGASTO';
    installBtn.style.cssText = 'display:none;margin:10px 0;';

    const anchor = document.querySelector('#appView') || document.body;
    if (anchor.firstChild) {
      anchor.insertBefore(statusBox, anchor.firstChild);
      anchor.insertBefore(installBtn, anchor.firstChild);
    } else {
      anchor.appendChild(installBtn);
      anchor.appendChild(statusBox);
    }

    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        statusBox.style.display = 'block';
        setStatus('Abra o menu ⋮ do Chrome e toque em “Instalar app”. Não use “Criar atalho”.');
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.style.display = 'none';
      checkPWA();
    });

    // only surface status while not standalone
    if (!isStandalone()) statusBox.style.display = 'block';
    checkPWA();
  });
})();
