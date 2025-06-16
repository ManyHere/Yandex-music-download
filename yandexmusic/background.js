chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openAuthPage' || request.action === 'openAuthPageForDownload') {
    chrome.tabs.create({
      url: 'https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d',
      active: false
    }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: 'Не удалось открыть страницу авторизации' });
        return;
      }
      chrome.storage.local.set({ authTabId: tab.id });
      sendResponse({ success: true });
    });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const url = new URL(changeInfo.url);
    const token = url.hash.match(/access_token=([^&]+)/);
    if (token && token[1]) {
      const extractedToken = token[1];
      chrome.storage.local.set({ yandexMusicToken: extractedToken }, () => {
        if (chrome.runtime.lastError) {
          return;
        }
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'tokenUpdated', token: extractedToken }, (response) => {
              if (chrome.runtime.lastError) {
              }
            });
            chrome.tabs.update(tabs[0].id, { active: true });
          }
        });
        chrome.storage.local.get(['authTabId'], (result) => {
          if (result.authTabId === tabId) {
            chrome.tabs.remove(tabId);
          }
        });
      });
    }
  }
});